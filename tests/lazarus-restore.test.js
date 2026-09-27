import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from "nostr-tools";
import nostrService from "../src/services/nostrService.js";
import backupService from "../src/services/backupService.js";
import LazarusRecovery from "../src/components/lazarus/LazarusRecovery.vue";
import {
  getDeliberateEditIds,
  listArchive,
  setLazarusSocketFactory,
} from "../src/lib/lazarus/index.js";
import { applyRestoreLocally } from "../src/lib/lazarus/local.js";

// Drives the panel's restore end to end: scan, review, re-read, sign with a
// real key, snapshot, publish, and update the app's local copy. Relays are
// fake sockets; everything else is the code the browser runs.

const secretKey = generateSecretKey();
const pubkey = getPublicKey(secretKey);
const WRITE = "wss://write.example";
const OLD_WRITE = "wss://old-write.example";

function followList(count, createdAt) {
  return finalizeEvent(
    {
      kind: 3,
      created_at: createdAt,
      tags: Array.from({ length: count }, (_, i) => ["p", (i + 1).toString(16).padStart(64, "0")]),
      content: "",
    },
    secretKey,
  );
}

function matches(event, filter) {
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  if (filter.until !== undefined && event.created_at > filter.until) return false;
  return true;
}

// Unknown relays refuse the connection, which is how every default and
// archival relay behaves here.
class FakeNetwork {
  relays = new Map();
  published = [];
  set(url, relay) {
    this.relays.set(url, relay);
    return this;
  }
  factory = (url) => new FakeSocket(this, url);
}

class FakeSocket {
  readyState = 0;
  onopen = null;
  onmessage = null;
  onerror = null;
  onclose = null;
  constructor(net, url) {
    this.net = net;
    this.url = url;
    this.relay = net.relays.get(url) ?? { mode: "refuse" };
    queueMicrotask(() => {
      if (this.relay.mode === "refuse") {
        this.readyState = 3;
        this.onerror?.({});
        this.onclose?.({});
        return;
      }
      this.readyState = 1;
      this.onopen?.({});
    });
  }
  send(data) {
    const message = JSON.parse(data);
    if (message[0] === "REQ") {
      const [, subId, ...filters] = message;
      queueMicrotask(() => {
        if (this.relay.mode === "close-request") {
          this.emit(["CLOSED", subId, "blocked"]);
          return;
        }
        for (const filter of filters) {
          this.relay.events
            .filter((event) => matches(event, filter))
            .sort((a, b) => b.created_at - a.created_at)
            .slice(0, filter.limit ?? 500)
            .forEach((event) => this.emit(["EVENT", subId, event]));
        }
        this.emit(["EOSE", subId]);
      });
    } else if (message[0] === "EVENT") {
      const event = message[1];
      this.net.published.push({ url: this.url, event });
      queueMicrotask(() => {
        const ok = this.relay.publish === "accept";
        if (ok) this.relay.events.push(event);
        this.emit(["OK", event.id, ok, ok ? "" : "blocked: not today"]);
      });
    }
  }
  emit(data) {
    if (this.readyState === 1) this.onmessage?.({ data: JSON.stringify(data) });
  }
  close() {
    this.readyState = 3;
  }
}

class MemoryStorage {
  data = new Map();
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    this.data.set(key, value);
  }
  removeItem(key) {
    this.data.delete(key);
  }
}

async function mountPanel() {
  let vm;
  const Harness = {
    ...LazarusRecovery,
    created() {
      LazarusRecovery.created.call(this);
      vm = this;
    },
  };
  await renderToString(createSSRApp(Harness));
  return vm;
}

const saved = {};
let net;
let storeBackup;
let full;
let clobber;
let relay;

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  for (const key of ["pubkey", "secretKey", "signingMethod", "userRelayList", "userProfile"]) {
    saved[key] = nostrService[key];
  }
  nostrService.ownEvents.clear();
  nostrService.signingMethod = "nsec";
  nostrService.secretKey = secretKey;
  nostrService.pubkey = pubkey;
  nostrService.userRelayList = {
    bothRelays: [WRITE],
    readRelays: [],
    writeRelays: [],
    lastUpdated: 100,
  };

  full = followList(1000, 1000);
  clobber = followList(10, 2000);
  relay = { mode: "answer", events: [full, clobber], publish: "accept" };
  net = new FakeNetwork().set(WRITE, relay);
  setLazarusSocketFactory(net.factory);
  storeBackup = vi.spyOn(backupService, "storeBackup").mockResolvedValue();
});

