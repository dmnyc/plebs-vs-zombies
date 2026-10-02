/**
 * Nostr Archives name-index client
 *
 * Thin client for api.nostrarchives.com — the same third-party name index
 * Sidecar uses for name lookups. Two endpoints:
 *
 *   GET  /v1/search/suggest?q=…   → global username search (discovery)
 *   POST /v1/profiles/metadata    → bulk name/picture resolution by pubkey
 *
 * The index sees the queried text and the sent pubkeys. Everything sent is
 * public Nostr data (this app is all about searching public data), but it is
 * a centralized observer the relays never are — call sites should keep that
 * trade in mind. Best-effort throughout: every failure resolves empty, and a
 * 429 backs the whole service off per the retry-after header.
 */

const NA_BASE = "https://api.nostrarchives.com";
const CHUNK_SIZE = 500; // API's max pubkeys per metadata call

// Shared backoff state: a 429 from any endpoint cools the whole service down.
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

const pickName = (p) => p.display_name || p.preferred_name || p.name || null;

/**
 * Global username search → [{pubkey, name, picture}]. Returns [] on any
 * failure or rate-limit cooldown.
 */
export async function suggestNames(query, limit = 8, timeoutMs = 5000) {
  if (!query || query.length < 2 || !available()) return [];
  try {
    const resp = await fetch(
      `${NA_BASE}/v1/search/suggest?q=${encodeURIComponent(query)}&limit=${limit}`,
      { signal: AbortSignal.timeout(timeoutMs) },
    );
    if (resp.status === 429) {
      backoff(resp.headers.get("retry-after"));
      return [];
    }
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.suggestions || [])
      .filter((s) => s && isHex64(s.pubkey))
      .map((s) => {
        const name = pickName(s);
        return {
          pubkey: s.pubkey.toLowerCase(),
          name,
          display_name: name,
          picture: s.picture || null,
        };
      });
  } catch (_) {
    return [];
  }
}

/**
 * Bulk profile metadata for a set of pubkeys → Map(pubkey → {name,
 * display_name, preferred_name, picture, nip05, lud16}). Chunks to the API's
 * 500-pubkey limit; a rate-limit stops the remaining chunks, network errors
 * skip to the next one. Missing/unknown pubkeys are simply absent from the
 * map.
 */
export async function getProfilesMetadata(pubkeys, timeoutMs = 8000) {
  const out = new Map();
  const ids = [
    ...new Set((pubkeys || []).filter(isHex64).map((p) => p.toLowerCase())),
  ];
  if (!ids.length || !available()) return out;

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    try {
      const resp = await fetch(`${NA_BASE}/v1/profiles/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pubkeys: chunk }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (resp.status === 429) {
        backoff(resp.headers.get("retry-after"));
        break;
      }
      if (!resp.ok) continue;
      const data = await resp.json();
      (data.profiles || []).forEach((p) => {
        if (p && isHex64(p.pubkey)) {
          out.set(p.pubkey.toLowerCase(), {
            name: p.name || null,
            display_name: p.display_name || null,
            preferred_name: p.preferred_name || null,
            picture: p.picture || null,
            nip05: p.nip05 || null,
            lud16: p.lud16 || null,
          });
        }
      });
    } catch (_) {
      // Network error on this chunk — keep whatever resolved so far.
    }
  }
  return out;
}

/**
 * True when a metadata record actually identifies someone. The API echoes
 * unknown pubkeys back with all-null fields, which is not a find.
 */
export function hasIdentity(meta) {
  return !!meta && !!(meta.name || meta.display_name || meta.preferred_name || meta.picture);
}
