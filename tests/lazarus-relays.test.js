import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import {
  getLazarusScanPlan,
  createLazarusRelaySource,
  fetchLatestVersions,
  fetchLazarusVersionsFrom,
  LAZARUS_ARCHIVAL_RELAYS,
  probeRelay,
  publishLazarusRecovery,
  publishToRelay,
  readLazarusCurrent,
  requestFromRelay,
  requestFromRelays,
  resolveLazarusRelays,
  setLazarusSocketFactory,
} from "../src/lib/lazarus/relays.js";
import {
  lazarusScanReachedNoRelay,
  loadOlderLazarusVersions,
  mergeLazarusRetry,
  scanLazarusKind,
} from "../src/lib/lazarus/recovery.js";
import { getLazarusKindProfile } from "../src/lib/lazarus/registry.js";

const secretKey = generateSecretKey();

const pubkey = getPublicKey(secretKey);

const otherKey = generateSecretKey();

function signed(kind, createdAt, tags = [], key = secretKey) {
  return finalizeEvent({ kind, created_at: createdAt, tags, content: "" }, key);
}

function followList(count, createdAt) {
  return signed(3, createdAt, Array.from({ length: count }, (_, i) => [
    "p",
    i.toString(16).padStart(64, "0"),
  ]));
}

function matches(event, filter, honorUntil) {
  if (filter.kinds && !filter.kinds.includes(event.kind))
    return false;
  if (filter.authors && !filter.authors.includes(event.pubkey))
    return false;
  if (honorUntil &&
    filter.until !== undefined &&
    event.created_at > filter.until) {
    return false;
  }
  return true;
}

class FakeNetwork {
  relays = new Map();
  open = 0;
  maxOpen = 0;
  requests = [];
  published = [];
  closeMessages = 0;
  set(url, relay) {
    this.relays.set(url, relay);
    return this;
  }
  factory = (url) => new FakeSocket(this, url);
}

class FakeSocket {
  net;
  url;
  readyState = 0;
  onopen = null;
  onmessage = null;
  onerror = null;
  onclose = null;
  relay;
  constructor(net, url) {
    this.net = net;
    this.url = url;
    this.relay = net.relays.get(url) ?? { mode: "refuse" };
    queueMicrotask(() => {
      if (this.readyState !== 0)
        return;
      if (this.relay.mode === "refuse") {
        this.readyState = 3;
        this.onerror?.({});
        this.onclose?.({});
        return;
      }
      this.readyState = 1;
      net.open += 1;
      net.maxOpen = Math.max(net.maxOpen, net.open);
      this.onopen?.({});
    });
  }
  send(data) {
    const message = JSON.parse(data);
    if (message[0] === "REQ") {
      const [, subId, ...filters] = message;
      this.net.requests.push({ url: this.url, filters });
      queueMicrotask(() => this.answer(subId, filters));
    }
    else if (message[0] === "EVENT") {
      const event = message[1];
      this.net.published.push({ url: this.url, event });
      queueMicrotask(() => {
        if (this.relay.publish === "accept")
          this.emit(["OK", event.id, true, ""]);
        if (this.relay.publish === "reject") {
          this.emit(["OK", event.id, false, this.relay.publishMessage ?? ""]);
        }
      });
    }
    else if (message[0] === "CLOSE") {
      this.net.closeMessages += 1;
    }
  }
  answer(subId, filters) {
    const { mode = "answer", honorUntil = true } = this.relay;
    if (mode === "silent")
      return;
    if (mode === "close-request") {
      this.emit(["CLOSED", subId, this.relay.closedReason ?? "blocked"]);
      return;
    }
    for (const filter of filters) {
      (this.relay.events ?? [])
        .filter((event) => matches(event, filter, honorUntil))
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, filter.limit ?? 500)
        .forEach((event) => this.emit(["EVENT", subId, event]));
    }
    if (mode === "drop-after-events") {
      this.drop();
      return;
    }
    this.emit(["EOSE", subId]);
  }
  emit(data) {
    if (this.readyState === 1)
      this.onmessage?.({ data: JSON.stringify(data) });
  }
  drop() {
    if (this.readyState !== 1)
      return;
    this.readyState = 3;
    this.net.open -= 1;
    this.onerror?.({});
    this.onclose?.({});
  }
  close() {
    if (this.readyState === 1)
      this.net.open -= 1;
    this.readyState = 3;
  }
}