afterEach(async () => {
  // Let any background rescan finish on the fake network.
  await new Promise((resolve) => setTimeout(resolve, 0));
  setLazarusSocketFactory();
  storeBackup.mockRestore();
  Object.assign(nostrService, saved);
  nostrService.ownEvents.clear();
  delete globalThis.localStorage;
});

async function reviewRecommended() {
  const vm = await mountPanel();
  const scan = await vm.runScan(3);
  expect(scan.currentConfirmed).toBe(true);
  expect(scan.recommended.event.id).toBe(full.id);
  await vm.openReview(3, scan.recommended);
  expect(vm.review.blockers).toEqual([]);
  return vm;
}

describe("restoring from relay history", () => {
  it("publishes the chosen version verbatim and updates every local copy", async () => {
    const vm = await reviewRecommended();
    const before = Math.floor(Date.now() / 1000);
    await vm.confirmRestore(false);

    expect(vm.review.status).toBe("published");
    expect(net.published).toHaveLength(1);
    const { url, event } = net.published[0];
    expect(url).toBe(WRITE);
    expect(verifyEvent(event)).toBe(true);
    expect(event.pubkey).toBe(pubkey);
    expect(event.kind).toBe(3);
    expect(event.tags).toEqual(full.tags);
    expect(event.content).toBe(full.content);
    expect(event.created_at).toBeGreaterThanOrEqual(Math.max(before, clobber.created_at + 1));

    // The replaced version is kept verbatim on the device and in Backup History.
    expect(listArchive(pubkey, 3).map((entry) => entry.event.id)).toEqual([clobber.id]);
    expect(storeBackup).toHaveBeenCalledTimes(1);
    const backup = storeBackup.mock.calls[0][0];
    expect(backup.followCount).toBe(10);
    expect(backup.notes).toBe("Auto-snapshot before relay history restore");

    // A purge builds on the restore, and a later scan won't call it a clobber.
    expect(nostrService.ownEvents.get(3).id).toBe(event.id);
    expect(getDeliberateEditIds(pubkey).has(event.id)).toBe(true);

    // The panel rescans on its own and finds the restore in place.
    await vi.waitFor(() => expect(vm.kinds[3].phase).toBe("done"));
    expect(vm.kinds[3].scan.current.event.id).toBe(event.id);
    expect(vm.kinds[3].scan.recommended).toBeUndefined();
  });

  it("re-reviews instead of publishing when the list changed after the review opened", async () => {
    const vm = await reviewRecommended();
    const newer = followList(12, 2500);
    relay.events.push(newer);
    await vm.confirmRestore(false);

    expect(net.published).toHaveLength(0);
    expect(vm.review.status).toBe("review");
    expect(vm.review.changedSinceReview).toBe(true);
    expect(vm.review.current.id).toBe(newer.id);
  });

  it("offers an override only after two failed checks, then publishes without one", async () => {
    const vm = await reviewRecommended();
    relay.mode = "close-request";

    await vm.confirmRestore(false);
    expect(vm.review.status).toBe("unconfirmed");
    expect(vm.review.attempts).toBe(1);
    await vm.confirmRestore(false);
    expect(vm.review.attempts).toBe(2);
    expect(net.published).toHaveLength(0);

    await vm.confirmRestore(true);
    expect(vm.review.status).toBe("published");
    expect(net.published).toHaveLength(1);
    expect(net.published[0].event.created_at).toBeGreaterThan(clobber.created_at);
  });

  it("re-reviews against this session's own copy when relays lag behind it", async () => {
    const vm = await reviewRecommended();
    // A purge this session made that the write relay hasn't caught up with.
    const ownPurge = followList(900, Math.floor(Date.now() / 1000) + 600);
    nostrService.rememberOwnEvent(ownPurge);
    await vm.confirmRestore(false);

    expect(net.published).toHaveLength(0);
    expect(vm.review.status).toBe("review");
    expect(vm.review.changedSinceReview).toBe(true);
    expect(vm.review.current.id).toBe(ownPurge.id);

    await vm.confirmRestore(false);
    expect(vm.review.status).toBe("published");
    const restored = net.published[0].event;
    expect(restored.created_at).toBe(ownPurge.created_at + 1);
    expect(nostrService.ownEvents.get(3).id).toBe(restored.id);
  });

  it("dates an override after this session's own copy too", async () => {
    const vm = await reviewRecommended();
    relay.mode = "close-request";
    const ownPurge = followList(900, Math.floor(Date.now() / 1000) + 600);
    nostrService.rememberOwnEvent(ownPurge);

    await vm.confirmRestore(false);
    expect(vm.review.current.id).toBe(ownPurge.id);
    await vm.confirmRestore(false);
    await vm.confirmRestore(false);
    expect(vm.review.status).toBe("unconfirmed");
    expect(vm.review.attempts).toBe(2);

    await vm.confirmRestore(true);
    expect(vm.review.status).toBe("published");
    expect(net.published[0].event.created_at).toBe(ownPurge.created_at + 1);
  });

  it("changes nothing locally when no write relay accepts", async () => {
    const vm = await reviewRecommended();
    relay.publish = "reject";
    await vm.confirmRestore(false);

    expect(vm.review.status).toBe("failed");
    expect(vm.review.writeResults[0].status).toBe("rejected");
    expect(nostrService.ownEvents.has(3)).toBe(false);
    expect(getDeliberateEditIds(pubkey).size).toBe(0);
  });

  it("refuses to sign when the signer holds a different account", async () => {
    const vm = await reviewRecommended();
    nostrService.secretKey = generateSecretKey();
    await vm.confirmRestore(false);

    expect(net.published).toHaveLength(0);
    expect(vm.review.status).toBe("review");
    expect(vm.review.error).toMatch(/belongs to another account/);
  });
});

