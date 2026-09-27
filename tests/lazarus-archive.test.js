import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import {
  buildExportBundle,
  LAZARUS_EXPORT_FORMAT,
  lazarusFileName,
  listArchive,
  parseImportedEvents,
  removeFromArchive,
  saveToArchive,
} from "../src/lib/lazarus/archive.js";
import { profileFromEvent } from "../src/lib/lazarus/local.js";
import nostrService from "../src/services/nostrService.js";

const secretKey = generateSecretKey();
const pubkey = getPublicKey(secretKey);
const otherKey = generateSecretKey();

let clock = 1_700_000_000;
function signed(kind, tags = [], content = "", key = secretKey) {
  clock += 1;
  return finalizeEvent({ kind, created_at: clock, tags, content }, key);
}

class MemoryStorage {
  data = new Map();
  quota = Infinity;
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  key(index) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key) {
    this.data.delete(key);
  }
  setItem(key, value) {
    if (value.length > this.quota) throw new Error("QuotaExceededError");
    this.data.set(key, value);
  }
}

let memory;

beforeEach(() => {
  memory = new MemoryStorage();
  globalThis.localStorage = memory;
});

afterEach(() => {
  delete globalThis.localStorage;
});

describe("parseImportedEvents", () => {
  it("accepts an export bundle, an array, or a single event", () => {
    const follows = signed(3, [["p", "a".repeat(64)]]);
    const profile = signed(0, [], '{"name":"me"}');
    const bundle = JSON.stringify(
      buildExportBundle(pubkey, [follows, profile]),
    );
    expect(
      parseImportedEvents(bundle, pubkey)
        .events.map((e) => e.id)
        .sort(),
    ).toEqual([follows.id, profile.id].sort());
    expect(
      parseImportedEvents(JSON.stringify([follows]), pubkey).events,
    ).toHaveLength(1);
    expect(
      parseImportedEvents(JSON.stringify(profile), pubkey).events,
    ).toHaveLength(1);
  });

  it("imports a bundle another client exported under its own format name", () => {
    const follows = signed(3, [["p", "a".repeat(64)]]);
    const bundle = JSON.stringify({
      format: "mutable-nostr-events",
      version: 1,
      pubkey,
      events: [follows],
    });
    expect(parseImportedEvents(bundle, pubkey).events).toHaveLength(1);
  });

  it("rejects tampered events, other accounts' events, and kinds it can't restore", () => {
    const valid = signed(10000, [["word", "spam"]]);
    const tampered = { ...signed(3), content: "changed after signing" };
    const foreign = signed(3, [], "", otherKey);
    const note = signed(1, [], "hello");
    const result = parseImportedEvents(
      JSON.stringify([
        valid,
        tampered,
        foreign,
        note,
        valid,
        { not: "an event" },
      ]),
      pubkey,
    );
    expect(result.events.map((e) => e.id)).toEqual([valid.id]);
    expect(result.invalid).toBe(2);
    expect(result.foreign).toBe(1);
    expect(result.unsupported).toBe(1);
  });

  it("strips extra fields a file may carry", () => {
    const follows = signed(3);
    const [event] = parseImportedEvents(
      JSON.stringify({ ...follows, seenOn: ["wss://a"] }),
      pubkey,
    ).events;
    expect(Object.keys(event).sort()).toEqual([
      "content",
      "created_at",
      "id",
      "kind",
      "pubkey",
      "sig",
      "tags",
    ]);
  });

  it("explains a file that isn't JSON", () => {
    expect(() => parseImportedEvents("not json", pubkey)).toThrow(/valid JSON/);
  });
});

describe("buildExportBundle", () => {
  it("labels the bundle and orders events by kind, newest first", () => {
    const older = signed(3);
    const newer = signed(3);
    const profile = signed(0);
    const bundle = buildExportBundle(pubkey, [older, profile, newer]);
    expect(bundle.format).toBe(LAZARUS_EXPORT_FORMAT);
    expect(bundle.version).toBe(1);
    expect(bundle.pubkey).toBe(pubkey);
    expect(bundle.events.map((e) => e.id)).toEqual([
      profile.id,
      newer.id,
      older.id,
    ]);
  });
});