let net;

beforeEach(() => {
  net = new FakeNetwork();
  setLazarusSocketFactory(net.factory);
});

afterEach(() => {
  setLazarusSocketFactory();
  vi.useRealTimers();
});

const filter = { kinds: [3], authors: [pubkey], limit: 50 };

describe("requestFromRelay", () => {
  it("answers on EOSE, returns the events, and closes the socket", async () => {
    const version = followList(3, 1000);
    net.set("wss://a", { events: [version] });
    const answer = await requestFromRelay("wss://a", filter);
    expect(answer.outcome).toBe("answered");
    expect(answer.events.map((e) => e.id)).toEqual([version.id]);
    expect(net.open).toBe(0);
    expect(net.closeMessages).toBe(1);
  });

  it("reports a refused connection as failed, never as an empty answer", async () => {
    const answer = await requestFromRelay("wss://down", filter);
    expect(answer.outcome).toBe("failed");
    expect(answer.events).toEqual([]);
  });

  it("reports a relay that closes the request as failed, with its reason", async () => {
    net.set("wss://paid", {
      mode: "close-request",
      closedReason: "auth-required: sign in first",
    });
    const answer = await requestFromRelay("wss://paid", filter);
    expect(answer.outcome).toBe("failed");
    expect(answer.reason).toBe("auth-required: sign in first");
  });

  it("keeps versions sent before the connection dropped", async () => {
    const version = followList(3, 1000);
    net.set("wss://flaky", { events: [version], mode: "drop-after-events" });
    const answer = await requestFromRelay("wss://flaky", filter);
    expect(answer.outcome).toBe("failed");
    expect(answer.events.map((e) => e.id)).toEqual([version.id]);
  });

  it("times out a relay that never finishes, and closes it", async () => {
    vi.useFakeTimers();
    net.set("wss://stalled", { mode: "silent" });
    const pending = requestFromRelay("wss://stalled", filter, 6000);
    await vi.advanceTimersByTimeAsync(6000);
    expect((await pending).outcome).toBe("timed-out");
    expect(net.open).toBe(0);
  });

  it("fails a canceled request", async () => {
    net.set("wss://stalled", { mode: "silent" });
    const controller = new AbortController();
    const pending = requestFromRelay("wss://stalled", filter, 6000, controller.signal);
    await Promise.resolve();
    controller.abort();
    const answer = await pending;
    expect(answer.outcome).toBe("failed");
    expect(answer.reason).toBe("canceled");
    expect(net.open).toBe(0);
  });

  it("reports a real refused TCP connection as failed", async () => {
    setLazarusSocketFactory();
    expect(typeof WebSocket).toBe("function");
    const answer = await requestFromRelay("ws://127.0.0.1:1", filter, 5000);
    expect(answer.outcome).toBe("failed");
    expect(answer.reason).toMatch(/^connection (error|closed)$/);
  });
});

describe("requestFromRelays", () => {
  it("never holds more sockets open than the concurrency limit", async () => {
    const urls = Array.from({ length: 30 }, (_, i) => `wss://r${i}`);
    urls.forEach((url) => net.set(url, { events: [] }));
    const answers = await requestFromRelays(urls, () => filter, {
      concurrency: 5,
    });
    expect(answers.map((a) => a.url)).toEqual(urls);
    expect(answers.every((a) => a.outcome === "answered")).toBe(true);
    expect(net.maxOpen).toBe(5);
    expect(net.open).toBe(0);
  });
});

const config = {
  defaultRelays: ["wss://default-1", "wss://default-2"],
  archivalRelays: ["wss://archive"],
};

