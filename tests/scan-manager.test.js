import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The services do real relay work; the manager only cares about their
// progress callbacks and return values, so stub them with controllable fakes.
const hunt = vi.hoisted(() => ({ resolve: null, progress: null }));
const scout = vi.hoisted(() => ({ resolve: null, progress: null, cancelled: false }));

vi.mock("../src/services/zombieService", () => ({
  default: {
    scanForZombies: vi.fn((_fetch, onProgress) => {
      hunt.progress = onProgress;
      return new Promise((r) => { hunt.resolve = r; });
    }),
    scanForZombiesEnhanced: vi.fn(),
  },
}));

vi.mock("../src/services/scoutService", () => ({
  default: {
    get cancelled() { return scout.cancelled; },
    scoutUser: vi.fn((_pubkey, onProgress) => {
      scout.cancelled = false;
      scout.progress = onProgress;
      return new Promise((r) => { scout.resolve = r; });
    }),
    forceShutdown: vi.fn(async () => { scout.cancelled = true; }),
  },
}));

const scanManager = (await import("../src/services/scanManager.js")).default;
const { scanState, SCAN_CANCELLED } = await import("../src/services/scanManager.js");

const alice = { pubkey: "a".repeat(64), name: "alice" };
const bob = { pubkey: "b".repeat(64), name: "bob" };
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  globalThis.localStorage = { getItem: () => null };
  scanManager.clear();
});

afterEach(() => {
  if (scanState.prompt) scanState.prompt.resolve(false);
});

describe("scanManager", () => {
  it("runs a hunt scan, tracks progress, and keeps the result", async () => {
    expect(await scanManager.requestStart("hunt")).toBe(true);
    scanManager.startHunt();
    expect(scanState).toMatchObject({ kind: "hunt", status: "running", seen: false });

    hunt.progress({ total: 10, processed: 4, stage: "Scanning batch 1" });
    expect(scanState.progress).toMatchObject({ total: 10, processed: 4 });

    hunt.resolve({ success: true, zombieCount: 3 });
    await flush();
    expect(scanState.status).toBe("done");
    expect(scanState.result.zombieCount).toBe(3);
    expect(scanState.seen).toBe(false);

    scanManager.markSeen();
    expect(scanState.seen).toBe(true);
  });

  it("asks before a second scan replaces a running one; declining keeps it", async () => {
    scanManager.startHunt();
    const answer = scanManager.requestStart("scout", alice);
    expect(scanState.prompt.message).toMatch(/scanning your follows/);
    expect(scanState.prompt.message).toMatch(/scout alice/);

    scanState.prompt.resolve(false);
    expect(await answer).toBe(false);
    expect(scanState).toMatchObject({ kind: "hunt", status: "running" });
  });

  it("accepting the replace stops the running scan and orphans its late result", async () => {
    scanManager.startHunt();
    const progress = hunt.progress;
    const resolveOld = hunt.resolve;

    const answer = scanManager.requestStart("scout", alice);
    await scanState.prompt.resolve(true);
    expect(await answer).toBe(true);
    expect(scanState.status).toBe("idle");

    // The stopped run's next progress report aborts it…
    expect(() => progress({ processed: 5 })).toThrow(SCAN_CANCELLED);

    // …and a late result can't overwrite the new scan.
    scanManager.startScout(alice);
    resolveOld({ success: true, zombieCount: 99 });
    await flush();
    expect(scanState).toMatchObject({ kind: "scout", status: "running" });
  });

  it("re-requesting the scout that is already running attaches to it", async () => {
    scanManager.startScout(alice);
    expect(await scanManager.requestStart("scout", alice)).toBe("attach");
    expect(scanState.prompt).toBeNull();

    const answer = scanManager.requestStart("scout", bob);
    expect(scanState.prompt.message).toMatch(/scouting alice/);
    scanState.prompt.resolve(false);
    expect(await answer).toBe(false);
  });

  it("stopping a scout shuts the scout service down and frees the slot", async () => {
    scanManager.startScout(alice);
    await scanManager.cancel();
    expect(scout.cancelled).toBe(true);
    expect(scanState.status).toBe("idle");

    scout.resolve({ success: false });
    await flush();
    expect(scanState.status).toBe("idle");
    expect(await scanManager.requestStart("hunt")).toBe(true);
  });

  it("records a failed scan", async () => {
    scanManager.startScout(alice);
    scout.resolve({ success: false, message: "no follow list" });
    await flush();
    expect(scanState).toMatchObject({ status: "failed", error: "no follow list" });
  });
});
