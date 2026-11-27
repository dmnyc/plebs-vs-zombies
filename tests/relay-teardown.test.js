import { beforeEach, describe, expect, it, vi } from "vitest";

const nostrService = (await import("../src/services/nostrService.js")).default;

const PUBKEY = "a".repeat(64);
const DEFAULT_RELAY = "wss://default.example";

// Fake NDK: a pool of relay doubles, plus subscriptions the test drives by hand.
function installFakeNdk() {
  const pool = { relays: new Map() };
  const subs = [];
  const addRelay = (url) => {
    const relay = { url, disconnect: vi.fn() };
    pool.relays.set(url, relay);
    return relay;
  };
  nostrService.relays = [DEFAULT_RELAY];
  nostrService.ndk = {
    pool,
    subscribe: vi.fn(() => {
      const handlers = {};
      const sub = {
        on: (name, fn) => { handlers[name] = fn; },
        stop: vi.fn(),
        fire: (name, arg) => handlers[name]?.(arg),
      };
      subs.push(sub);
      return sub;
    }),
  };
  return { pool, subs, addRelay };
}

describe("fetchUserActivitySingle relay cleanup", () => {
  let fake;
  beforeEach(() => {
    fake = installFakeNdk();
  });

  it("keeps a shared relay connected until the last concurrent lookup finishes", async () => {
    const shared = fake.addRelay("wss://shared.example");

    const first = nostrService.fetchUserActivitySingle(PUBKEY, ["wss://Shared.example"]);
    const second = nostrService.fetchUserActivitySingle(PUBKEY, ["wss://shared.example"]);

    fake.subs[0].fire("eose");
    await first;
    // Another lookup is still in flight on this relay: must not disconnect.
    expect(shared.disconnect).not.toHaveBeenCalled();
    expect(fake.pool.relays.has("wss://shared.example")).toBe(true);

    fake.subs[1].fire("eose");
    await second;
    expect(shared.disconnect).toHaveBeenCalledTimes(1);
    expect(fake.pool.relays.has("wss://shared.example")).toBe(false);
  });

  it("never disconnects the app's default relays", async () => {
    const def = fake.addRelay(DEFAULT_RELAY);
    const lookup = nostrService.fetchUserActivitySingle(PUBKEY, [DEFAULT_RELAY]);
    fake.subs[0].fire("eose");
    await lookup;
    expect(def.disconnect).not.toHaveBeenCalled();
    expect(fake.pool.relays.has(DEFAULT_RELAY)).toBe(true);
  });

  it("releases the relay when the subscription errors", async () => {
    const relay = fake.addRelay("wss://flaky.example");
    const lookup = nostrService.fetchUserActivitySingle(PUBKEY, ["wss://flaky.example"]);
    fake.subs[0].fire("error");
    await lookup;
    expect(relay.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("closeNonPermanentRelays", () => {
  it("sweeps every non-default relay, spares defaults, and resets refcounts", async () => {
    const fake = installFakeNdk();
    const def = fake.addRelay(DEFAULT_RELAY);
    const a = fake.addRelay("wss://a.example");
    const b = fake.addRelay("wss://b.example");

    // Lookup in flight on a — sweep happens mid-flight (user hits Stop).
    const inFlight = nostrService.fetchUserActivitySingle(PUBKEY, ["wss://a.example"]);
    nostrService.closeNonPermanentRelays();

    expect(a.disconnect).toHaveBeenCalledTimes(1);
    expect(b.disconnect).toHaveBeenCalledTimes(1);
    expect(def.disconnect).not.toHaveBeenCalled();
    expect([...fake.pool.relays.keys()]).toEqual([DEFAULT_RELAY]);

    // The swept lookup's own later cleanup must no-op safely, not double-disconnect.
    fake.subs[0].fire("eose");
    await inFlight;
    expect(a.disconnect).toHaveBeenCalledTimes(1);
  });

  it("is a no-op before NDK exists", () => {
    nostrService.ndk = null;
    expect(() => nostrService.closeNonPermanentRelays()).not.toThrow();
  });
});
