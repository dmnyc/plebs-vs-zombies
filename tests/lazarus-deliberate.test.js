import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyLazarusPrivateTags,
  getDeliberateEditIds,
  getLazarusKindProfile,
  groupLazarusCandidates,
  markDeliberateEdit,
  mergeLazarusRetry,
  rankLazarusCandidates,
  scanLazarusKind,
} from "../src/lib/lazarus/index.js";

// A zombie purge removes follows in bulk, which is the exact shape of a
// clobber. These pin that a purge Plebs vs. Zombies made is not treated as
// damage, while the spec's behavior is unchanged when nothing is marked.

const profile = getLazarusKindProfile(3);

let counter = 0;
function followList(count, createdAt) {
  counter += 1;
  return {
    id: counter.toString(16).padStart(64, "0"),
    pubkey: "test-pubkey",
    created_at: createdAt,
    kind: 3,
    tags: Array.from({ length: count }, (_, i) => ["p", `pk${i}`]),
    content: "",
    sig: "test-sig",
  };
}

const onRelay = (events) => events.map((event) => ({ event, relayUrl: "wss://a" }));
const recommendedCount = (scan) => scan.recommended?.itemCount.count;

describe("deliberate edits in ranking", () => {
  it("reads an unmarked purge as a clobber, which is why marking is needed", () => {
    const before = followList(1000, 1000);
    const purge = followList(800, 2000);
    const scan = rankLazarusCandidates(profile, onRelay([before, purge]));
    expect(recommendedCount(scan)).toBe(1000);
  });

  it("recommends nothing after a purge the user made", () => {
    const before = followList(1000, 1000);
    const purge = followList(800, 2000);
    const scan = rankLazarusCandidates(
      profile,
      onRelay([before, purge]),
      [],
      [],
      new Map(),
      true,
      new Set([purge.id]),
    );
    expect(scan.recommended).toBeUndefined();
  });

  it("recommends the purge result, not the pre-purge list, after a later clobber", () => {
    const before = followList(1000, 1000);
    const purge = followList(800, 2000);
    const clobber = followList(50, 3000);
    const scan = rankLazarusCandidates(
      profile,
      onRelay([before, purge, clobber]),
      [],
      [],
      new Map(),
      true,
      new Set([purge.id]),
    );
    expect(scan.recommended.event.id).toBe(purge.id);
    expect(recommendedCount(scan)).toBe(800);
  });

  it("still catches a clobber that has nothing to do with a purge", () => {
    const full = followList(900, 1000);
    const clobber = followList(10, 2000);
    const unrelatedPurge = followList(700, 500);
    const scan = rankLazarusCandidates(
      profile,
      onRelay([unrelatedPurge, full, clobber]),
      [],
      [],
      new Map(),
      true,
      new Set([unrelatedPurge.id]),
    );
    expect(scan.recommended.event.id).toBe(full.id);
  });

  it("keeps every version visible either way", () => {
    const events = [followList(1000, 1000), followList(800, 2000)];
    const marked = rankLazarusCandidates(
      profile,
      onRelay(events),
      [],
      [],
      new Map(),
      true,
      new Set([events[1].id]),
    );
    expect(marked.candidates).toHaveLength(2);
  });

  it("carries the marks through a scan and every re-rank", async () => {
    const before = followList(1000, 1000);
    const purge = followList(800, 2000);
    const deliberate = new Set([purge.id]);
    const source = {
      fetchVersions: async () => ({
        tagged: onRelay([before, purge]),
        queriedRelays: ["wss://a"],
        respondingRelays: ["wss://a"],
        outcomes: { "wss://a": "answered" },
      }),
    };
    const scan = await scanLazarusKind(3, "test-pubkey", source, deliberate);
    expect(scan.recommended).toBeUndefined();

    // Decrypting a version re-ranks the scan.
    expect(applyLazarusPrivateTags(profile, scan, new Map()).recommended).toBeUndefined();

    // So does merging a retry of relays that failed.
    const retried = mergeLazarusRetry(profile, scan, {
      tagged: [],
      respondingRelays: [],
      outcomes: { "wss://b": "answered" },
    });
    expect(retried.recommended).toBeUndefined();
    expect(retried.deliberateIds.has(purge.id)).toBe(true);
  });

  it("doesn't label a purge as a run of sudden drops", () => {
    const events = [
      followList(1000, 1000),
      followList(990, 1100),
      followList(800, 2000),
      followList(795, 2100),
    ];
    const scan = rankLazarusCandidates(
      profile,
      onRelay(events),
      [],
      [],
      new Map(),
      true,
      new Set([events[2].id]),
    );
    const groups = groupLazarusCandidates(scan, profile).filter(
      (item) => item.type === "group",
    );
    expect(groups.some((group) => group.clobbered)).toBe(false);
  });
});

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

describe("deliberate edit store", () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("keeps marks per account", () => {
    markDeliberateEdit("alice", "e1");
    markDeliberateEdit("bob", "e2");
    expect([...getDeliberateEditIds("alice")]).toEqual(["e1"]);
    expect([...getDeliberateEditIds("bob")]).toEqual(["e2"]);
    expect(getDeliberateEditIds("carol").size).toBe(0);
  });

  it("records each edit once", () => {
    markDeliberateEdit("alice", "e1");
    markDeliberateEdit("alice", "e1");
    expect(getDeliberateEditIds("alice").size).toBe(1);
  });

  it("keeps the newest 500 per account", () => {
    for (let i = 0; i < 510; i++) markDeliberateEdit("alice", `e${i}`);
    const ids = getDeliberateEditIds("alice");
    expect(ids.size).toBe(500);
    expect(ids.has("e0")).toBe(false);
    expect(ids.has("e509")).toBe(true);
  });

  it("ignores missing input and survives corrupt storage", () => {
    markDeliberateEdit("", "e1");
    markDeliberateEdit("alice", "");
    expect(getDeliberateEditIds("alice").size).toBe(0);
    globalThis.localStorage.setItem("plebs-vs-zombies-deliberate-edits", "{bad");
    expect(getDeliberateEditIds("alice").size).toBe(0);
  });

  it("works without storage", () => {
    delete globalThis.localStorage;
    expect(() => markDeliberateEdit("alice", "e1")).not.toThrow();
    expect(getDeliberateEditIds("alice").size).toBe(0);
  });
});
