import { nip19 } from 'nostr-tools';
import nostrService from './nostrService';
import primalCacheService from './primalCacheService';

// DEPRECATED: This cache will be removed once Vertex API is integrated
// Currently used as fallback when Primal cache is unavailable
import wellKnownProfilesData from '../data/wellKnownProfiles.json';

/**
 * Service for searching and caching Nostr profiles
 *
 * Search Strategy (in order):
 * 1. Primal cache API (primary) - Fast, comprehensive search (~100-300ms)
 * 2. Well-known profiles cache (deprecated fallback) - Will be removed when Vertex is integrated
 * 3. Direct relay search (last resort) - Slow but works offline (5-15s)
 *
 * Supports npub, nprofile, and username search with autocomplete
 */
class ProfileSearchService {
  constructor() {
    this.profileCache = new Map(); // Cache profiles by pubkey
    this.searchCache = new Map(); // Cache search results
    this.maxCacheSize = 100;
    this.searchDebounceMs = 400; // Balanced debounce for responsive UX
    this.searchTimeoutId = null;

    // DEPRECATED: Load well-known profiles from JSON file
    // These are popular Nostr accounts that might not appear in recent relay events
    // This will be replaced by Vertex API integration
    this.wellKnownProfiles = wellKnownProfilesData;

    // Primal cache settings
    this.usePrimalCache = true; // Enable/disable Primal cache
    this.primalCacheTimeout = 3000; // 3 second timeout for Primal
  }

