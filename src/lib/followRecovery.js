/**
 * Follow List Recovery
 *
 * Opt-in tool that scans a user's relays (plus a broad archival set) for
 * historical kind:3 follow list events and lets the user republish a
 * previously-overwritten version. The "largest most-recent non-empty" version
 * is highlighted as the recommended pick, since cross-client kind:3
 * overwrites are the most common way a follow graph gets clobbered.
 *
 * Ported from Mutable's lib/followRecovery.ts. The pure ranking logic
 * (rankFollowListCandidates, pickRecommendedRecovery) is intentionally
 * dependency-free and unit-tested in follow-recovery.test.js.
 */

import { SimplePool } from 'nostr-tools';

const FOLLOW_LIST_KIND = 3;

// Broad archival relay set used during recovery scans. The intent is maximum
// coverage — relays that don't respond or don't have data just time out and
// are dropped from the result. Kept in sync with Mutable's KNOWN_RELAYS.
const KNOWN_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.primal.net',
  'wss://purplepag.es',
  'wss://offchain.pub',
  'wss://nostr.mom',
  'wss://relay.nostr.net',
  'wss://relay.noswhere.com',
  'wss://relay.0xchat.com',
];

/**
 * @typedef {Object} FollowListCandidate
 * @property {Object} event - The raw kind:3 event
 * @property {string} eventId - Hex event id (mirror of event.id)
 * @property {number} createdAt - Unix seconds when this version was published
 * @property {number} followCount - Number of pubkeys followed
 * @property {string[]} followPubkeys - Pubkeys followed, in original tag order
 * @property {string[]} foundOnRelays - Relays where this exact event id was observed
 * @property {boolean} isCurrent - True if this is the most-recent event seen
 * @property {boolean} isRecommended - True if this is the recommended recovery pick
 */

/**
 * @typedef {Object} FollowRecoveryScanResult
 * @property {FollowListCandidate|null} current - Most recent by created_at
 * @property {FollowListCandidate[]} candidates - All distinct events, sorted by created_at DESC
 * @property {FollowListCandidate|null} recommended - Best recovery pick, if any
 * @property {string[]} queriedRelays - Relays that were queried
 * @property {string[]} respondingRelays - Relays that returned at least one event
 */

/**
 * @typedef {Object} ScanOptions
 * @property {number} [timeoutMs=6000] - Per-relay query timeout
 * @property {string[]} [extraRelays=[]] - Additional relays to include
 * @property {(message: string) => void} [onProgress] - Progress reporter
 */

function normalizeRelayUrl(relay) {
  if (!relay) return null;
  const trimmed = String(relay).trim();
  if (!/^wss?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/\/+$/, '').toLowerCase();
}

