# Scope: replace Primal user search with nostrarchives.com (next PR)

Goal: stop using Primal's `user_search` cache for people-search across the app
and use the Nostr Archives search API instead. Primal *metadata* fallbacks are
noted but only partially in scope (see 3c).

## Verified API (probed live, 2026-10-30)

- `GET https://api.nostrarchives.com/v1/search?q=<name>&limit=N`
  → `{ query, profiles: [...], notes: [...] }`
  - profile: `{ pubkey, name, display_name, nip05, about, picture,
    follower_count, engagement_score, last_active_at, rank_score }`
  - results are ranked (`rank_score`) — relevance looks better than Primal's
    ordering; `notes` can be ignored for our use.
- `POST /v1/profiles/metadata` `{ pubkeys: [...] }` → pubkey→metadata (already
  used by the standalone zombiecheck page as a profile fallback).
- Quirks: param must be `q` (`query=` 400s); POST /v1/search is 405; one probe
  (`q=daniel`) hung >40s while `q=intuitiveguy` answered fast — client-side
  timeout + graceful degradation are mandatory.
- CORS: zombiecheck.html already calls the metadata endpoint from the browser,
  so the API is browser-accessible; re-verify `Access-Control-Allow-Origin` on
  /v1/search during implementation.

## Current Primal user_search touchpoints

1. `src/services/primalCacheService.js` — WS client (`cache1/cache2.primal.net`
   v1), `searchUsers(query, limit)`, `parseProfileEvent`. Also hosts Primal
   *metadata* fetches used elsewhere (out of scope, see 3c).
2. `src/services/profileSearchService.js` — `debouncedSearch()` merges relay
   (NDK) search + `primalCacheService.searchUsers`; consumed by:
   - `src/components/ProfileSearchInput.vue` (live dropdown; used on the
     landing, scout new-user modal, zombie check, follow tools)
   - `src/components/ZombieCheck.vue` (name resolution for `?q=` deep links)
3. `public/zombiecheck.html` — self-contained `searchUsers()` (own Primal WS +
   `PRIMAL_ENDPOINTS` failover) used by its live dropdown and `?q=` name
   resolution.
4. `src/services/nostrService.js` (~line 877) — uses `searchUsers(npub)` as a
   *metadata* fallback when relays return no profile.

## Plan

1. New `src/services/archivesSearchService.js`:
   - `searchProfiles(q, limit)` → GET /v1/search, 5s `AbortSignal.timeout`,
     map `profiles[]` to the app's profile shape
     (`{ pubkey, npub, name, display_name, picture, about, nip05 }` — npub via
     nip19), ignore `notes`, sort by `rank_score` desc.
2. `profileSearchService.debouncedSearch`: swap `primalCacheService.searchUsers`
   → `archivesSearchService.searchProfiles` (relays/NDK stay as the merge
   partner; no Primal fallback).
3. `public/zombiecheck.html`: rewrite `searchUsers()` to call /v1/search
   (keep the function name/call sites; keep `parseProfile` for shape mapping or
   adapt its callers), delete `PRIMAL_ENDPOINTS` WS code.
4. Optional same-PR cleanup (3c): `nostrService` metadata fallback → switch to
   NA `POST /v1/profiles/metadata` (zombiecheck.html's `fetchArchivesProfile`
   is the reference implementation). This removes the last `user_search`
   dependency; Primal WS service can then be deleted if nothing else uses it.

## Test plan

- Landing + logged-in live dropdown (type a name, check suggestions appear and
  rank sanely; identifier npub/hex path unchanged).
- Dashboard More Tools → Zombie Check / Scout Mode with a plain name (`?q=`).
- Zombie Check name resolution (SPA) and standalone `/zombiecheck?q=<name>`.
- Timeout path: block/fail the API (devtools) → dropdown still shows relay
  results, no unhandled rejections.
- `npm test` (profileSearchService may have unit tests mocking Primal — update
  fixtures to the NA response shape).

## Effort

~1-2 hours: one new service, two call-site families, standalone page, tests.
