import { verifyEvent } from "nostr-tools";
import { fitsNip46Request } from "./nip46.js";
import { getContentEncryption } from "./private-items.js";
import {
  getLazarusKindProfile,
  lazarusItemKey,
  lazarusItemKeys,
  lazarusProfileFields,
} from "./registry.js";

// Lazarus core (spec 0.6.2-draft): scan orchestration, ranking, deltas, and
// the recovery draft. Pure: relays come in through a relay source (an object
// with `fetchVersions(kind, pubkey, cursors?)`), and nothing here signs or
// publishes.

// A drop of at least 20% and at least 5 items between two versions is a
// sudden drop; curation moves a few items at a time.
const CLOBBER_MIN_LOSS_RATIO = 0.2;
const CLOBBER_MIN_LOSS_ITEMS = 5;
const CLOBBER_EPISODE_SECONDS = 24 * 60 * 60;
// A clobber edited on this often, over this long, is the user's choice now.
const SETTLED_MIN_EDITS = 5;
const SETTLED_MIN_SECONDS = 7 * 24 * 60 * 60;

export function getLazarusItemRange(itemCount) {
  const { count, privateCount, privateEstimate } = itemCount;
  if (privateCount !== undefined) {
    return { min: count + privateCount, max: count + privateCount };
  }
  if (privateEstimate) {
    return {
      min: count + privateEstimate.min,
      max: count + privateEstimate.max,
    };
  }
  return { min: count, max: count };
}

export function isLazarusSizeKnown(itemCount) {
  return !itemCount.partial || !!itemCount.privateEstimate;
}

// With a version's private items decrypted, its count is exact: public items
// plus the private ones that aren't also public, since an item listed both
// ways is one item.
export function countLazarusItems(profile, event, privateTags) {
  const itemCount = profile.itemCount(event);
  if (!privateTags || !profile.privateItemTypes) return itemCount;
  const publicKeys = lazarusItemKeys(profile.kind, event.tags);
  let privateCount = 0;
  for (const key of lazarusItemKeys(
    profile.kind,
    privateTags,
    profile.privateItemTypes,
  )) {
    if (!publicKeys.has(key)) privateCount += 1;
  }
  return { count: itemCount.count, partial: false, privateCount };
}

// The order NIP-01 has relays keep: the later `created_at`, then the lowest
// id. It decides "current", "newer", and "consecutive" everywhere.
export function isNewerLazarusVersion(a, b) {
  return (
    a.created_at > b.created_at ||
    (a.created_at === b.created_at && a.id < b.id)
  );
}

function newestFirst(a, b) {
  if (isNewerLazarusVersion(a.event, b.event)) return -1;
  return isNewerLazarusVersion(b.event, a.event) ? 1 : 0;
}

// Relays are untrusted: a restore would sign whatever content they return.
export function isLazarusVersion(event, kind, pubkey) {
  return event.kind === kind && event.pubkey === pubkey && verifyEvent(event);
}

function answeredAny(outcomes) {
  return Object.values(outcomes).includes("answered");
}

export function scanLazarusKind(kind, pubkey, source, deliberateIds) {
  const profile = getLazarusKindProfile(kind);
  if (!profile) {
    return Promise.reject(
      new Error(`kind ${kind} is not in the Lazarus registry`),
    );
  }
  return source.fetchVersions(kind, pubkey).then((result) => {
    // No answer at all is a failed scan, not an empty one; versions that
    // arrived before the relays failed are still shown.
    if (
      result.outcomes &&
      result.tagged.length === 0 &&
      !answeredAny(result.outcomes)
    ) {
      throw new Error("No relay answered the scan");
    }
    return {
      ...rankLazarusCandidates(
        profile,
        result.tagged,
        result.queriedRelays,
        result.respondingRelays,
        new Map(),
        result.currentConfirmed ?? true,
        deliberateIds,
      ),
      olderCursors: result.olderCursors ?? {},
      relayOutcomes: result.outcomes,
      relayList: result.relayList,
      writeRelays: result.writeRelays,
    };
  });
}

