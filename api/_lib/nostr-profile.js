// Shared profile resolution for the zombiecheck edge functions
// (zombiecheck-preview + zombiecheck-og). Both run on the Vercel edge
// runtime, so everything here sticks to plain fetch + module-scope caches.

import { nip19 } from 'nostr-tools';

// npub / nprofile / hex → lowercase hex pubkey, or null when the value can't
// be trusted. Deep-link params are visitor-supplied, so callers treat null as
// "serve the generic card" rather than an error.
export function resolveHex(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.startsWith('npub1') || value.startsWith('nprofile1')) {
    try {
      const decoded = nip19.decode(value);
      if (decoded.type === 'nprofile') return decoded.data.pubkey;
      if (decoded.type === 'npub') return decoded.data;
    } catch (_) {
      return null;
    }
    return null;
  }
  if (/^[0-9a-f]{64}$/i.test(value)) return value.toLowerCase();
  return null;
}

export function canonicalNpub(hex) {
  return nip19.npubEncode(hex);
}

// Name + picture lookup over plain HTTP. Relays and the Primal cache are
// WebSocket-only, which the edge runtime can't dial outbound, so the Nostr
// Archives name index — the same third-party source the zombiecheck page
// itself falls back to — is the one server-side source. Best-effort by
// design: any failure means "no identity", and callers fall back to the
// generic static card.
const ARCHIVES_ENDPOINT = 'https://api.nostrarchives.com/v1/profiles/metadata';

const PROFILE_TTL_MS = 6 * 60 * 60 * 1000;      // found profiles: 6h
const NEGATIVE_TTL_MS = 30 * 60 * 1000;         // not-found / errors: 30min
const CACHE_CAP = 500;

const profileCache = new Map(); // hex → { expires, profile }

function cacheGet(hex) {
  const hit = profileCache.get(hex);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    profileCache.delete(hex);
    return undefined;
  }
  return hit.profile;
}

function cacheSet(hex, profile) {
  if (profileCache.size >= CACHE_CAP) profileCache.clear();
  profileCache.set(hex, {
    expires: Date.now() + (profile ? PROFILE_TTL_MS : NEGATIVE_TTL_MS),
    profile,
  });
}

// Resolves to { name, display_name, picture } or null. Never rejects.
export async function fetchArchivesProfile(hex) {
  const cached = cacheGet(hex);
  if (cached !== undefined) return cached;
  let profile = null;
  try {
    const resp = await fetch(ARCHIVES_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkeys: [hex] }),
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json();
      const p = (data.profiles || []).find(
        (p) => p && typeof p.pubkey === 'string' && p.pubkey.toLowerCase() === hex,
      );
      if (p) {
        const name = p.display_name || p.preferred_name || p.name || null;
        // known-but-empty entries aren't a find (same rule as the page)
        if (name || p.picture) {
          profile = { name, display_name: p.display_name || name, picture: p.picture || null };
        }
      }
    }
  } catch (_) {
    profile = null; // timeout/5xx — the generic card is the answer
  }
  cacheSet(hex, profile);
  return profile;
}
