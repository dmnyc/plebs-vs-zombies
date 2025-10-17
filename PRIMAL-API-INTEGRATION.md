# Primal Cache API Integration Plan

## Discovery Summary

We discovered Primal's public cache API provides fast, comprehensive profile search capabilities that significantly improve upon our current relay-based search.

### Current Implementation Status

**Discovered API Details:**
- **Endpoint**: `wss://cache2.primal.net/v1` (also available: `wss://cache1.primal.net/v1`)
- **Format**: WebSocket-based JSON messages
- **Query Pattern**:
  ```json
  ["REQ", "unique_request_id", {
    "cache": [
      "user_search",
      {
        "query": "search_term",
        "limit": 10
      }
    ]
  }]
  ```
- **Response**: Returns profile events (kind 0) matching the query
- **Performance**: ~100-300ms vs 5-15s for relay search

### Search Strategy (Current)

Our profile search now follows this hierarchy:

1. **Well-known profiles cache** (DEPRECATED - instant, <1ms)
   - ~70 hardcoded profiles
   - Will be removed once Vertex is integrated

2. **Direct relay search** (5-15 seconds)
   - Queries multiple relays
   - Limited to ~6,000-7,000 recent events

### Search Strategy (After Primal Integration)

1. **Primal cache API** (primary - fast, 100-300ms)
   - Comprehensive profile database
   - Fast WebSocket-based search

2. **Well-known profiles cache** (fallback - instant)
   - For offline/degraded scenarios
   - Will be removed after Vertex integration

3. **Direct relay search** (last resort - slow)
   - When both Primal and cache unavailable

### Search Strategy (After Vertex Integration)

1. **Vertex API** (primary - fastest, most comprehensive)
   - Professional-grade search service
   - Used by npub.world

2. **Primal cache API** (fallback)
   - If Vertex unavailable

3. **Direct relay search** (last resort)
   - Offline mode

## Implementation Tasks

### Phase 1: Primal Integration (Next)
- [ ] Create `PrimalCacheService` class
- [ ] Implement WebSocket connection management
- [ ] Add `searchUsers(query, limit)` method
- [ ] Integrate into `ProfileSearchService`
- [ ] Add error handling and fallback logic
- [ ] Test in production

### Phase 2: Vertex Integration (Future)
- [ ] Apply for Vertex API access
- [ ] Review API documentation
- [ ] Create `VertexService` class
- [ ] Integrate as primary search method
- [ ] Remove deprecated well-known profiles cache
- [ ] Remove `wellKnownProfiles.json`
- [ ] Remove `fetch-well-known-profiles.js` script
- [ ] Remove GitHub Actions workflow

### Phase 3: Cleanup (After Vertex)
- [ ] Remove all deprecated code markers
- [ ] Update documentation
- [ ] Simplify search architecture

## Files to Modify (Primal Integration)

**New Files:**
- `src/services/primalCacheService.js` - WebSocket client for Primal cache

**Modified Files:**
- `src/services/profileSearchService.js` - Add Primal as primary search method

## Files to Remove (After Vertex Integration)

- `src/data/wellKnownProfiles.json`
- `scripts/fetch-well-known-profiles.js`
- `scripts/test-primal-search.js` (testing only)
- `scripts/test-primal-simple.js` (testing only)
- `.github/workflows/update-profiles.yml`

## Testing

**Test Script Created:**
- `scripts/test-primal-simple.js` - Validates Primal cache API
- Successfully tested with query "alex" - returned 10 relevant profiles including Alex Gleason

**Run test:**
```bash
node scripts/test-primal-simple.js
```

## Performance Comparison

| Method | Speed | Coverage | Reliability |
|--------|-------|----------|-------------|
| Well-known cache (deprecated) | <1ms | ~70 profiles | 100% |
| Primal cache | 100-300ms | Millions | High |
| Vertex API | TBD | All profiles | TBD |
| Direct relay search | 5-15s | ~6K recent | Medium |

## Notes

- Primal API is publicly available (no auth required)
- Primal is open source (MIT license)
- Multiple cache endpoints available (cache1, cache2)
- WebSocket-based for real-time responses
- Response includes full profile metadata (kind 0 events)
- Also returns media variants (kind 10000119) for profile images