export function lazarusScanReachedNoRelay(scan) {
  return !!scan.relayOutcomes && !answeredAny(scan.relayOutcomes);
}

export async function loadOlderLazarusVersions(
  profile,
  scan,
  pubkey,
  source,
  privateTags = new Map(),
) {
  const cursors = scan.olderCursors ?? {};
  if (Object.keys(cursors).length === 0) return scan;
  const older = await source.fetchVersions(profile.kind, pubkey, cursors);
  return {
    ...rankLazarusCandidates(
      profile,
      [...scanToTagged(scan), ...older.tagged],
      scan.queriedRelays,
      Array.from(
        new Set([...scan.respondingRelays, ...older.respondingRelays]),
      ),
      privateTags,
      scan.currentConfirmed,
      scan.deliberateIds,
    ),
    olderCursors: older.olderCursors ?? {},
    relayOutcomes: scan.relayOutcomes,
    relayList: scan.relayList,
    writeRelays: scan.writeRelays,
  };
}

// Merge a retry of the relays that failed or timed out into the scan.
export function mergeLazarusRetry(
  profile,
  scan,
  retry,
  privateTags = new Map(),
) {
  const relayOutcomes = { ...scan.relayOutcomes, ...retry.outcomes };
  const currentConfirmed = scan.writeRelays
    ? scan.writeRelays.some((url) => relayOutcomes[url] === "answered")
    : scan.currentConfirmed;
  return {
    ...rankLazarusCandidates(
      profile,
      [...scanToTagged(scan), ...retry.tagged],
      scan.queriedRelays,
      Array.from(
        new Set([...scan.respondingRelays, ...retry.respondingRelays]),
      ),
      privateTags,
      currentConfirmed,
      scan.deliberateIds,
    ),
    olderCursors: { ...scan.olderCursors, ...retry.olderCursors },
    relayOutcomes,
    relayList: scan.relayList,
    writeRelays: scan.writeRelays,
  };
}

function scanToTagged(scan) {
  return scan.candidates.flatMap((candidate) =>
    candidate.foundOn.map((relayUrl) => ({ event: candidate.event, relayUrl })),
  );
}

function looksClobbered(laterMax, earlierMin) {
  if (earlierMin <= 0) return false;
  if (laterMax <= 0) return true;
  const loss = earlierMin - laterMax;
  return (
    loss >= CLOBBER_MIN_LOSS_ITEMS &&
    loss >= earlierMin * CLOBBER_MIN_LOSS_RATIO
  );
}

// Oldest first. Versions of unknown size take no part in finding drops.
function knownTimeline(candidates) {
  return candidates
    .filter((c) => isLazarusSizeKnown(c.itemCount))
    .sort((a, b) => newestFirst(b, a));
}

// Newest episode first. Drops back to back or within a day are one episode.
//
// `deliberateIds` names versions this client published on the user's own
// instruction. A drop into one of them is the user's choice, not clobber
// evidence. Plebs vs. Zombies needs this because its purpose is removing
// follows in bulk: a purge of 200 out of 1000 has exactly the shape of a
// clobber, and without it the scan would recommend re-following every zombie
// the user just purged. Empty by default, which is the spec's behavior.
function findClobberEpisodes(timeline, deliberateIds = new Set()) {
  const range = (i) => getLazarusItemRange(timeline[i].itemCount);
  const episodes = [];
  for (let i = 1; i < timeline.length; i++) {
    if (deliberateIds.has(timeline[i].event.id)) continue;
    if (!looksClobbered(range(i).max, range(i - 1).min)) continue;
    const open = episodes[episodes.length - 1];
    if (
      open &&
      (i - 1 === open.last ||
        timeline[i].event.created_at - timeline[open.last].event.created_at <=
          CLOBBER_EPISODE_SECONDS)
    ) {
      open.drops.push(i);
      open.last = i;
    } else {
      episodes.push({ drops: [i], first: i - 1, last: i });
    }
  }
  return episodes.reverse();
}