describe("resolveLazarusRelays", () => {
  it("takes the newest relay list across relays", async () => {
    net
      .set("wss://default-1", {
      events: [signed(10002, 1000, [["r", "wss://old"]])],
    })
      .set("wss://default-2", {
      events: [
        signed(10002, 2000, [
          ["r", "wss://new", "write"],
          ["r", "wss://in", "read"],
        ]),
      ],
    })
      .set("wss://archive", { events: [] });
    expect(await resolveLazarusRelays(pubkey, config)).toEqual({
      read: ["wss://in"],
      write: ["wss://new"],
      relayList: "found",
    });
  });

  it("prefers the app's own copy when it is newer", async () => {
    net.set("wss://default-1", {
      events: [signed(10002, 1000, [["r", "wss://old"]])],
    });
    const own = { read: [], write: ["wss://mine"], createdAt: 5000 };
    const relays = await resolveLazarusRelays(pubkey, {
      ...config,
      ownRelayList: own,
    });
    expect(relays.write).toEqual(["wss://mine"]);
    const older = { ...own, createdAt: 10 };
    const newer = await resolveLazarusRelays(pubkey, {
      ...config,
      ownRelayList: older,
    });
    expect(newer.write).toEqual(["wss://old"]);
  });

  it("marks a list relays answered without as missing, and labels the defaults", async () => {
    net.set("wss://default-1", { events: [] });
    expect(await resolveLazarusRelays(pubkey, config)).toEqual({
      read: [],
      write: ["wss://default-1", "wss://default-2"],
      relayList: "missing",
    });
  });

  it("treats a list naming no write relays as missing", async () => {
    net.set("wss://default-1", {
      events: [signed(10002, 1000, [["r", "wss://reader", "read"]])],
    });
    const relays = await resolveLazarusRelays(pubkey, config);
    expect(relays.relayList).toBe("missing");
    expect(relays.read).toEqual(["wss://reader"]);
  });

  it("never substitutes defaults when no relay answered and there is no copy", async () => {
    expect(await resolveLazarusRelays(pubkey, config)).toEqual({
      read: [],
      write: [],
      relayList: "unknown",
    });
    const own = { read: [], write: ["wss://mine"], createdAt: 1 };
    const withCopy = await resolveLazarusRelays(pubkey, {
      ...config,
      ownRelayList: own,
    });
    expect(withCopy).toEqual({
      read: [],
      write: ["wss://mine"],
      relayList: "found",
    });
  });

  it("ignores relay lists signed by someone else", async () => {
    net.set("wss://default-1", {
      events: [signed(10002, 9999, [["r", "wss://evil"]], otherKey)],
    });
    expect((await resolveLazarusRelays(pubkey, config)).relayList).toBe("missing");
  });
});

