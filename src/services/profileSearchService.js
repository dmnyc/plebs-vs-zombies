import { nip19 } from 'nostr-tools';
import nostrService from './nostrService';

/**
 * Service for searching and caching Nostr profiles
 * Supports npub, nprofile, and username search with autocomplete
 */
class ProfileSearchService {
  constructor() {
    this.profileCache = new Map(); // Cache profiles by pubkey
    this.searchCache = new Map(); // Cache search results
    this.maxCacheSize = 100;
    this.searchDebounceMs = 400; // Balanced debounce for responsive UX
    this.searchTimeoutId = null;
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
   * Uses client-side filtering of recent profile metadata events
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

      // Fetch recent profile metadata events (kind 0)
      // Use subscription approach with generous limit for comprehensive results
      const fetchLimit = 2000; // Fetch more events for better coverage
      const resultsLimit = limit;

      const filter = {
        kinds: [0],
        limit: fetchLimit
      };

      console.log('🔍 Fetching events from relays...');

      // Use subscription that filters and emits results progressively
      const profiles = [];
      const seenPubkeys = new Set();
      const queryLower = query.toLowerCase();
      let eventCount = 0;

      await new Promise((resolve, reject) => {
        // Longer timeout since we're fetching more events
        const timeout = setTimeout(() => {
          console.log(`⏱️ Timeout reached after ${eventCount} events, found ${profiles.length} matches`);
          resolve();
        }, 12000); // 12 second timeout for larger fetch

        const subscription = ndk.subscribe(filter, { closeOnEose: true });

        subscription.on('event', (event) => {
          eventCount++;

          // Filter and emit results progressively as events arrive
          if (!seenPubkeys.has(event.pubkey) && profiles.length < resultsLimit) {
            try {
              const content = JSON.parse(event.content);
              const name = (content.name || '').toLowerCase();
              const displayName = (content.display_name || '').toLowerCase();
              const nip05 = (content.nip05 || '').toLowerCase();

              // Check if query matches name, display_name, or nip05
              if (name.includes(queryLower) ||
                  displayName.includes(queryLower) ||
                  nip05.includes(queryLower)) {

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

                // Emit result progressively if callback provided
                if (onResult) {
                  onResult(profile);
                }

                // Stop subscription early if we have enough results
                if (profiles.length >= resultsLimit) {
                  subscription.stop();
                  clearTimeout(timeout);
                  console.log(`✅ Found ${profiles.length} matches, stopping search early`);
                  resolve();
                }
              }
            } catch (parseError) {
              console.debug('Failed to parse profile event:', parseError);
            }
          }
        });

        subscription.on('eose', () => {
          clearTimeout(timeout);
          console.log(`📥 EOSE reached after ${eventCount} events, found ${profiles.length} matches`);
          resolve();
        });

        subscription.on('close', () => {
          clearTimeout(timeout);
          console.log(`🔒 Subscription closed after ${eventCount} events`);
          resolve();
        });
      });

      console.log(`Found ${profiles.length} profiles matching "${query}"`);

      // Cache search results
      this.cacheSearchResults(cacheKey, profiles);
      return profiles;
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