function findRestorePoint(candidates, current, deliberateIds) {
  const timeline = knownTimeline(candidates);
  const minOf = (c) => getLazarusItemRange(c.itemCount).min;
  const currentMax = getLazarusItemRange(current.itemCount).max;

  for (const episode of findClobberEpisodes(timeline, deliberateIds)) {
    const restorePoint = episode.drops
      .map((i) => timeline[i - 1])
      .reduce((fullest, c) => (minOf(c) >= minOf(fullest) ? c : fullest));
    if (!looksClobbered(currentMax, minOf(restorePoint))) continue;
    const edits = timeline.length - 1 - episode.last;
    const settledFor =
      current.event.created_at - timeline[episode.last].event.created_at;
    if (edits >= SETTLED_MIN_EDITS && settledFor >= SETTLED_MIN_SECONDS) {
      return undefined;
    }
    return restorePoint;
  }
  return undefined;
}

export function rankLazarusCandidates(
  profile,
  taggedEvents,
  queriedRelays = [],
  respondingRelays = [],
  privateTags = new Map(),
  currentConfirmed = true,
  deliberateIds = new Set(),
) {
  const byId = new Map();
  for (const { event, relayUrl } of taggedEvents) {
    const existing = byId.get(event.id);
    if (existing) {
      if (!existing.foundOn.includes(relayUrl)) existing.foundOn.push(relayUrl);
      continue;
    }
    byId.set(event.id, {
      event,
      foundOn: [relayUrl],
      itemCount: countLazarusItems(profile, event, privateTags.get(event.id)),
      isCurrent: false,
      isRecommended: false,
    });
  }

  const candidates = Array.from(byId.values());
  const byDate = [...candidates].sort(newestFirst);
  const current = byDate[0];
  if (current) current.isCurrent = true;

  let ordered;
  let recommended;
  const requiresIntentConfirmation = profile.ranking === "intent";

  if (profile.ranking === "count") {
    const size = (c) => {
      const range = getLazarusItemRange(c.itemCount);
      return range.min + range.max;
    };
    ordered = [...candidates].sort(
      (a, b) => size(b) - size(a) || newestFirst(a, b),
    );
    if (currentConfirmed && current && isLazarusSizeKnown(current.itemCount)) {
      recommended = findRestorePoint(candidates, current, deliberateIds);
    }
  } else {
    ordered = byDate;
  }

  if (recommended) recommended.isRecommended = true;

  return {
    kind: profile.kind,
    candidates: ordered,
    current,
    recommended,
    requiresIntentConfirmation,
    queriedRelays,
    respondingRelays,
    currentConfirmed,
    // Carried so every re-rank (decryption, retry, paging) keeps honoring it.
    deliberateIds,
  };
}

export function applyLazarusPrivateTags(profile, scan, privateTags) {
  return {
    ...rankLazarusCandidates(
      profile,
      scanToTagged(scan),
      scan.queriedRelays,
      scan.respondingRelays,
      privateTags,
      scan.currentConfirmed,
      scan.deliberateIds,
    ),
    olderCursors: scan.olderCursors,
    relayOutcomes: scan.relayOutcomes,
    relayList: scan.relayList,
    writeRelays: scan.writeRelays,
  };
}

export function sortLazarusCandidates(candidates, order) {
  if (order === "date") return [...candidates].sort(newestFirst);
  const size = (c) => {
    const range = getLazarusItemRange(c.itemCount);
    return range.min + range.max;
  };
  return [...candidates].sort((a, b) => size(b) - size(a) || newestFirst(a, b));
}

export function isPastEmptyVersion(candidate, profile) {
  return (
    !candidate.isCurrent &&
    !profile.meaningfulEmpty &&
    isLazarusSizeKnown(candidate.itemCount) &&
    getLazarusItemRange(candidate.itemCount).max === 0
  );
}