  /**
   * Parse various Nostr identifier formats (npub, nprofile, hex pubkey)
   * @param {string} identifier - The identifier to parse
   * @returns {Object|null} - {pubkey: string, relays?: string[]} or null if invalid
   */
  parseIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') {
      return null;
    }

    const trimmed = identifier.trim();

    try {
      // Try to decode as npub or nprofile
      if (trimmed.startsWith('npub1') || trimmed.startsWith('nprofile1')) {
        const decoded = nip19.decode(trimmed);

        if (decoded.type === 'npub') {
          return { pubkey: decoded.data };
        } else if (decoded.type === 'nprofile') {
          return {
            pubkey: decoded.data.pubkey,
            relays: decoded.data.relays || []
          };
        }
      }

      // Try as raw hex pubkey (64 hex characters)
      if (/^[0-9a-f]{64}$/i.test(trimmed)) {
        return { pubkey: trimmed.toLowerCase() };
      }

      return null;
    } catch (error) {
      console.debug('Failed to parse identifier:', error);
      return null;
    }
  }

  /**
   * Fetch profile metadata for a pubkey
   * @param {string} pubkey - The pubkey to fetch
   * @param {string[]} relays - Optional relay hints
   * @returns {Promise<Object|null>} - Profile metadata or null
   */
  async fetchProfile(pubkey, relays = []) {
    // Check cache first
    if (this.profileCache.has(pubkey)) {
      return this.profileCache.get(pubkey);
    }

    try {
      // Use nostrService to fetch profile
      const profileMap = await nostrService.getProfileMetadata([pubkey]);
      const profile = profileMap.get(pubkey);

      if (profile) {
        const profileData = {
          pubkey,
          name: profile.name,
          display_name: profile.display_name,
          picture: profile.picture,
          nip05: profile.nip05,
          about: profile.about,
          npub: nip19.npubEncode(pubkey)
        };

        // Cache the profile
        this.cacheProfile(pubkey, profileData);
        return profileData;
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
  }

  /**
   * Search for profiles by name or display_name
   *
   * Strategy:
   * 1. Try Primal cache API (fast, comprehensive)
   * 2. Fall back to well-known profiles cache (instant, limited)
   * 3. Fall back to relay search (slow, comprehensive)
   *
   * @param {string} query - Search query
   * @param {number} limit - Maximum results to return
   * @param {Function} onResult - Optional callback for progressive results (result) => void
   * @returns {Promise<Array>} - Array of matching profiles
   */
  async searchProfiles(query, limit = 10, onResult = null) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `${query.toLowerCase()}_${limit}`;

    // Check search cache
    if (this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey);
    }

    try {
      // Strategy 1: Try Primal cache first (if enabled)
      if (this.usePrimalCache) {
        try {
          console.log(`🔍 Searching Primal cache for "${query}"...`);
          const primalResults = await Promise.race([
            primalCacheService.searchUsers(query, limit),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Primal timeout')), this.primalCacheTimeout)
            )
          ]);

          if (primalResults && primalResults.length > 0) {
            console.log(`✅ Primal cache returned ${primalResults.length} results`);

            // Parse profile events and add npub
            const profiles = primalResults
              .map(event => {
                const profile = primalCacheService.parseProfileEvent(event);
                if (profile) {
                  // Filter out mostr.pub bridged profiles (Mastodon bridge)
                  if (profile.nip05 && profile.nip05.includes('mostr.pub')) {
                    return null;
                  }

                  profile.npub = nip19.npubEncode(profile.pubkey);
                  // Cache the profile
                  this.cacheProfile(profile.pubkey, profile);

                  // Emit progressively if callback provided
                  if (onResult) {
                    onResult(profile);
                  }
                }
                return profile;
              })
              .filter(p => p !== null);

            // Cache and return results
            this.cacheSearchResults(cacheKey, profiles);
            return profiles;
          }
        } catch (primalError) {
          console.warn('⚠️ Primal cache search failed, falling back:', primalError.message);
          // Fall through to next strategy
        }
      }

      // Strategy 2: Fall back to well-known profiles + relay search
      // Ensure NDK is initialized (works without signer for public data)
      let ndk = nostrService.ndk;

      if (!ndk) {
        console.log('🔧 NDK not initialized, initializing for profile search...');
        await nostrService.initialize();
        ndk = nostrService.ndk;

        if (!ndk) {
          console.warn('❌ Failed to initialize NDK');
          return [];
        }
      }

      console.log(`Searching profiles for "${query}"...`);

      // Strategy: Client-side filtering with optimized relay queries
      // NIP-50 is not widely supported, so we use client-side filtering
      // with a large enough sample size to find common profiles

      const resultsLimit = limit;
      const profiles = [];
      const seenPubkeys = new Set();
      const queryLower = query.toLowerCase();

      // First, check well-known profiles for matches
      const wellKnownMatches = this.wellKnownProfiles.filter(wk =>
        wk.names.some(name => name.includes(queryLower) || queryLower.includes(name))
      );

      // Fetch metadata for well-known matches
      for (const wkProfile of wellKnownMatches) {
        try {
          const parsed = this.parseIdentifier(wkProfile.npub);
          if (parsed && !seenPubkeys.has(parsed.pubkey)) {
            // Try to fetch metadata, but create minimal profile if unavailable
            let profile = await this.fetchProfile(parsed.pubkey);

            if (!profile) {
              // Create minimal profile from well-known data
              profile = {
                pubkey: parsed.pubkey,
                npub: wkProfile.npub,
                name: wkProfile.names[0], // Use first name from well-known list
                display_name: wkProfile.names[0],
                picture: null,
                nip05: null,
                about: wkProfile.note || ''
              };
            }

            profiles.push(profile);
            seenPubkeys.add(parsed.pubkey);

            // Emit progressively
            if (onResult) {
              onResult(profile);
            }
          }
        } catch (error) {
          console.debug('Failed to fetch well-known profile:', error);
        }
      }

      console.log(`📌 Found ${profiles.length} well-known profile matches`);

      // If we already have enough results from well-known profiles, return early
      if (profiles.length >= resultsLimit) {
        console.log(`✅ Returning ${profiles.length} well-known profiles`);
        this.cacheSearchResults(cacheKey, profiles);
        return profiles;
      }

      // Fetch a large sample of profile events
      console.log('🔍 Fetching additional profile events from relays...');

      // Strategy: Request more events per relay by not setting a global limit
      // Instead, let each relay return its limit
      const filter = {
        kinds: [0],
        limit: 10000 // Higher limit to get more diverse profiles
      };

      let eventCount = 0;
      const searchTimeout = 15000; // 15 second timeout to allow more events

      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log(`⏱️ Search timeout after ${eventCount} events, found ${profiles.length} matches`);
          resolve();
        }, searchTimeout);

        const subscription = ndk.subscribe(filter, { closeOnEose: true });

        subscription.on('event', (event) => {
          eventCount++;

          // Skip if already seen or have enough results
          if (seenPubkeys.has(event.pubkey) || profiles.length >= resultsLimit) {
            return;
          }

          try {
            const content = JSON.parse(event.content);
            const name = (content.name || '').toLowerCase();
            const displayName = (content.display_name || '').toLowerCase();
            const nip05 = (content.nip05 || '').toLowerCase();

            // Filter out mostr.pub bridged profiles
            if (nip05.includes('mostr.pub')) {
              return;
            }

            // Check if query matches name, display_name, or nip05
            // Use multiple matching strategies for better results
            const queryWords = queryLower.split(/\s+/); // Split on whitespace
            const nameWords = name.split(/\s+/);
            const displayNameWords = displayName.split(/\s+/);

            // Match if:
            // 1. Direct substring match in name, display_name, or nip05
            // 2. All query words appear in name or display_name (for multi-word queries)
            // 3. Query matches start of any word in name or display_name

            const hasDirectMatch = name.includes(queryLower) ||
                                  displayName.includes(queryLower) ||
                                  nip05.includes(queryLower);

            const hasWordMatch = queryWords.every(qWord =>
              nameWords.some(nWord => nWord.includes(qWord)) ||
              displayNameWords.some(dWord => dWord.includes(qWord))
            );

            const hasStartMatch = nameWords.some(nWord => nWord.startsWith(queryLower)) ||
                                 displayNameWords.some(dWord => dWord.startsWith(queryLower));

            if (hasDirectMatch || hasWordMatch || hasStartMatch) {

              const profile = {
                pubkey: event.pubkey,
                name: content.name,
                display_name: content.display_name,
                picture: content.picture,
                nip05: content.nip05,
                about: content.about,
                npub: nip19.npubEncode(event.pubkey)
              };

              profiles.push(profile);
              seenPubkeys.add(event.pubkey);
              this.cacheProfile(event.pubkey, profile);

              // Emit progressively
              if (onResult) {
                onResult(profile);
              }

              // Stop early if we have enough results
              if (profiles.length >= resultsLimit) {
                subscription.stop();
                clearTimeout(timeout);
                console.log(`✅ Found ${profiles.length} matches, stopping early`);
                resolve();
              }
            }
          } catch (parseError) {
            console.debug('Failed to parse profile event:', parseError);
          }
        });

        subscription.on('eose', () => {
          clearTimeout(timeout);
          console.log(`📥 EOSE after ${eventCount} events, found ${profiles.length} matches`);
          resolve();
        });

        subscription.on('close', () => {
          clearTimeout(timeout);
          console.log(`🔒 Subscription closed after ${eventCount} events`);
          resolve();
        });
      });

      console.log(`Found ${profiles.length} profiles matching "${query}"`);

      // Cache and return results
      this.cacheSearchResults(cacheKey, profiles);
      return profiles;

      // OLD NIP-50 approach (keeping for reference but not using)
      // NIP-50 is not widely supported by relays
      /*
      console.log('🔍 Attempting NIP-50 search...');
      try {
        const nip50Filter = {
          kinds: [0],
          search: query,
          limit: resultsLimit * 2 // Request more to account for filtering
        };

        // Use a promise with timeout for NIP-50 search
        const nip50SearchPromise = new Promise(async (resolve) => {
          const events = new Set();
          const subscription = ndk.subscribe(nip50Filter, { closeOnEose: true });

          subscription.on('event', (event) => {
            events.add(event);
          });

          subscription.on('eose', () => {
            console.log(`📥 NIP-50 search EOSE: ${events.size} events`);
            resolve(events);
          });

          // Timeout after 5 seconds for NIP-50
          setTimeout(() => {
            subscription.stop();
            console.log(`⏱️ NIP-50 search timeout: ${events.size} events`);
            resolve(events);
          }, 5000);
        });

        const nip50Events = await nip50SearchPromise;
        console.log(`📥 NIP-50 search returned ${nip50Events.size} events`);

        for (const event of nip50Events) {
          if (seenPubkeys.has(event.pubkey)) continue;

          try {
            const content = JSON.parse(event.content);
            const nip05 = (content.nip05 || '').toLowerCase();

            // Filter out mostr.pub bridged profiles
            if (nip05.includes('mostr.pub')) {
              continue;
            }

            const profile = {
              pubkey: event.pubkey,
              name: content.name,
              display_name: content.display_name,
              picture: content.picture,
              nip05: content.nip05,
              about: content.about,
              npub: nip19.npubEncode(event.pubkey)
            };

            profiles.push(profile);
            seenPubkeys.add(event.pubkey);
            this.cacheProfile(event.pubkey, profile);

            // Emit progressively
            if (onResult) {
              onResult(profile);
            }

            if (profiles.length >= resultsLimit) {
              break;
            }
          } catch (parseError) {
            console.debug('Failed to parse NIP-50 event:', parseError);
          }
        }

        console.log(`✅ NIP-50 search found ${profiles.length} profiles`);

        // If we found enough results, return early
        if (profiles.length >= resultsLimit) {
          this.cacheSearchResults(cacheKey, profiles);
          return profiles;
        }
      } catch (nip50Error) {
        console.warn('⚠️ NIP-50 search failed or not supported:', nip50Error.message);
      }
      */
    } catch (error) {
      if (error.message === 'Search timeout') {
        console.warn('Profile search timed out, returning empty results');
      } else {
        console.error('Profile search failed:', error);
      }
      return [];
    }
  }

  /**
   * Debounced profile search
   * @param {string} query - Search query
   * @param {number} limit - Maximum results
   * @param {Function} onResult - Optional callback for progressive results
   * @returns {Promise<Array>} - Array of profiles
   */
  debouncedSearch(query, limit = 10, onResult = null) {
    return new Promise((resolve) => {
      // Clear existing timeout
      if (this.searchTimeoutId) {
        clearTimeout(this.searchTimeoutId);
      }

      // Set new timeout
      this.searchTimeoutId = setTimeout(async () => {
        const results = await this.searchProfiles(query, limit, onResult);
        resolve(results);
      }, this.searchDebounceMs);
    });
  }

  /**
   * Get or fetch a profile by identifier (npub, nprofile, or hex)
   * @param {string} identifier - The identifier
   * @returns {Promise<Object|null>} - Profile data or null
   */
  async getProfileByIdentifier(identifier) {
    const parsed = this.parseIdentifier(identifier);

    if (!parsed) {
      return null;
    }

    return await this.fetchProfile(parsed.pubkey, parsed.relays);
  }

  /**
   * Cache a profile
   * @param {string} pubkey - Profile pubkey
   * @param {Object} profile - Profile data
   */
  cacheProfile(pubkey, profile) {
    // Implement LRU cache
    if (this.profileCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.profileCache.keys().next().value;
      this.profileCache.delete(firstKey);
    }
    this.profileCache.set(pubkey, profile);
  }

  /**
   * Cache search results
   * @param {string} cacheKey - Search cache key
   * @param {Array} results - Search results
   */
  cacheSearchResults(cacheKey, results) {
    // Implement LRU cache for search results
    if (this.searchCache.size >= this.maxCacheSize) {
      const firstKey = this.searchCache.keys().next().value;
      this.searchCache.delete(firstKey);
    }
    this.searchCache.set(cacheKey, results);
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.profileCache.clear();
    this.searchCache.clear();
  }

  /**
   * Get cached profile
   * @param {string} pubkey - Profile pubkey
   * @returns {Object|null} - Cached profile or null
   */
  getCachedProfile(pubkey) {
    return this.profileCache.get(pubkey) || null;
  }
}

// Export singleton instance
const profileSearchService = new ProfileSearchService();
export default profileSearchService;
