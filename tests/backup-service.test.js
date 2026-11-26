import { beforeEach, describe, expect, it, vi } from "vitest";

// backupService talks to localforage directly; back it with an in-memory
// store so scoping and the legacy migration are observable.
const memory = vi.hoisted(() => new Map());
vi.mock("localforage", () => ({
  default: {
    config: () => {},
    getItem: async (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: async (key, value) => { memory.set(key, value); },
    removeItem: async (key) => { memory.delete(key); },
  },
}));

// The account identity decides the storage scope; a controllable stub
// stands in for the Nostr session (and the follow-list reader).
const nostr = vi.hoisted(() => ({ pubkey: null }));
vi.mock("../src/services/nostrService", () => ({
  default: {
    get pubkey() { return nostr.pubkey; },
    async backupFollowList() {
      return { pubkey: nostr.pubkey, npub: "npub1test", timestamp: Date.now(), followCount: 2, follows: ["a", "b"] };
    },
  },
}));

vi.mock("../src/lib/lazarus/deliberate.js", () => ({
  markDeliberateEdit: () => {},
}));

const backupService = (await import("../src/services/backupService.js")).default;

const KEY = (pubkey) => `backups:${pubkey}`;

beforeEach(() => {
  memory.clear();
  nostr.pubkey = "abc123";
  backupService.backups = [];
});

describe("backup storage scoping", () => {
  it("creates a backup under the account-scoped key", async () => {
    const result = await backupService.createBackup("before purge");
    expect(result.success).toBe(true);
    expect(memory.has(KEY("abc123"))).toBe(true);
    expect(memory.has("backups")).toBe(false);
    expect((await backupService.getBackups(true))[0].notes).toBe("before purge");
  });

  it("hides another account's backups", async () => {
    memory.set(KEY("abc123"), [{ id: "1", pubkey: "abc123" }]);
    const mine = await backupService.getBackups(true);
    expect(mine).toHaveLength(1);

    nostr.pubkey = "other";
    backupService.backups = [];
    expect(await backupService.getBackups(true)).toEqual([]);
  });

  it("deletes by id", async () => {
    await backupService.createBackup();
    const [backup] = await backupService.getBackups(true);
    await backupService.deleteBackup(backup.id);
    expect(await backupService.getBackups(true)).toEqual([]);
  });
});

describe("legacy unscoped migration (#78 regression)", () => {
  it("adopts only the current account's pre-#78 backups", async () => {
    memory.set("backups", [
      { id: "mine", pubkey: "abc123", follows: ["a"] },
      { id: "theirs", pubkey: "other", follows: ["z"] },
    ]);
    const backups = await backupService.getBackups(true);

    expect(backups.map((b) => b.id)).toEqual(["mine"]);
    expect(memory.get(KEY("abc123"))).toEqual([{ id: "mine", pubkey: "abc123", follows: ["a"] }]);
    // The other account's entry stays put until their owner reads backups.
    expect(memory.get("backups")).toEqual([{ id: "theirs", pubkey: "other", follows: ["z"] }]);
  });

  it("removes the legacy key once fully adopted", async () => {
    memory.set("backups", [{ id: "mine", pubkey: "abc123" }]);
    await backupService.getBackups(true);
    expect(memory.has("backups")).toBe(false);
    expect(await backupService.getBackups(true)).toHaveLength(1);
  });

  it("leaves legacy data alone when scoped backups already exist", async () => {
    memory.set(KEY("abc123"), [{ id: "scoped", pubkey: "abc123" }]);
    memory.set("backups", [{ id: "old", pubkey: "abc123" }]);
    const backups = await backupService.getBackups(true);
    expect(backups.map((b) => b.id)).toEqual(["scoped"]);
    expect(memory.has("backups")).toBe(true);
  });

  it("does not migrate when signed out (ownership unknowable)", async () => {
    nostr.pubkey = null;
    backupService.backups = [];
    memory.set("backups", [{ id: "old", pubkey: "someone" }]);
    expect(await backupService.getBackups(true)).toEqual([]);
    expect(memory.has("backups")).toBe(true);
  });
});
