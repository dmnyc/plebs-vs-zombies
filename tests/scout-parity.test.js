import { beforeEach, describe, expect, it, vi } from "vitest";

// Scout's own NDK does the relay work; nostrService supplies the shared
// prefilter / cache helpers, which we stub so the test drives the evidence.
const ns = vi.hoisted(() => ({
  applyLivenessPrefilter: vi.fn(async () => 0),
  recordLastSeen: vi.fn(),
  initialize: vi.fn(async () => {}),
  fetchFollowsRelayLists: vi.fn(async () => new Map()),
}));
vi.mock("../src/services/nostrService.js", () => ({ default: ns }));
vi.mock("../src/services/zombieService.js", () => ({ default: {} }));

const scout = (await import("../src/services/scoutService.js")).default;

const pk = (n) => n.toString(16).padStart(64, "0");
const pubkeys = Array.from({ length: 250 }, (_, i) => pk(i + 1)); // 10 batches of 25

function installNdk(fetchEvents) {
  scout.ndk = { fetchEvents };
  scout.initialize = vi.fn(async () => {});
  scout.cancelled = false;
}

beforeEach(() => {
  ns.applyLivenessPrefilter.mockReset().mockResolvedValue(0);
  ns.recordLastSeen.mockReset();
});

describe("getProfilesActivityScout", () => {
  it("runs batches concurrently, capped at 3 lanes", async () => {
    let inFlight = 0;
    let peak = 0;
    installNdk(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return new Set();
    });

    await scout.getProfilesActivityScout(pubkeys);

    expect(peak).toBe(3);
  });

  it("covers every batch exactly once", async () => {
    const seen = [];
    installNdk(async (filter) => {
      seen.push(...filter.authors);
      return new Set();
    });
    await scout.getProfilesActivityScout(pubkeys);
    expect(seen.sort()).toEqual([...pubkeys].sort());
  });

  it("does not query users the prefilter proved alive, and keeps their entry", async () => {
    const alive = new Set(pubkeys.slice(0, 100)); // first four batches fully proven
    ns.applyLivenessPrefilter.mockImplementation(async (keys, map) => {
      for (const k of keys) {
        if (alive.has(k)) map.set(k, [{ id: `lastseen-cache:${k}`, created_at: 1, kind: 0 }]);
      }
      return alive.size;
    });
    const queried = [];
    installNdk(async (filter) => {
      queried.push(...filter.authors);
      return new Set();
    });

    const map = await scout.getProfilesActivityScout(pubkeys);

    expect(queried.some((k) => alive.has(k))).toBe(false);
    expect(queried).toHaveLength(150);
    expect(map.get(pubkeys[0])[0].id).toBe(`lastseen-cache:${pubkeys[0]}`);
  });

  it("collects relay events and persists them to the last-seen cache", async () => {
    installNdk(async (filter) => {
      const who = filter.authors[0];
      return new Set([{ id: "e1", kind: 1, created_at: 1000, author: { pubkey: who } }]);
    });
    const map = await scout.getProfilesActivityScout(pubkeys.slice(0, 25));
    expect(map.get(pubkeys[0])).toEqual([
      { id: "e1", kind: 1, created_at: 1000, pubkey: pubkeys[0] },
    ]);
    expect(ns.recordLastSeen).toHaveBeenCalledTimes(1);
  });

  it("stops claiming batches when cancelled and skips the cache write", async () => {
    let calls = 0;
    installNdk(async () => {
      calls++;
      scout.cancelled = true; // user hits Stop during the first batches
      await new Promise((r) => setTimeout(r, 5));
      return new Set();
    });
    await scout.getProfilesActivityScout(pubkeys);
    expect(calls).toBeLessThanOrEqual(3); // only the lanes already in flight
    expect(ns.recordLastSeen).not.toHaveBeenCalled();
  });
});

describe("analyzeFollows relay retry", () => {
  it("loads relay lists for unresolved users before smart retry", async () => {
    installNdk(async () => new Set());
    scout.getProfilesActivityScout = vi.fn(async (keys) => new Map(keys.map((k) => [k, []])));
    ns.smartRelayRetry = vi.fn(async (keys) => new Map(keys.map((k) => [k, []])));
    ns.aggressiveActivityRetry = vi.fn(async (keys) => new Map(keys.map((k) => [k, []])));
    const order = [];
    ns.fetchFollowsRelayLists.mockImplementation(async () => { order.push("lists"); return new Map(); });
    ns.smartRelayRetry.mockImplementation(async (keys) => { order.push("retry"); return new Map(keys.map((k) => [k, []])); });

    // classification/immunity aren't under test — stop after the retry stage
    scout.addProfileSamples = vi.fn(async () => {});
    await scout.analyzeFollows(pubkeys.slice(0, 3)).catch(() => {});

    expect(ns.fetchFollowsRelayLists).toHaveBeenCalledWith(pubkeys.slice(0, 3));
    expect(order).toEqual(["lists", "retry"]);
  });
});

describe("analyzeFollows fallback gating", () => {
  const now = Math.floor(Date.now() / 1000);
  const staleUser = pk(901);
  const freshUser = pk(902);
  const silentUser = pk(903);

  async function run(smartResult) {
    installNdk(async () => new Set());
    scout.getProfilesActivityScout = vi.fn(
      async (keys) => new Map(keys.map((k) => [k, []])),
    );
    ns.smartRelayRetry = vi.fn(async () => smartResult);
    ns.aggressiveActivityRetry = vi.fn(async (keys) =>
      new Map(keys.map((k) => [k, []])),
    );
    scout.addProfileSamples = vi.fn(async () => {});
    await scout.analyzeFollows([staleUser, freshUser, silentUser]).catch(() => {});
    return ns.aggressiveActivityRetry.mock.calls[0]?.[0] ?? [];
  }

  it("sends users with only stale smart-retry events to the aggressive fallback", async () => {
    const forwarded = await run(
      new Map([
        [staleUser, [{ id: "old", kind: 1, created_at: now - 400 * 86400 }]],
        [freshUser, [{ id: "new", kind: 1, created_at: now - 5 * 86400 }]],
        [silentUser, []],
      ]),
    );
    expect(forwarded).toContain(staleUser); // stale evidence proves nothing
    expect(forwarded).toContain(silentUser);
    expect(forwarded).not.toContain(freshUser); // recent event = proven alive
  });

  it("never replaces newer evidence with staler fallback results", async () => {
    installNdk(async () => new Set());
    const keep = [{ id: "kept", kind: 1, created_at: now - 400 * 86400 }];
    const worse = [{ id: "worse", kind: 1, created_at: now - 500 * 86400 }];
    let captured;
    scout.getProfilesActivityScout = vi.fn(
      async () => new Map([[staleUser, []]]),
    );
    ns.smartRelayRetry = vi.fn(async () => new Map([[staleUser, keep]]));
    ns.aggressiveActivityRetry = vi.fn(async () => new Map([[staleUser, worse]]));
    scout.addProfileSamples = vi.fn(async () => {});
    const zs = (await import("../src/services/zombieService.js")).default;
    zs.classifyZombies = vi.fn((map) => {
      captured = map;
      return { fresh: [], rotting: [], ancient: [], active: [] };
    });
    await scout.analyzeFollows([staleUser]).catch(() => {});
    expect(ns.aggressiveActivityRetry).toHaveBeenCalled(); // stale => still searched
    expect(captured?.get(staleUser)).toEqual(keep); // ...but not downgraded
  });
});