describe("scanning through the relay source", () => {
  const writeRelayList = signed(10002, 500, [
    ["r", "wss://write"],
    ["r", "wss://read", "read"],
  ]);
  it("scans the user's relays, the defaults, and the archival set once each", async () => {
    net.set("wss://default-1", { events: [writeRelayList] });
    const plan = await getLazarusScanPlan(pubkey, {
      ...config,
      archivalRelays: [...LAZARUS_ARCHIVAL_RELAYS, "wss://write/"],
    });
    expect(plan.relays).toEqual(expect.arrayContaining([
      "wss://write",
      "wss://read",
      "wss://default-2",
      "wss://hist.nostr.land",
    ]));
    expect(new Set(plan.relays).size).toBe(plan.relays.length);
  });

  it("confirms current only when a write relay answered", async () => {
    const full = followList(40, 1000);
    const clobbered = followList(3, 2000);
    net
      .set("wss://default-1", { events: [writeRelayList] })
      .set("wss://archive", { events: [full, clobbered] })
      .set("wss://write", { events: [clobbered] });
    const confirmed = await scanLazarusKind(3, pubkey, createLazarusRelaySource(config));
    expect(confirmed.currentConfirmed).toBe(true);
    expect(confirmed.recommended?.event.id).toBe(full.id);
    expect(confirmed.writeRelays).toEqual(["wss://write"]);
    expect(confirmed.relayList).toBe("found");
    net.set("wss://write", { mode: "refuse" });
    const refused = await scanLazarusKind(3, pubkey, createLazarusRelaySource(config));
    expect(refused.relayOutcomes?.["wss://write"]).toBe("failed");
    expect(refused.currentConfirmed).toBe(false);
    expect(refused.recommended).toBeUndefined();
    net.set("wss://write", {
      mode: "close-request",
      closedReason: "auth-required: pay",
    });
    const gated = await scanLazarusKind(3, pubkey, createLazarusRelaySource(config));
    expect(gated.relayOutcomes?.["wss://write"]).toBe("failed");
    expect(gated.currentConfirmed).toBe(false);
  });

  it("looks the relay list up once per source, but never keeps an unknown one", async () => {
    const lookups = () => net.requests.filter((r) => r.filters.some((f) => f.kinds?.includes(10002))).length;
    net
      .set("wss://default-1", { events: [writeRelayList] })
      .set("wss://archive", { events: [followList(3, 1000)] });
    const source = createLazarusRelaySource(config);
    await scanLazarusKind(3, pubkey, source);
    const afterFirst = lookups();
    await scanLazarusKind(10000, pubkey, source);
    expect(lookups()).toBe(afterFirst);
    const offline = new FakeNetwork();
    setLazarusSocketFactory(offline.factory);
    const unknownSource = createLazarusRelaySource(config);
    await expect(scanLazarusKind(3, pubkey, unknownSource)).rejects.toThrow();
    offline.set("wss://default-1", { events: [writeRelayList] });
    const recovered = await scanLazarusKind(3, pubkey, unknownSource);
    expect(recovered.relayList).toBe("found");
  });

  it("retries only the relays that failed, and confirms current once one answers", async () => {
    const full = followList(40, 1000);
    const clobbered = followList(3, 2000);
    net
      .set("wss://default-1", { events: [writeRelayList] })
      .set("wss://archive", { events: [full, clobbered] })
      .set("wss://write", { mode: "refuse" });
    const profile = getLazarusKindProfile(3);
    const scan = await scanLazarusKind(3, pubkey, createLazarusRelaySource(config));
    expect(scan.currentConfirmed).toBe(false);
    net.set("wss://write", { events: [clobbered] });
    net.requests = [];
    const failed = Object.entries(scan.relayOutcomes ?? {})
      .filter(([, outcome]) => outcome !== "answered")
      .map(([url]) => url);
    const retry = await fetchLazarusVersionsFrom(3, pubkey, failed, config);
    const asked = net.requests.map((r) => r.url);
    expect(asked).toContain("wss://write");
    expect(asked.every((url) => failed.includes(url))).toBe(true);
    expect(asked).not.toContain("wss://archive");
    const merged = mergeLazarusRetry(profile, scan, retry);
    expect(merged.relayOutcomes?.["wss://write"]).toBe("answered");
    expect(merged.currentConfirmed).toBe(true);
    expect(merged.recommended?.event.id).toBe(full.id);
    expect(merged.candidates.find((c) => c.event.id === clobbered.id)?.foundOn).toEqual(expect.arrayContaining(["wss://archive", "wss://write"]));
  });

  it("counts only valid versions: signed, by the account, of the kind", async () => {
    const valid = followList(5, 1000);
    const foreign = signed(3, 1001, [], otherKey);
    const wrongKind = signed(10000, 1002);
    const forged = Array.from({ length: 50 }, (_, i) => ({
      ...followList(1, 900 + i),
      content: "tampered",
    }));
    net
      .set("wss://default-1", { events: [writeRelayList] })
      .set("wss://archive", { events: [valid, foreign, wrongKind] })
      .set("wss://write", { events: forged });
    const scan = await scanLazarusKind(3, pubkey, createLazarusRelaySource(config));
    expect(scan.candidates.map((c) => c.event.id)).toEqual([valid.id]);
    expect(scan.respondingRelays).toEqual(["wss://archive"]);
    expect(scan.olderCursors).toEqual({});
  });

  it("pages back from a relay that filled a page", async () => {
    const history = Array.from({ length: 70 }, (_, i) => followList(10, 1000 + i));
    net
      .set("wss://default-1", { events: [writeRelayList] })
      .set("wss://archive", { events: history });
    const source = createLazarusRelaySource(config);
    const profile = getLazarusKindProfile(3);
    const scan = await scanLazarusKind(3, pubkey, source);
    expect(scan.candidates).toHaveLength(50);
    expect(scan.olderCursors).toEqual({ "wss://archive": 1020 });
    const older = await loadOlderLazarusVersions(profile, scan, pubkey, source);
    expect(older.candidates).toHaveLength(70);
    expect(older.olderCursors).toEqual({});
  });

  it("stops paging a relay that ignores until", async () => {
    const history = Array.from({ length: 70 }, (_, i) => followList(10, 1000 + i));
    net
      .set("wss://default-1", { events: [writeRelayList] })
      .set("wss://archive", { events: history, honorUntil: false });
    const source = createLazarusRelaySource(config);
    const scan = await scanLazarusKind(3, pubkey, source);
    const older = await loadOlderLazarusVersions(getLazarusKindProfile(3), scan, pubkey, source);
    expect(older.candidates).toHaveLength(50);
    expect(older.olderCursors).toEqual({});
  });

  it("fails a scan no relay answered, but shows versions that arrived first", async () => {
    await expect(scanLazarusKind(3, pubkey, createLazarusRelaySource(config))).rejects.toThrow("No relay answered the scan");
    const partial = followList(5, 1000);
    net.set("wss://archive", { events: [partial], mode: "drop-after-events" });
    const scan = await scanLazarusKind(3, pubkey, createLazarusRelaySource(config));
    expect(scan.candidates.map((c) => c.event.id)).toEqual([partial.id]);
    expect(lazarusScanReachedNoRelay(scan)).toBe(true);
    expect(scan.relayList).toBe("unknown");
  });
});