// Newest first, folding runs of small edits and clobber episodes into groups.
// Current and empty versions keep their own rows. Items are
// { type: "version", candidate } or { type: "group", candidates, clobbered }.
export function groupLazarusCandidates(
  scan,
  profile,
  { hidePastEmpty = false } = {},
) {
  const newestFirst = sortLazarusCandidates(scan.candidates, "date");
  const visible = hidePastEmpty
    ? newestFirst.filter((candidate) => !isPastEmptyVersion(candidate, profile))
    : newestFirst;
  if (profile.ranking !== "count") {
    return visible.map((candidate) => ({ type: "version", candidate }));
  }

  const timeline = knownTimeline(scan.candidates);
  const episodeOf = new Map();
  findClobberEpisodes(timeline, scan.deliberateIds).forEach((episode, n) => {
    for (let i = episode.first; i <= episode.last; i++) {
      episodeOf.set(timeline[i].event.id, n);
    }
  });

  const items = [];
  let run = [];
  let runEpisode;
  const flush = () => {
    if (run.length === 1) items.push({ type: "version", candidate: run[0] });
    if (run.length > 1) {
      items.push({
        type: "group",
        candidates: run,
        clobbered: runEpisode !== undefined,
      });
    }
    run = [];
  };
  for (const candidate of visible) {
    const empty =
      isLazarusSizeKnown(candidate.itemCount) &&
      getLazarusItemRange(candidate.itemCount).max === 0;
    if (candidate.isCurrent || empty) {
      flush();
      items.push({ type: "version", candidate });
      continue;
    }
    const episode = episodeOf.get(candidate.event.id);
    if (run.length > 0 && episode !== runEpisode) flush();
    runEpisode = episode;
    run.push(candidate);
  }
  flush();
  return items;
}

function deltaOf(added, removed, chosenUnknown = false, currentUnknown = false) {
  return {
    added,
    removed,
    addedCount: added.length,
    removedCount: removed.length,
    grows: added.length > 0 && added.length >= removed.length,
    shrinks: removed.length > added.length,
    privateUnknown: chosenUnknown || currentUnknown,
    // Which side's private items went uncounted. Uncounted ones on current
    // are the dangerous side: the restore replaces them unseen, so it takes
    // the confirmation a shrink takes.
    privateUnknownChosen: chosenUnknown,
    privateUnknownCurrent: currentUnknown,
  };
}

// A profile's items are its fields, so a restore shrinks it by dropping fields
// current has. How values change is computeLazarusProfileChanges' job.
function profileDelta(chosen, current) {
  const to = lazarusProfileFields(chosen.content);
  const from = lazarusProfileFields(current?.content);
  const fieldsOnlyIn = (a, b) =>
    Object.keys(a)
      .filter((field) => !(field in b))
      .map((field) => [field]);
  return deltaOf(fieldsOnlyIn(to, from), fieldsOnlyIn(from, to));
}

// Items only, each once, private ones included where they could be decrypted.
export function computeLazarusDelta(chosen, current, privateTags = new Map()) {
  if (chosen.kind === 0) return profileDelta(chosen, current);
  const profile = getLazarusKindProfile(chosen.kind);
  const types = Array.from(
    new Set([...(profile?.itemTypes ?? []), ...(profile?.privateItemTypes ?? [])]),
  );
  const keyOf = (tag) => lazarusItemKey(chosen.kind, tag, types);
  // Identical content holds identical private items, counted or not.
  const sameContent = !!current && current.content === chosen.content;
  const decryptedOf = (event) =>
    privateTags.get(event.id) ??
    (sameContent
      ? (privateTags.get(chosen.id) ?? privateTags.get(current.id))
      : undefined);
  const itemsOf = (event) => {
    if (!event) return { items: new Map(), unknown: false };
    const decrypted = decryptedOf(event);
    const privateItems = profile?.privateItemTypes ? (decrypted ?? []) : [];
    const items = new Map();
    for (const tag of [...event.tags, ...privateItems]) {
      const key = keyOf(tag);
      if (key && !items.has(key)) items.set(key, tag);
    }
    return {
      items,
      unknown:
        !!profile?.privateItemTypes &&
        !decrypted &&
        !sameContent &&
        !!getContentEncryption(event.content),
    };
  };
  const chosenItems = itemsOf(chosen);
  const currentItems = itemsOf(current);
  const onlyIn = (a, b) =>
    Array.from(a.items)
      .filter(([key]) => !b.items.has(key))
      .map(([, tag]) => tag);
  return deltaOf(
    onlyIn(chosenItems, currentItems),
    onlyIn(currentItems, chosenItems),
    chosenItems.unknown,
    currentItems.unknown,
  );
}