describe("archive", () => {
  const entry = (event, savedAt) => ({
    event,
    source: "import",
    label: "backup.json",
    savedAt,
  });

  it("saves, lists by account and kind, and removes versions", () => {
    const follows = signed(3);
    const mutes = signed(10000);
    const foreign = signed(3, [], "", otherKey);
    expect(
      saveToArchive([entry(follows, 1), entry(mutes, 2), entry(foreign, 3)]),
    ).toBe(3);
    expect(listArchive(pubkey).map((e) => e.event.id)).toEqual([
      mutes.id,
      follows.id,
    ]);
    expect(listArchive(pubkey, 3).map((e) => e.event.id)).toEqual([follows.id]);
    removeFromArchive(follows.id);
    expect(listArchive(pubkey).map((e) => e.event.id)).toEqual([mutes.id]);
  });

  it("keeps one copy of each event", () => {
    const follows = signed(3);
    saveToArchive([entry(follows, 1)]);
    expect(saveToArchive([{ ...entry(follows, 2), label: "again.json" }])).toBe(
      0,
    );
    expect(listArchive(pubkey)).toHaveLength(1);
    expect(listArchive(pubkey)[0].label).toBe("backup.json");
  });

  it("keeps at most 20 versions per kind, dropping the oldest", () => {
    const versions = Array.from({ length: 25 }, (_, i) => entry(signed(3), i));
    saveToArchive(versions);
    const kept = listArchive(pubkey, 3);
    expect(kept).toHaveLength(20);
    expect(kept[kept.length - 1].savedAt).toBe(5);
  });

  it("drops the oldest versions when storage is full", () => {
    saveToArchive([entry(signed(3), 1)]);
    memory.quota =
      memory.getItem("plebs-vs-zombies-lazarus-archive").length + 400;
    saveToArchive([entry(signed(10000), 2)]);
    const kept = listArchive(pubkey);
    expect(kept).toHaveLength(1);
    expect(kept[0].savedAt).toBe(2);
  });

  it("works without storage", () => {
    delete globalThis.localStorage;
    expect(listArchive(pubkey)).toEqual([]);
    expect(() => saveToArchive([entry(signed(3), 1)])).not.toThrow();
  });
});

describe("lazarusFileName", () => {
  it("builds a readable, filesystem-safe name", () => {
    expect(
      lazarusFileName(
        "Mute list / all versions",
        "abcdef0123456789",
        new Date("2026-09-26T12:34:56Z"),
      ),
    ).toBe(
      "plebs-vs-zombies-mute-list-all-versions-abcdef01-2026-09-26-12-34.json",
    );
  });
});

describe("profileFromEvent", () => {
  it("reads a profile, tolerating broken content", () => {
    expect(
      profileFromEvent(signed(0, [], '{"name":"me","about":5}')),
    ).toMatchObject({
      pubkey,
      name: "me",
      about: undefined,
    });
    expect(profileFromEvent(signed(0, [], "{broken")).name).toBeUndefined();
  });

  it("sets every field, so one the restored profile lacks is cleared", () => {
    const profile = profileFromEvent(signed(0, [], '{"name":"me"}'));
    expect(Object.keys(profile)).toEqual(
      expect.arrayContaining(["banner", "picture", "about", "website"]),
    );
    expect(profile.banner).toBeUndefined();
    // The header merges this over the old profile; an absent key would keep
    // the old banner on screen after a restore that removed it.
    expect({ banner: "old.png", ...profile }.banner).toBeUndefined();
  });

  it("falls back to the non-standard displayName some clients write", () => {
    expect(
      profileFromEvent(signed(0, [], '{"displayName":"Bass"}')).display_name,
    ).toBe("Bass");
  });
});

// The local copy is what keeps a purge from rebuilding on a clobbered list
// that a stale relay still serves after a restore.
describe("nostrService own copy", () => {
  let savedPubkey;

  beforeEach(() => {
    savedPubkey = nostrService.pubkey;
    nostrService.pubkey = pubkey;
    nostrService.ownEvents.clear();
  });

  afterEach(() => {
    nostrService.pubkey = savedPubkey;
    nostrService.ownEvents.clear();
  });

  it("prefers a restored list over an older one a stale relay still serves", () => {
    const clobber = signed(3, []);
    const restored = signed(3, [["p", "a".repeat(64)]]);
    nostrService.rememberOwnEvent(restored);
    expect(nostrService.newestWithOwnCopy(3, [clobber]).id).toBe(restored.id);
  });

  it("prefers a newer version from relays over an older own copy", () => {
    const remembered = signed(3);
    const newer = signed(3);
    nostrService.rememberOwnEvent(remembered);
    expect(nostrService.newestWithOwnCopy(3, [newer]).id).toBe(newer.id);
  });

  it("keeps only the newest version per kind", () => {
    const newer = signed(3);
    const older = { ...signed(3), created_at: newer.created_at - 100 };
    nostrService.rememberOwnEvent(newer);
    nostrService.rememberOwnEvent(older);
    expect(nostrService.ownEvents.get(3).id).toBe(newer.id);
  });

  it("never remembers another account's event", () => {
    nostrService.rememberOwnEvent(signed(3, [], "", otherKey));
    expect(nostrService.ownEvents.has(3)).toBe(false);
  });

  it("never merges a copy left over from another account", () => {
    const theirs = signed(3, [["p", "b".repeat(64)]], "", otherKey);
    // Seeded directly: an account can change without passing through logout().
    nostrService.ownEvents.set(3, theirs);
    const ours = signed(3);
    expect(nostrService.newestWithOwnCopy(3, [ours]).id).toBe(ours.id);
    expect(nostrService.newestWithOwnCopy(3, [])).toBeUndefined();
  });

  it("breaks a same-second tie on the lowest id, as relays do", () => {
    const a = signed(3, [["p", "a".repeat(64)]]);
    const b = { ...signed(3, [["p", "b".repeat(64)]]), created_at: a.created_at };
    const lowest = a.id < b.id ? a : b;
    expect(nostrService.newestWithOwnCopy(3, [a, b]).id).toBe(lowest.id);
  });

  it("returns undefined when there is nothing at all", () => {
    expect(nostrService.newestWithOwnCopy(3, [])).toBeUndefined();
    expect(nostrService.newestWithOwnCopy(3, null)).toBeUndefined();
  });
});