describe("readLazarusCurrent", () => {
  it("tells failed reads from empty ones and drops foreign versions", async () => {
    const newer = followList(6, 2000);
    net
      .set("wss://w1", { events: [signed(3, 3000, [], otherKey)] })
      .set("wss://w2", { events: [newer] });
    const answers = await readLazarusCurrent(3, pubkey, [
      "wss://w1",
      "wss://w2",
      "wss://w3",
    ]);
    expect(answers.map(({ url, events, answered }) => ({
      url,
      ids: events.map((e) => e.id),
      answered,
    }))).toEqual([
      { url: "wss://w1", ids: [], answered: true },
      { url: "wss://w2", ids: [newer.id], answered: true },
      { url: "wss://w3", ids: [], answered: false },
    ]);
  });
});

describe("publishing", () => {
  const event = followList(3, 1000);
  it("reports each relay's answer", async () => {
    vi.useFakeTimers();
    net
      .set("wss://ok", { publish: "accept" })
      .set("wss://no", {
      publish: "reject",
      publishMessage: "blocked: not a member",
    })
      .set("wss://slow", { publish: "silent" });
    const results = Promise.all([
      publishToRelay("wss://ok", event),
      publishToRelay("wss://no", event),
      publishToRelay("wss://down", event),
      publishToRelay("wss://slow", event, 8000),
    ]);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await results).toEqual([
      { url: "wss://ok", status: "accepted", message: undefined },
      { url: "wss://no", status: "rejected", message: "blocked: not a member" },
      { url: "wss://down", status: "failed", message: "connection error" },
      { url: "wss://slow", status: "timed-out", message: undefined },
    ]);
    expect(net.open).toBe(0);
  });

  it("succeeds when one write relay accepts, then sends the extras", async () => {
    net
      .set("wss://w1", { publish: "reject" })
      .set("wss://w2", { publish: "accept" })
      .set("wss://extra", { publish: "accept" });
    const outcome = await publishLazarusRecovery(event, ["wss://w1", "wss://w2"], ["wss://extra", "wss://w1"]);
    expect(outcome.accepted).toBe(true);
    expect((await outcome.extra).map((r) => r.url)).toEqual(["wss://extra"]);
  });

  it("fails when no write relay accepts, and leaves the extras alone", async () => {
    net
      .set("wss://w1", { publish: "reject" })
      .set("wss://extra", { publish: "accept" });
    const outcome = await publishLazarusRecovery(event, ["wss://w1"], ["wss://extra"]);
    expect(outcome.accepted).toBe(false);
    expect(await outcome.extra).toEqual([]);
    expect(net.published.map((p) => p.url)).toEqual(["wss://w1"]);
    await expect(publishLazarusRecovery(event, [])).rejects.toThrow();
  });
});

describe("probeRelay", () => {
  it("tells live relays from dead and stalled ones", async () => {
    net.set("wss://up", { events: [] });
    expect(await probeRelay("wss://up")).toBe("live");
    expect(await probeRelay("wss://down")).toBe("dead");
    expect(await probeRelay("not a relay")).toBe("dead");
  });
});

describe("fetchLatestVersions", () => {
  it("returns the newest version of each kind across relays", async () => {
    const oldProfile = signed(0, 1000);
    const newProfile = signed(0, 2000);
    const follows = followList(2, 1500);
    net
      .set("wss://a", { events: [oldProfile, follows] })
      .set("wss://b", { events: [newProfile] });
    const { events } = await fetchLatestVersions(pubkey, [0, 3, 10000], ["wss://a", "wss://b"]);
    expect(events.map((e) => e.id)).toEqual([newProfile.id, follows.id]);
    expect(net.requests[0].filters).toHaveLength(3);
  });
});
