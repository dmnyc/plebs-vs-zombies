import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import { generateSecretKey, getPublicKey, nip44 } from "nostr-tools";
import nostrService from "../src/services/nostrService.js";
import LazarusRecovery from "../src/components/lazarus/LazarusRecovery.vue";
import LazarusReviewDialog from "../src/components/lazarus/LazarusReviewDialog.vue";
import {
  getLazarusKindProfile,
  getLazarusKindProfiles,
  saveToArchive,
  scanLazarusKind,
} from "../src/lib/lazarus/index.js";

// Renders the recovery panel and its review dialog in each main state, so a
// template that breaks on real data fails here instead of in the browser.

const PK = "ab".repeat(32);
const A = "wss://a.example";
const B = "wss://b.example";
const C = "wss://c.example";

let counter = 0;
const hex = (n) => n.toString(16).padStart(64, "0");

function version(kind, tags, createdAt, content = "") {
  counter += 1;
  return {
    id: hex(1_000_000 + counter),
    pubkey: PK,
    created_at: createdAt,
    kind,
    tags,
    content,
    sig: "ef".repeat(64),
  };
}

const follows = (count) => Array.from({ length: count }, (_, i) => ["p", hex(i + 1)]);

function sourceWith(events) {
  return {
    fetchVersions: async () => ({
      tagged: events.map((event) => ({ event, relayUrl: A })),
      queriedRelays: [A, B, C],
      respondingRelays: [A],
      outcomes: { [A]: "answered", [B]: "answered", [C]: "timed-out" },
      currentConfirmed: true,
      relayList: "found",
      writeRelays: [A],
    }),
  };
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

function text(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

// Real created() first, then the state under test, set through the
// component's own methods where it has them.
async function render(setup) {
  const Harness = {
    ...LazarusRecovery,
    created() {
      LazarusRecovery.created.call(this);
      setup?.(this);
    },
  };
  const context = {};
  const html = await renderToString(createSSRApp(Harness), context);
  return {
    panel: text(html),
    dialog: text(Object.values(context.teleports ?? {}).join("")),
  };
}

const empty = version(3, [], 500);
const junk = [
  ["p", "npub1notahexkey"],
  ["p", ""],
];
const full = version(3, [...follows(1000), ...junk], 1000);
const grown = version(3, follows(1002), 1100);
const purge = version(3, follows(800), 2000);
const clobber = version(3, follows(10), 3000);
const followHistory = [empty, full, grown, purge, clobber];

let savedPubkey;
let savedIsSigningReady;

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  savedPubkey = nostrService.pubkey;
  savedIsSigningReady = nostrService.isSigningReady;
  nostrService.pubkey = PK;
});

afterEach(() => {
  delete globalThis.localStorage;
  nostrService.pubkey = savedPubkey;
  nostrService.isSigningReady = savedIsSigningReady;
});

describe("LazarusRecovery panel", () => {
  it("renders nothing without an account", async () => {
    nostrService.pubkey = null;
    const { panel } = await render();
    expect(panel.trim()).toBe("");
  });

  it("renders the idle state with every everyday kind", async () => {
    const { panel } = await render();
    expect(panel).toContain("Recover from relay history");
    expect(panel).toContain("Scan relays");
    expect(panel).toContain("Your signer isn't connected");
    for (const profile of getLazarusKindProfiles().filter((p) => p.tier < 3)) {
      expect(panel).toContain(profile.name);
    }
  });

  it("renders a finished scan, its relays, and saved versions", async () => {
    nostrService.isSigningReady = () => true;
    const scan = await scanLazarusKind(3, PK, sourceWith(followHistory), new Set([purge.id]));
    saveToArchive([
      { event: full, source: "snapshot", label: "Saved before a restore", savedAt: 1_700_000_000_000 },
      { event: grown, source: "import", label: "backup.json", savedAt: 1_700_000_000_000 },
    ]);
    const { panel } = await render((vm) => {
      vm.kinds = { 3: { phase: "done", scan } };
      vm.showRelays = true;
    });
    expect(panel).toContain("Your current version looks clobbered");
    // The purge was deliberate, so its result is what gets recommended.
    expect(scan.recommended.event.id).toBe(purge.id);
    expect(panel).toContain("800 follows");
    expect(panel).toContain("2 of 3 relays answered");
    expect(panel).toContain("Retry 1 relay");
    expect(panel).toContain("Timed out");
    expect(panel).toContain("Show 1 empty version");
    expect(panel).toContain("Saved on this device (2)");
    expect(panel).toContain("imported from backup.json");
    expect(panel).toContain("Review");
    expect(panel).not.toContain("Your signer isn't connected");
  });

  it("renders a failed scan", async () => {
    const { panel } = await render((vm) => {
      vm.kinds = { 3: { phase: "error", error: "No relay answered the scan" } };
    });
    expect(panel).toContain("The scan failed: no relay answered.");
  });

  it("renders decryption notes on private versions", async () => {
    const mutes = version(10000, [["p", hex(7)]], 1000, "ciphertext?iv=abc");
    const scan = await scanLazarusKind(10000, PK, sourceWith([mutes]));
    const { panel } = await render((vm) => {
      vm.selectedKind = 10000;
      vm.kinds = { 10000: { phase: "done", scan } };
      vm.privateNotes = { [mutes.id]: "failed" };
    });
    expect(panel).toContain("Couldn't decrypt the private items");
  });

  it("doesn't call a version empty when its private items can't be sized", async () => {
    const flagged = version(10000, [], 1000, "A".repeat(200));
    const scan = await scanLazarusKind(10000, PK, sourceWith([flagged, version(10000, [["p", hex(7)]], 2000)]));
    const { panel } = await render((vm) => {
      vm.selectedKind = 10000;
      vm.kinds = { 10000: { phase: "done", scan } };
    });
    expect(panel).toContain("partial count");
    expect(panel).not.toContain("Empty");
  });

  it("shows each version's encryption keys", async () => {
    const keys = version(10044, [["n", "cd".repeat(32)], ["n", "cd".repeat(32)]], 1000);
    const scan = await scanLazarusKind(10044, PK, sourceWith([keys, version(10044, [], 2000)]));
    const { panel } = await render((vm) => {
      vm.selectedKind = 10044;
      vm.kinds = { 10044: { phase: "done", scan } };
    });
    expect(panel).toContain("1 key");
    expect(panel.match(/cdcdcdcdcdcd…cdcdcd/g)).toHaveLength(1);
  });
});