const PROFILE_FIELDS = [
  "name",
  "display_name",
  "about",
  "picture",
  "banner",
  "nip05",
  "lud16",
  "lud06",
  "website",
];

// A restore replaces all of a profile, so every field and tag counts.
export function computeLazarusProfileChanges(chosen, current) {
  const fieldsOf = (event) => {
    try {
      const parsed = JSON.parse(event?.content || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };
  const tagsOf = (event) => {
    const byName = {};
    for (const [name, ...values] of event?.tags ?? []) {
      if (name) (byName[`${name} tags`] ??= []).push(values.join(" "));
    }
    return Object.fromEntries(
      Object.entries(byName).map(([field, values]) => [
        field,
        values.sort().join(", "),
      ]),
    );
  };
  const text = (value) => {
    if (typeof value === "string") return value.trim() ? value : undefined;
    return value === undefined || value === null
      ? undefined
      : JSON.stringify(value);
  };
  const to = fieldsOf(chosen);
  const from = fieldsOf(current);
  const toTags = tagsOf(chosen);
  const fromTags = tagsOf(current);
  const otherFields = Array.from(
    new Set([...Object.keys(from), ...Object.keys(to)]),
  )
    .filter((field) => !PROFILE_FIELDS.includes(field))
    .sort();
  const tagFields = Array.from(
    new Set([...Object.keys(fromTags), ...Object.keys(toTags)]),
  ).sort();
  return [
    ...[...PROFILE_FIELDS, ...otherFields].map((field) => ({
      field,
      from: text(from[field]),
      to: text(to[field]),
    })),
    ...tagFields.map((field) => ({
      field,
      from: fromTags[field],
      to: toTags[field],
    })),
  ].filter((change) => change.from !== change.to);
}

// Only a newer version is a change: the re-read asks fewer relays than the
// scan did. An empty answer from a write relay confirms; the local copy alone
// never does. Returns { status: "proceed" | "changed" | "unconfirmed", current }.
export function checkLazarusCurrent(reviewed, local, answers) {
  let newest = reviewed;
  for (const event of [local, ...answers.flatMap((answer) => answer.events)]) {
    if (event && (!newest || isNewerLazarusVersion(event, newest))) {
      newest = event;
    }
  }
  if (newest && newest.id !== reviewed?.id) {
    return { status: "changed", current: newest };
  }
  if (!answers.some((answer) => answer.answered)) {
    return { status: "unconfirmed" };
  }
  return { status: "proceed", current: reviewed };
}

// Copies the item set verbatim (private content stays encrypted to the user)
// and dates it after current, even when a clobbering client's clock ran ahead.
export function buildLazarusRecoveryDraft(
  chosen,
  { current, now = Math.floor(Date.now() / 1000) } = {},
) {
  return {
    kind: chosen.kind,
    content: chosen.content,
    tags: chosen.tags.map((tag) => [...tag]),
    created_at: Math.max(now, (current?.created_at ?? 0) + 1),
  };
}

export function fitsLazarusRemoteRestore(chosen, pubkey) {
  return fitsNip46Request("sign_event", [
    JSON.stringify({ ...buildLazarusRecoveryDraft(chosen), pubkey }),
  ]);
}