function normalizeRelayList(relays) {
  const seen = new Set();
  const out = [];
  for (const relay of relays) {
    const clean = normalizeRelayUrl(relay);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/;

function isValidHexPubkey(value) {
  return typeof value === 'string' && HEX_PUBKEY_RE.test(value);
}

function extractFollowPubkeys(event) {
  // Strfry-based relays (damus, nos.lol, primal, etc.) reject kind:3 events
  // with any malformed `p` tag using "invalid: unexpected size for fixed-size
  // tag: p". Filter to lowercase 64-char hex only so the republished event is
  // acceptable to those relays — historical follow lists frequently contain
  // truncated keys, petnames in tag[1], or uppercase hex.
  return event.tags
    .filter((tag) => tag[0] === 'p' && isValidHexPubkey(tag[1]))
    .map((tag) => tag[1]);
}

async function queryRelayForFollowEvents(pool, relay, pubkey, timeoutMs) {
  try {
    const events = await Promise.race([
      pool.querySync([relay], {
        kinds: [FOLLOW_LIST_KIND],
        authors: [pubkey],
        limit: 10,
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Relay query timeout: ${relay}`)),
          timeoutMs,
        ),
      ),
    ]);
    return events;
  } catch {
    return [];
  }
}

/**
 * Rank candidates so the "most-recent largest" non-empty version sorts first.
 *
 * Sort order:
 *   1. followCount DESC (largest first)
 *   2. createdAt DESC  (newer wins ties)
 *
 * Tombstones (zero follows) are kept in the result but never recommended.
 *
 * @param {FollowListCandidate[]} candidates
 * @returns {FollowListCandidate[]}
 */
export function rankFollowListCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    if (b.followCount !== a.followCount) return b.followCount - a.followCount;
    return b.createdAt - a.createdAt;
  });
}

/**
 * Pick a recovery candidate.
 *
 * Recommends the highest-ranked non-empty candidate that is strictly larger
 * than the current effective list. If the current list is already the
 * largest, returns null. If no current event exists at all, recommends the
 * largest non-empty candidate.
 *
 * @param {FollowListCandidate[]} candidates
 * @param {FollowListCandidate|null} current
 * @returns {FollowListCandidate|null}
 */
export function pickRecommendedRecovery(candidates, current) {
  const ranked = rankFollowListCandidates(candidates).filter(
    (c) => c.followCount > 0,
  );
  if (ranked.length === 0) return null;

  const currentCount = current?.followCount ?? 0;
  const currentId = current?.eventId ?? null;

  for (const candidate of ranked) {
    if (candidate.eventId === currentId) continue;
    if (candidate.followCount > currentCount) return candidate;
  }

  return null;
}

/**
 * Scan the user's relays plus a broad archival set for historical kind:3
 * events. Returns every distinct version observed and highlights the best
 * recovery candidate.
 *
 * @param {string} pubkey - Hex pubkey of the user
 * @param {string[]} [userRelays] - User's relay list (defaults to nostrService.relays)
 * @param {ScanOptions} [options]
 * @returns {Promise<FollowRecoveryScanResult>}
 */
export async function scanFollowListHistory(pubkey, userRelays, options = {}) {
  if (!pubkey) throw new Error('pubkey is required');
  const { timeoutMs = 6000, extraRelays = [], onProgress } = options;

  const nostrService = (await import('../services/nostrService.js')).default;

  const relays = normalizeRelayList([
    ...(userRelays && userRelays.length ? userRelays : nostrService.relays),
    ...KNOWN_RELAYS,
    ...extraRelays,
  ]);

  onProgress?.(`Querying ${relays.length} relays for follow list history…`);

  const pool = new SimplePool();
  const respondingRelays = [];
  const candidatesById = new Map();

  try {
    await Promise.all(
      relays.map(async (relay) => {
        const events = await queryRelayForFollowEvents(
          pool,
          relay,
          pubkey,
          timeoutMs,
        );
        if (events.length > 0) respondingRelays.push(relay);

        for (const event of events) {
          const followPubkeys = extractFollowPubkeys(event);
          let entry = candidatesById.get(event.id);
          if (!entry) {
            entry = {
              event,
              eventId: event.id,
              createdAt: event.created_at,
              followCount: followPubkeys.length,
              followPubkeys,
              foundOnRelays: [],
              isCurrent: false,
              isRecommended: false,
            };
            candidatesById.set(event.id, entry);
          }
          if (!entry.foundOnRelays.includes(relay)) {
            entry.foundOnRelays.push(relay);
          }
        }
      }),
    );
  } finally {
    try {
      pool.close(relays);
    } catch {
      // Best-effort cleanup; SimplePool sometimes throws on already-closed
      // sockets. Not fatal.
    }
  }

  const allCandidates = Array.from(candidatesById.values()).sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  const current = allCandidates[0] ?? null;
  if (current) current.isCurrent = true;

  const recommended = pickRecommendedRecovery(allCandidates, current);
  if (recommended) recommended.isRecommended = true;

  const versionLabel = `${allCandidates.length} distinct version${allCandidates.length === 1 ? '' : 's'}`;
  onProgress?.(
    `Found ${versionLabel} across ${respondingRelays.length}/${relays.length} relays.`,
  );

  return {
    current,
    candidates: allCandidates,
    recommended,
    queriedRelays: relays,
    respondingRelays,
  };
}

/**
 * Republish a candidate kind:3 event as the user's current follow list.
 *
 * Preserves the original `p` tag ordering (and any per-tag metadata like
 * relay hints / petnames). Strips any non-`p` tags for safety; we only want
 * to restore the follow set. `content` (legacy relay metadata JSON) is
 * preserved verbatim.
 *
 * Signing + publishing route through nostrService so NIP-07 and NIP-46
 * paths both work transparently.
 *
 * @param {FollowListCandidate} candidate
 * @returns {Promise<{successful: number, failed: number, total: number}>}
 */
export async function recoverFollowList(candidate, userRelays) {
  const nostrService = (await import('../services/nostrService.js')).default;

  // Filter to valid 64-char hex p-tags only (see extractFollowPubkeys comment
  // for rationale). Then JSON round-trip to strip Vue Proxy wrapping so the
  // extension can structured-clone the event via postMessage.
  const validTags = candidate.event.tags.filter(
    (tag) => tag[0] === 'p' && isValidHexPubkey(tag[1]),
  );
  const droppedTagCount = candidate.event.tags.filter((t) => t[0] === 'p').length - validTags.length;
  if (droppedTagCount > 0) {
    console.warn(
      `[FollowRecovery] Dropped ${droppedTagCount} malformed p-tag${droppedTagCount === 1 ? '' : 's'} from candidate ${candidate.eventId.slice(0, 8)}`,
    );
  }
  const preservedTags = JSON.parse(JSON.stringify(validTags));

  // Match PvZ's own follow-list signing pattern: kind, created_at, tags, content.
  // The signer (NIP-07 extension or NIP-46 bunker) injects the pubkey.
  const eventTemplate = {
    kind: FOLLOW_LIST_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: preservedTags,
    content: String(candidate.event.content ?? ''),
  };

  console.log('[FollowRecovery] Signing recovered kind:3', {
    tagCount: preservedTags.length,
    contentLength: eventTemplate.content.length,
    sourceEventId: candidate.eventId,
  });

  const signedEvent = await nostrService.signEventWithCurrentMethod(eventTemplate);
  console.log('[FollowRecovery] Signed event', signedEvent.id);

  // Publish via SimplePool so we read per-relay OK responses. PvZ's own
  // publishEventToRelays sends EVENT and reports success on socket-open without
  // ever reading the relay's OK reply — large kind:3 events frequently get
  // silently dropped that way (relay spam rules, size limits, etc.).
  const publishRelays = normalizeRelayList([
    ...(userRelays && userRelays.length ? userRelays : nostrService.relays),
    ...KNOWN_RELAYS,
  ]);

  console.log('[FollowRecovery] Publishing to', publishRelays.length, 'relays');

  const pool = new SimplePool();
  const settled = await Promise.allSettled(pool.publish(publishRelays, signedEvent));
  try { pool.close(publishRelays); } catch { /* best-effort */ }

  const accepted = [];
  const rejected = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      accepted.push(publishRelays[i]);
    } else {
      rejected.push({
        relay: publishRelays[i],
        reason: String(r.reason?.message || r.reason || 'unknown'),
      });
    }
  });

  console.log(`[FollowRecovery] Accepted by ${accepted.length}/${publishRelays.length} relays`);
  accepted.forEach((r) => console.log(`  ✓ ${r}`));
  rejected.forEach((r) => console.log(`  ✗ ${r.relay} — ${r.reason}`));

  if (accepted.length === 0) {
    const sample = rejected
      .slice(0, 3)
      .map((r) => `${r.relay}: ${r.reason}`)
      .join(' | ');
    throw new Error(
      `No relay accepted the recovered follow list. Sample errors: ${sample}`,
    );
  }

  return {
    successful: accepted.length,
    failed: rejected.length,
    total: publishRelays.length,
    accepted,
    rejected,
    eventId: signedEvent.id,
  };
}