describe("LazarusReviewDialog", () => {
  async function reviewOf(kind, history, chosen, extra = {}, deliberate = new Set()) {
    const scan = await scanLazarusKind(kind, PK, sourceWith(history), deliberate);
    return render((vm) => {
      vm.selectedKind = kind;
      vm.kinds = { [kind]: { phase: "done", scan } };
      vm.review = {
        ...vm.buildReview(getLazarusKindProfile(kind), chosen, scan.current?.event, scan, {
          changedSinceReview: false,
        }),
        ...extra,
      };
    });
  }

  it("warns about purged follows and entries that aren't keys", async () => {
    const { dialog } = await reviewOf(3, followHistory, full, {}, new Set([purge.id]));
    expect(dialog).toContain("Review restore: Follow list");
    expect(dialog).toContain("from before a zombie purge you made");
    // Both still ride along in the restore, so both are warned about...
    expect(dialog).toContain("2 entries in this version aren't valid public keys");
    expect(dialog).toContain("Connect your signer to restore.");
    // ...but a tag with no value isn't an item, so only one is a follow.
    expect(dialog).toContain("Restore 1001 follows");
  });

  it("offers the override only after a second failed check", async () => {
    const answers = [{ url: A, outcome: "timed-out", events: [] }];
    const first = await reviewOf(3, followHistory, grown, {
      status: "unconfirmed",
      attempts: 1,
      rereadAnswers: answers,
    });
    expect(first.dialog).toContain("Couldn't reach any of your write relays");
    expect(first.dialog).toContain("Check again");
    expect(first.dialog).not.toContain("Restore anyway");

    const second = await reviewOf(3, followHistory, grown, {
      status: "unconfirmed",
      attempts: 2,
      rereadAnswers: answers,
    });
    expect(second.dialog).toContain("Restore anyway");
  });

  it("reports each relay's answer after publishing", async () => {
    const { dialog } = await reviewOf(3, followHistory, grown, {
      status: "published",
      writeResults: [
        { url: A, status: "accepted" },
        { url: B, status: "rejected", message: "blocked: invalid pubkey" },
      ],
      extraPending: false,
      extraResults: [{ url: C, status: "accepted" }],
    });
    expect(dialog).toContain("Restored. Accepted by 1 of 2 write relays.");
    expect(dialog).toContain("Rejected: blocked: invalid pubkey");
    expect(dialog).toContain("Also sent to 1 other relay that held older copies: 1 accepted.");
    expect(dialog).toContain("Done");
  });

  it("reports a restore no relay accepted", async () => {
    const { dialog } = await reviewOf(3, followHistory, grown, {
      status: "failed",
      writeResults: [{ url: A, status: "timed-out" }],
      error: "No write relay accepted the restore, so nothing changed.",
    });
    expect(dialog).toContain("No write relay accepted the restore");
    expect(dialog).toContain("Try again");
  });

  it("shows profile field changes", async () => {
    const before = version(0, [], 1000, JSON.stringify({ name: "alice", about: "old bio" }));
    const after = version(0, [], 2000, JSON.stringify({ name: "alice" }));
    const { dialog } = await reviewOf(0, [before, after], before);
    expect(dialog).toContain("Review restore: Profile");
    expect(dialog).toContain("old bio");
    expect(dialog).toMatch(/Restore profile from \w+ \d+, \d{4}/);
  });

  it("asks what to do with an empty encryption key list, with nothing chosen", async () => {
    const keys = version(10044, [["n", "cd".repeat(32)]], 1000);
    const cleared = version(10044, [], 2000);
    const { dialog } = await reviewOf(10044, [keys, cleared], keys);
    expect(dialog).toContain("What do you want?");
    expect(dialog).toContain("Keep my current version");
    expect(dialog).toContain("Restore 1 key");
    expect(dialog).not.toMatch(/checked/);
    // Both endpoints, read in the restore's direction.
    expect(dialog).toContain(
      "This restores 1 NIP-4e encryption key. Clients will encrypt direct messages to it again.",
    );
    expect(dialog).toContain("Your current empty version announces that you don't use NIP-4e.");
  });

  it("describes emptying a key list in the restore's direction too", async () => {
    const cleared = version(10044, [], 1000);
    const keys = version(10044, [["n", "cd".repeat(32)]], 2000);
    const { dialog } = await reviewOf(10044, [cleared, keys], cleared);
    expect(dialog).toContain(
      "This announces that you no longer use NIP-4e; clients stop encrypting direct messages to your keys.",
    );
    expect(dialog).toContain("Your current version lists 1 key that clients encrypt direct messages to.");
    expect(dialog).toContain("Restore empty version");
  });

  it("asks for the shrink confirmation when a profile loses fields, not tags", async () => {
    const lud16 = (value) => JSON.stringify({ name: "plebs", lud16: value });
    const older = version(0, [["client", "Wisp"]], 1000, lud16("plebs@breez.tips"));
    const newer = version(0, [["client", "Wisp iOS"], ["t", "PlebsVsZombies"]], 2000, lud16("plebsvszombies@rizful.com"));
    const retagged = await reviewOf(0, [older, newer], older);
    expect(retagged.dialog).toContain("3 fields change");
    expect(retagged.dialog).not.toContain("I understand");

    const bare = version(0, [], 1000, JSON.stringify({ name: "plebs" }));
    const full = version(0, [], 2000, JSON.stringify({ name: "plebs", banner: "https://b" }));
    const trimmed = await reviewOf(0, [bare, full], bare);
    expect(trimmed.dialog).toContain(
      "I understand this restore leaves me with fewer fields: it removes 1 and adds 0.",
    );
  });

  it("names the side whose private items went uncounted, and confirms for current", async () => {
    const key = nip44.getConversationKey(generateSecretKey(), getPublicKey(generateSecretKey()));
    const secret = [["p", hex(900)]];
    const chosen = version(10000, [["p", hex(1)]], 1000, nip44.encrypt(JSON.stringify(secret), key));
    const current = version(10000, [["p", hex(1)]], 2000, nip44.encrypt(JSON.stringify([["p", hex(901)]]), key));
    const scan = await scanLazarusKind(10000, PK, sourceWith([chosen, current]));
    const { dialog } = await render((vm) => {
      vm.selectedKind = 10000;
      vm.kinds = { 10000: { phase: "done", scan } };
      vm.privateTags = new Map([[chosen.id, secret]]);
      vm.review = vm.buildReview(getLazarusKindProfile(10000), chosen, current, scan, {
        changedSinceReview: false,
      });
    });
    expect(dialog).toContain("Your current version's private items couldn't be decrypted");
    expect(dialog).toContain(
      "I understand this restore replaces private items in my current version that couldn't be counted, and may remove some.",
    );
  });

  it("re-arms the override after every attempt", async () => {
    const scan = await scanLazarusKind(3, PK, sourceWith(followHistory));
    let review;
    await render((vm) => {
      vm.kinds = { 3: { phase: "done", scan } };
      review = {
        ...vm.buildReview(getLazarusKindProfile(3), grown, scan.current.event, scan, {
          changedSinceReview: false,
        }),
        status: "unconfirmed",
        attempts: 2,
      };
    });
    let dialog;
    const confirms = [];
    const Harness = {
      ...LazarusReviewDialog,
      created() {
        dialog = this;
      },
    };
    await renderToString(
      createSSRApp(Harness, { review, onConfirm: (override) => confirms.push(override) }),
    );
    dialog.overrideAck = true;
    dialog.restoreAnyway();
    expect(confirms).toEqual([true]);
    expect(dialog.overrideAck).toBe(false);
  });

  it("offers a reachability check before restoring an old relay list", async () => {
    const old = version(10002, [["r", "wss://old.example"], ["r", "wss://w.example", "write"]], 1000);
    const now = version(10002, [["r", A]], 2000);
    const { dialog } = await reviewOf(10002, [old, now], old);
    expect(dialog).toContain("Old relay lists can point at relays");
    expect(dialog).toContain("Check 2 relays");
  });
});
