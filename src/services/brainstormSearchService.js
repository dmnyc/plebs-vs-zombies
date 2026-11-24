/**
 * Brainstorm search client
 *
 * Thin client for api.brainstorm.world — Brainstorm's Open Ranking search
 * (ORE-05). Free-text profile search over plain HTTP:
 *
 *   POST /search/pubkeys  {query, limit} → {results: [{pubkey, rank}], …}
 *
 * Results are pubkeys ranked by the instance's global GrapeRank — names and
 * pictures are NOT included, so callers resolve metadata themselves (relay
 * fetch or a cache). The endpoint sees the queried text; that is one more
 * centralized observer the relays never are. Best-effort throughout: every
 * failure resolves empty, and a 429 backs the whole service off per the
 * retry-after header.
 */

const BS_BASE = "https://api.brainstorm.world";
const DEFAULT_TIMEOUT_MS = 5000;

// Shared backoff state: a 429 from the search endpoint cools the service down.
let cooldownUntil = 0;

function available() {
  return Date.now() >= cooldownUntil;
}

function backoff(retryAfter) {
  const secs = Math.min(3600, Math.max(30, Number(retryAfter) || 60));
  cooldownUntil = Date.now() + secs * 1000;
}

// Test hook: the backoff is module-global, so tests need a way to clear it.
export function resetBackoff() {
  cooldownUntil = 0;
}

const isHex64 = (s) => typeof s === "string" && /^[0-9a-f]{64}$/i.test(s);

/**
 * Free-text profile search → [{pubkey, rank}] ordered by GrapeRank, best
 * first. Returns [] on any failure or rate-limit cooldown.
 */
export async function searchPubkeys(query, limit = 8, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!query || query.length < 2 || !available()) return [];
  try {
    const resp = await fetch(`${BS_BASE}/search/pubkeys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (resp.status === 429) {
      backoff(resp.headers.get("retry-after"));
      return [];
    }
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.results || [])
      .filter((r) => r && isHex64(r.pubkey))
      .map((r) => ({ pubkey: r.pubkey.toLowerCase(), rank: r.rank }));
  } catch (_) {
    return [];
  }
}
