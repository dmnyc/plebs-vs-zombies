import { estimatePrivateItems, getContentEncryption } from "./private-items.js";
import { normalizeLazarusRelayUrl } from "./relay-url.js";

// Lazarus kind registry (spec 0.6.2-draft): the only place kind semantics live.
// https://github.com/dmnyc/lazarus/blob/main/SPEC.md
//
// Ranking is "count" (clobber detection), "recency" (newest first, nothing
// recommended), or "intent" (an empty list is a defined state, so nothing is
// recommended and the user is asked what they want).
//
// `itemTypes` are the tags the spec names as the kind's items; `relayItems`
// marks kinds whose items are relays, compared by normalized URL.

const MUTE_TAG_TYPES = ["p", "word", "t", "e"];
const RELAY_MARKERS = ["read", "write"];

// A profile's items are the fields of its content object that have a value.
// Content that isn't a JSON object has none.
export function lazarusProfileFields(content) {
  try {
    const parsed = JSON.parse(content || "");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => value !== null),
    );
  } catch {
    return {};
  }
}

// An item's identity, or undefined for a tag that isn't an item. Items compare
// by type and value, so a rewritten relay hint or petname is no change, and a
// tag with no value is not an item. Relay URLs compare normalized, and on
// relay lists the read/write marker is part of the item.
export function lazarusItemKey(kind, tag, types) {
  const profile = LAZARUS_REGISTRY[kind];
  const [type, value] = tag;
  if (!(types ?? profile?.itemTypes ?? []).includes(type)) return undefined;
  if (typeof value !== "string" || !value) return undefined;
  if (!profile?.relayItems) return JSON.stringify([type, value]);
  const url = normalizeLazarusRelayUrl(value) ?? value.trim();
  const marker = kind === 10002 && RELAY_MARKERS.includes(tag[2]) ? tag[2] : "";
  return JSON.stringify([type, url, marker]);
}

// Each item once, however many times it's listed.
export function lazarusItemKeys(kind, tags, types) {
  const keys = new Set();
  for (const tag of tags) {
    const key = lazarusItemKey(kind, tag, types);
    if (key) keys.add(key);
  }
  return keys;
}

function countListItems(kind) {
  return (event) => {
    const count = lazarusItemKeys(kind, event.tags).size;
    // Kind 3 content is often legacy relay JSON, not hidden list items.
    if (
      !LAZARUS_REGISTRY[kind].privateItemTypes ||
      !getContentEncryption(event.content)
    ) {
      return { count, partial: false };
    }
    return {
      count,
      partial: true,
      privateEstimate: estimatePrivateItems(event.content),
    };
  };
}

function countProfileFields(event) {
  return {
    count: Object.keys(lazarusProfileFields(event.content)).length,
    partial: false,
  };
}

export const LAZARUS_REGISTRY = {
  3: {
    kind: 3,
    name: "Follow list",
    tier: 1,
    ranking: "count",
    meaningfulEmpty: false,
    requiredWarnings: [],
    itemTypes: ["p"],
    itemCount: countListItems(3),
    privateItemTypes: ["p"],
  },
  10000: {
    kind: 10000,
    name: "Mute list",
    tier: 1,
    ranking: "count",
    meaningfulEmpty: false,
    requiredWarnings: ["remute", "affects-others"],
    itemTypes: MUTE_TAG_TYPES,
    itemCount: countListItems(10000),
    privateItemTypes: MUTE_TAG_TYPES,
  },
  0: {
    kind: 0,
    name: "Profile",
    tier: 2,
    ranking: "recency",
    meaningfulEmpty: false,
    requiredWarnings: [],
    itemCount: countProfileFields,
  },
  10003: {
    kind: 10003,
    name: "Bookmarks",
    tier: 2,
    ranking: "count",
    meaningfulEmpty: false,
    requiredWarnings: [],
    itemTypes: ["e", "a"],
    itemCount: countListItems(10003),
    privateItemTypes: ["e", "a"],
  },
  10044: {
    kind: 10044,
    name: "Encryption keys (NIP-4e)",
    tier: 2,
    ranking: "intent",
    meaningfulEmpty: true,
    requiredWarnings: ["affects-others"],
    // NIP-4e lists keys in `n` tags; `p` tags belong to kind 4455 key shares.
    itemTypes: ["n"],
    itemCount: countListItems(10044),
  },
  10002: {
    kind: 10002,
    name: "Relay list",
    tier: 3,
    ranking: "recency",
    meaningfulEmpty: false,
    requiredWarnings: ["stale-relays"],
    itemTypes: ["r"],
    relayItems: true,
    itemCount: countListItems(10002),
  },
  10050: {
    kind: 10050,
    name: "DM relays",
    tier: 3,
    ranking: "recency",
    meaningfulEmpty: false,
    requiredWarnings: ["stale-relays"],
    itemTypes: ["relay"],
    relayItems: true,
    itemCount: countListItems(10050),
  },
  10006: {
    kind: 10006,
    name: "Blocked relays",
    tier: 3,
    ranking: "count",
    meaningfulEmpty: false,
    requiredWarnings: [],
    itemTypes: ["relay"],
    relayItems: true,
    itemCount: countListItems(10006),
  },
};

export function getLazarusKindProfiles() {
  return Object.values(LAZARUS_REGISTRY).sort(
    (a, b) => a.tier - b.tier || a.kind - b.kind,
  );
}

export function getLazarusKindProfile(kind) {
  return LAZARUS_REGISTRY[kind];
}
