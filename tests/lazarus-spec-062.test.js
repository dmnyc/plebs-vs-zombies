import { afterEach, describe, expect, it } from "vitest";
import { bytesToHex } from "@noble/hashes/utils";
import { finalizeEvent, generateSecretKey, getPublicKey, nip44 } from "nostr-tools";
import {
  checkLazarusCurrent,
  computeLazarusDelta,
  countLazarusItems,
  getLazarusItemRange,
  getLazarusKindProfile,
  getPlaintextLengthRange,
  estimatePrivateItems,
  isPastEmptyVersion,
  lazarusProfileFields,
  normalizeLazarusRelayUrl,
  rankLazarusCandidates,
  resolveLazarusRelays,
  setLazarusSocketFactory,
} from "../src/lib/lazarus/index.js";

// The rules spec 0.6.2-draft added or pinned down, one block per rule, in the
// order its changelog lists them.

const secretKey = generateSecretKey();
const pubkey = getPublicKey(secretKey);
const selfKey = nip44.getConversationKey(secretKey, pubkey);
const DAY = 24 * 60 * 60;

let counter = 0;
function version(kind, tags, createdAt, { content = "", id } = {}) {
  counter += 1;
  return {
    id: id ?? counter.toString(16).padStart(64, "0"),
    pubkey: "test-pubkey",
    created_at: createdAt,
    kind,
    tags,
    content,
    sig: "test-sig",
  };
}

const follows = (count, offset = 0) =>
  Array.from({ length: count }, (_, i) => ["p", `pk${offset + i}`]);
const onRelay = (events) => events.map((event) => ({ event, relayUrl: "wss://a" }));
const followProfile = getLazarusKindProfile(3);
const muteProfile = getLazarusKindProfile(10000);
const encryptTags = (tags) => nip44.encrypt(JSON.stringify(tags), selfKey);

describe("private item estimates", () => {
  it("sizes NIP-44 payloads whose padded length isn't a power of two", () => {
    const content = nip44.encrypt("x".repeat(300), selfKey);
    // 257 to 320 bytes all pad to 320.
    expect(getPlaintextLengthRange(content)).toEqual({ min: 257, max: 320 });
    expect(estimatePrivateItems(content)).toEqual({ min: 3, max: 5 });
  });

  it("sizes NIP-04 payloads of one block and of many, padded once", () => {
    const iv = Buffer.alloc(16).toString("base64");
    const blocks = (n) => `${Buffer.alloc(16 * n).toString("base64")}?iv=${iv}`;
    expect(getPlaintextLengthRange(blocks(1))).toEqual({ min: 0, max: 15 });
    expect(getPlaintextLengthRange(blocks(5))).toEqual({ min: 64, max: 79 });
    // A payload too small for one item may be an emptied list.
    expect(estimatePrivateItems(blocks(1))).toEqual({ min: 0, max: 1 });
  });
});

describe("same-second versions", () => {
  const high = "f".repeat(64);
  const low = "0".repeat(63) + "1";

  it("makes the lowest id current, as relays keep it", () => {
    const a = version(3, follows(10), 1000, { id: high });
    const b = version(3, follows(12), 1000, { id: low });
    const scan = rankLazarusCandidates(followProfile, onRelay([a, b]));
    expect(scan.current.event.id).toBe(low);
  });

  it("treats a same-second version with a lower id as a change at the re-read", () => {
    const reviewed = version(3, follows(10), 1000, { id: high });
    const lower = version(3, follows(11), 1000, { id: low });
    const answer = { url: "wss://w", outcome: "answered", answered: true, events: [lower] };
    expect(checkLazarusCurrent(reviewed, undefined, [answer])).toEqual({
      status: "changed",
      current: lower,
    });
  });

  it("doesn't treat a same-second version with a higher id as one", () => {
    const reviewed = version(3, follows(10), 1000, { id: low });
    const higher = version(3, follows(11), 1000, { id: high });
    const answer = { url: "wss://w", outcome: "answered", answered: true, events: [higher] };
    expect(checkLazarusCurrent(reviewed, undefined, [answer]).status).toBe("proceed");
  });
});

