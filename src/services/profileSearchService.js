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
    this.searchDebounceMs = 300;
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
   * Search for profiles by name or display_name using NIP-50 search
   * @param {string} query - Search query
   * @param {number} limit - Maximum results to return
   * @returns {Promise<Array>} - Array of matching profiles
   */
  async searchProfiles(query, limit = 10) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `${query.toLowerCase()}_${limit}`;

    // Check search cache
    if (this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey);
    }

    try {
      // Use NDK with NIP-50 search capability
      const ndk = nostrService.ndk;

      if (!ndk) {
        console.warn('NDK not initialized');
        return [];
      }

      // NIP-50: Use search field for text search
      // This queries relays that support NIP-50 (relay.nostr.band does)
      const filter = {
        kinds: [0],
        search: query,
        limit: limit
      };

      console.log('Searching profiles with NIP-50:', filter);

      const events = await ndk.fetchEvents(filter, {
        closeOnEose: true,
        groupable: false
      });

      const profiles = [];
      const seenPubkeys = new Set();

      for (const event of events) {
        if (seenPubkeys.has(event.pubkey)) continue;

        try {
          const content = JSON.parse(event.content);

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

          if (profiles.length >= limit) break;
        } catch (parseError) {
          console.debug('Failed to parse profile event:', parseError);
        }
      }

      console.log(`Found ${profiles.length} profiles matching "${query}"`);

      // Cache search results
      this.cacheSearchResults(cacheKey, profiles);
      return profiles;
    } catch (error) {
      console.error('Profile search failed:', error);
      return [];
    }
  }

  /**
   * Debounced profile search
   * @param {string} query - Search query
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} - Array of profiles
   */
  debouncedSearch(query, limit = 10) {
    return new Promise((resolve) => {
      // Clear existing timeout
      if (this.searchTimeoutId) {
        clearTimeout(this.searchTimeoutId);
      }

      // Set new timeout
      this.searchTimeoutId = setTimeout(async () => {
        const results = await this.searchProfiles(query, limit);
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