describe("restoring a relay list", () => {
  it("publishes to the restored list's write relays and rebuilds the relay plan", async () => {
    const sign = (tags, createdAt) =>
      finalizeEvent({ kind: 10002, created_at: createdAt, tags, content: "" }, secretKey);
    const old = sign([["r", OLD_WRITE]], 1000);
    const now = sign([["r", WRITE]], 2000);
    relay.events.push(old, now);
    const oldRelay = { mode: "answer", events: [], publish: "accept" };
    net.set(OLD_WRITE, oldRelay);

    const vm = await mountPanel();
    const scan = await vm.runScan(10002);
    const planBefore = vm.relaySource();
    await vm.openReview(10002, scan.candidates.find((c) => c.event.id === old.id));
    await vm.confirmRestore(false);

    expect(vm.review.status).toBe("published");
    // Success is judged on the relays the restored list names.
    expect(vm.review.writeResults.map((r) => r.url)).toEqual([OLD_WRITE]);
    await vi.waitFor(() => expect(vm.review.extraPending).toBe(false));
    // The relays it replaces get a copy too, so they stop serving the old one.
    expect(vm.review.extraResults.map((r) => r.url)).toEqual([WRITE]);

    expect(nostrService.userRelayList.bothRelays).toEqual([OLD_WRITE]);
    expect(vm.relaySource()).not.toBe(planBefore);
  });
});

describe("the app's local copies after a restore", () => {
  beforeEach(() => {
    globalThis.window = new EventTarget();
  });

  afterEach(() => {
    delete globalThis.window;
  });

  it("replaces the whole profile, its cache, and tells the header", () => {
    nostrService.userProfile = { name: "old", about: "old bio", picture: "https://x/old.png" };
    const heard = [];
    window.addEventListener("user-profile-loaded", (event) => heard.push(event.detail));
    const signed = finalizeEvent(
      { kind: 0, created_at: 5000, tags: [], content: JSON.stringify({ name: "restored" }) },
      secretKey,
    );
    applyRestoreLocally(signed);

    expect(nostrService.userProfile.name).toBe("restored");
    expect(nostrService.userProfile.about).toBeUndefined();
    expect(nostrService.userProfile.picture).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(`profile_${pubkey}`)).name).toBe("restored");
    expect(heard).toHaveLength(1);
    expect(heard[0].name).toBe("restored");
    expect(nostrService.ownEvents.get(0).id).toBe(signed.id);
  });

  it("replaces the relay list", () => {
    const signed = finalizeEvent(
      { kind: 10002, created_at: 5000, tags: [["r", OLD_WRITE, "write"], ["r", WRITE]], content: "" },
      secretKey,
    );
    applyRestoreLocally(signed);
    expect(nostrService.userRelayList.writeRelays).toEqual([OLD_WRITE]);
    expect(nostrService.userRelayList.bothRelays).toEqual([WRITE]);
  });
});