describe("items", () => {
  it("counts each item once and skips tags with no value", () => {
    const event = version(3, [["p", "a"], ["p", "a", "wss://hint"], ["p", ""], ["p"], ["p", "b"]], 1000);
    expect(followProfile.itemCount(event).count).toBe(2);
  });

  it("counts an item listed publicly and privately once", () => {
    const shared = ["p", bytesToHex(generateSecretKey())];
    const secret = ["p", bytesToHex(generateSecretKey())];
    const event = version(10000, [shared], 1000, { content: encryptTags([shared, secret]) });
    const itemCount = countLazarusItems(muteProfile, event, [shared, secret]);
    expect(getLazarusItemRange(itemCount)).toEqual({ min: 2, max: 2 });
  });

  it("counts a profile's fields that have a value", () => {
    const profile = getLazarusKindProfile(0);
    const count = (content) => profile.itemCount(version(0, [], 1000, { content })).count;
    expect(count('{"name":"a","about":"","picture":null}')).toBe(2);
    expect(count("{}")).toBe(0);
    expect(count("[1,2]")).toBe(0);
    expect(count("not json")).toBe(0);
    expect(lazarusProfileFields('{"name":"a","bot":false}')).toEqual({ name: "a", bot: false });
  });

  it("treats a profile with no fields as a past empty version", () => {
    const profile = getLazarusKindProfile(0);
    const scan = rankLazarusCandidates(profile, onRelay([
      version(0, [], 1000, { content: "{}" }),
      version(0, [], 2000, { content: '{"name":"a"}' }),
    ]));
    const empty = scan.candidates.find((c) => c.event.created_at === 1000);
    expect(isPastEmptyVersion(empty, profile)).toBe(true);
  });

  it("counts relays once however their URLs are written", () => {
    const relays = getLazarusKindProfile(10006);
    const event = version(10006, [
      ["relay", "wss://Relay.Example/"],
      ["relay", "wss://relay.example:443"],
      ["relay", "wss://relay.example"],
    ], 1000);
    expect(relays.itemCount(event).count).toBe(1);
  });

  it("keeps the read/write marker part of a relay list item", () => {
    const relayList = getLazarusKindProfile(10002);
    const event = version(10002, [["r", "wss://a", "read"], ["r", "wss://a", "write"], ["r", "wss://a/"]], 1000);
    expect(relayList.itemCount(event).count).toBe(3);
  });
});

describe("empty versions", () => {
  it("doesn't call a version empty when its private items can't be sized", () => {
    const flagged = version(10000, [], 1000, { content: "A".repeat(200) });
    const scan = rankLazarusCandidates(muteProfile, onRelay([flagged, version(10000, [["p", "x"]], 2000)]));
    const candidate = scan.candidates.find((c) => c.event.id === flagged.id);
    expect(candidate.itemCount.partial).toBe(true);
    expect(isPastEmptyVersion(candidate, muteProfile)).toBe(false);
  });
});

describe("recommendations", () => {
  it("recommends restoring a list emptied from fewer than 5 items", () => {
    const small = version(3, follows(3), 1000);
    const emptied = version(3, [], 2000);
    const scan = rankLazarusCandidates(followProfile, onRelay([small, emptied]));
    expect(scan.recommended?.event.id).toBe(small.id);
  });

  it("settles a clobber once 5 versions after its last drop span a week", () => {
    const full = version(3, follows(100), 1000);
    const clobber = version(3, follows(10), 2000);
    const edits = Array.from({ length: 5 }, (_, i) =>
      version(3, follows(10 + i + 1), 2000 + (i + 1) * 2 * DAY),
    );
    const settled = rankLazarusCandidates(followProfile, onRelay([full, clobber, ...edits]));
    expect(settled.recommended).toBeUndefined();

    // Four versions after the drop aren't enough, however long they span.
    const fewer = rankLazarusCandidates(followProfile, onRelay([full, clobber, ...edits.slice(1)]));
    expect(fewer.recommended?.event.id).toBe(full.id);
  });

  it("doesn't settle a clobber whose later versions span less than a week", () => {
    const full = version(3, follows(100), 1000);
    const clobber = version(3, follows(10), 2000);
    const edits = Array.from({ length: 6 }, (_, i) => version(3, follows(11 + i), 2000 + (i + 1) * 3600));
    const scan = rankLazarusCandidates(followProfile, onRelay([full, clobber, ...edits]));
    expect(scan.recommended?.event.id).toBe(full.id);
  });

  it("recommends the newer of two versions with the same size", () => {
    const first = version(3, follows(100), 1000);
    const second = version(3, follows(100, 500), 1100);
    const drop1 = version(3, follows(50), 1200);
    const back = version(3, follows(100, 900), 1300);
    const drop2 = version(3, follows(10), 1400);
    const scan = rankLazarusCandidates(followProfile, onRelay([first, second, drop1, back, drop2]));
    expect(scan.recommended?.event.id).toBe(back.id);
  });
});

describe("the delta", () => {
  it("compares items only, each once", () => {
    const current = version(3, [["p", "a"], ["t", "nostr"], ["p", "b"]], 2000);
    const chosen = version(3, [["p", "a"], ["p", "a"], ["p", "b"], ["p", "c"], ["p", ""], ["client", "x"]], 1000);
    const delta = computeLazarusDelta(chosen, current);
    expect(delta.added).toEqual([["p", "c"]]);
    expect(delta.removedCount).toBe(0);
  });

  it("compares relay URLs normalized", () => {
    for (const [kind, type] of [[10002, "r"], [10050, "relay"], [10006, "relay"]]) {
      const current = version(kind, [[type, "wss://relay.example"], [type, "wss://b.example/inbox"]], 2000);
      const chosen = version(kind, [[type, "WSS://Relay.Example:443/"], [type, "wss://b.example//inbox/"]], 1000);
      const delta = computeLazarusDelta(chosen, current);
      expect([kind, delta.addedCount, delta.removedCount]).toEqual([kind, 0, 0]);
    }
  });

  it("says which side's private items went uncounted", () => {
    const counted = version(10000, [], 1000, { content: encryptTags([["p", "a"]]) });
    const uncounted = version(10000, [], 2000, { content: encryptTags([["p", "b"]]) });
    const onCurrent = computeLazarusDelta(counted, uncounted, new Map([[counted.id, [["p", "a"]]]]));
    expect(onCurrent.privateUnknownCurrent).toBe(true);
    expect(onCurrent.privateUnknownChosen).toBe(false);

    const onChosen = computeLazarusDelta(uncounted, counted, new Map([[counted.id, [["p", "a"]]]]));
    expect(onChosen.privateUnknownChosen).toBe(true);
    expect(onChosen.privateUnknownCurrent).toBe(false);

    const both = computeLazarusDelta(uncounted, counted);
    expect([both.privateUnknownChosen, both.privateUnknownCurrent]).toEqual([true, true]);
  });

  it("treats identical content as the same private items, counted or not", () => {
    const content = encryptTags([["p", "a"], ["p", "b"]]);
    const chosen = version(10000, [["p", "x"]], 1000, { content });
    const current = version(10000, [], 2000, { content });
    const delta = computeLazarusDelta(chosen, current);
    expect(delta.privateUnknown).toBe(false);
    expect(delta.added).toEqual([["p", "x"]]);
    expect(delta.removedCount).toBe(0);
  });

  it("compares profiles by field, so dropping fields shrinks one", () => {
    const current = version(0, [["client", "a"]], 2000, { content: '{"name":"a","banner":"b","website":"w"}' });
    const chosen = version(0, [["client", "b"], ["t", "x"]], 1000, { content: '{"name":"z"}' });
    const delta = computeLazarusDelta(chosen, current);
    expect(delta.removedCount).toBe(2);
    expect(delta.shrinks).toBe(true);

    // Changed values and tags aren't fields lost.
    const retitled = version(0, [], 1000, { content: '{"name":"z","banner":"c","website":"v"}' });
    expect(computeLazarusDelta(retitled, current).shrinks).toBe(false);
  });
});

describe("relay URLs", () => {
  it("normalizes as the delta rule says, keeping the path's case", () => {
    expect(normalizeLazarusRelayUrl(" WSS://Relay.Example:443// ")).toBe("wss://relay.example");
    expect(normalizeLazarusRelayUrl("ws://relay.example:80/a//b/")).toBe("ws://relay.example/a/b");
    expect(normalizeLazarusRelayUrl("wss://relay.example:4430/Inbox")).toBe("wss://relay.example:4430/Inbox");
    expect(normalizeLazarusRelayUrl("https://relay.example")).toBeNull();
    expect(normalizeLazarusRelayUrl("wss://")).toBeNull();
  });
});

describe("relay list resolution", () => {
  // Answers every request from `relays` (url -> events) and refuses the rest.
  function network(relays) {
    return (url) => {
      const socket = { readyState: 0, send(data) {
        const [type, subId] = JSON.parse(data);
        if (type !== "REQ") return;
        queueMicrotask(() => {
          for (const event of relays[url] ?? []) socket.onmessage?.({ data: JSON.stringify(["EVENT", subId, event]) });
          socket.onmessage?.({ data: JSON.stringify(["EOSE", subId]) });
        });
      }, close() {} };
      queueMicrotask(() => {
        if (!(url in relays)) {
          socket.onerror?.({});
          return;
        }
        socket.readyState = 1;
        socket.onopen?.({});
      });
      return socket;
    };
  }

  afterEach(() => setLazarusSocketFactory());

  it("stands in only default write relays for a missing relay list", async () => {
    setLazarusSocketFactory(network({ "wss://default.example": [] }));
    const resolved = await resolveLazarusRelays(pubkey, {
      defaultRelays: ["wss://default.example", "wss://readonly.example"],
      defaultWriteRelays: ["wss://default.example"],
      archivalRelays: [],
    });
    expect(resolved).toEqual({ read: [], write: ["wss://default.example"], relayList: "missing" });
  });

  it("lets any relay's copy beat an undated copy of the app's own", async () => {
    const onRelays = finalizeEvent({ kind: 10002, created_at: 5, tags: [["r", "wss://relay-copy.example"]], content: "" }, secretKey);
    setLazarusSocketFactory(network({ "wss://default.example": [onRelays] }));
    const resolved = await resolveLazarusRelays(pubkey, {
      defaultRelays: ["wss://default.example"],
      archivalRelays: [],
      ownRelayList: { read: ["wss://own.example"], write: ["wss://own.example"] },
    });
    expect(resolved.write).toEqual(["wss://relay-copy.example"]);
  });
});
