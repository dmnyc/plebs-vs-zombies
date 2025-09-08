import NDK, { NDKEvent, NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

class NostrService {
  constructor() {
    this.ndk = null;
    this.pubkey = null;
    this.userProfile = null;
    this.follows = new Map();
    this.relays = [
      'wss://relay.damus.io',
      'wss://relay.nostr.band', 
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://nostr.wine'
      // Removed problematic relays: relay.nostrich.de, relay.current.fyi, nostr.mutinywallet.com, relay.snort.social
    ];
  }

  async initialize() {
    if (!this.ndk) {
      // Create NDK with NIP-07 signer if available
      let signer = null;
      if (typeof window.nostr !== 'undefined') {
        signer = new NDKNip07Signer();
      }
      
      this.ndk = new NDK({
        explicitRelayUrls: this.relays,
        signer: signer
      });
      await this.ndk.connect();
    }
    return this.ndk;
  }

  async getPublicKey() {
    if (typeof window.nostr === 'undefined') {
      throw new Error('No Nostr extension found');
    }
    
    const pubkey = await window.nostr.getPublicKey();
    this.pubkey = pubkey;
    
    // Load user profile after getting pubkey
    await this.loadUserProfile();
    
    // Save session for persistence
    this.saveSession();
    
    return pubkey;
  }

  async loadUserProfile() {
    if (!this.pubkey) return null;
    
    try {
      await this.initialize();
      
      const filter = {
        kinds: [0],
        authors: [this.pubkey],
        limit: 1
      };
      
      const events = await this.ndk.fetchEvents(filter);
      const eventArray = Array.from(events);
      
      if (eventArray.length > 0) {
        const profileEvent = eventArray[0];
        const profileData = JSON.parse(profileEvent.content);
        
        this.userProfile = {
          pubkey: this.pubkey,
          name: profileData.name || null,
          display_name: profileData.display_name || profileData.displayName || null,
          about: profileData.about || null,
          picture: profileData.picture || null,
          nip05: profileData.nip05 || null
        };
      } else {
        // Create a basic profile even if no events found
        this.userProfile = {
          pubkey: this.pubkey,
          name: null,
          display_name: null,
          about: null,
          picture: null,
          nip05: null
        };
      }
      
      return this.userProfile;
    } catch (error) {
      console.error('Failed to load user profile:', error);
      return null;
    }
  }

  npubToHex(npub) {
    try {
      const { data } = nip19.decode(npub);
      return data;
    } catch (error) {
      console.error('Invalid npub format:', error);
      return null;
    }
  }

  hexToNpub(hex) {
    try {
      // Validate hex format: should be exactly 64 characters (32 bytes)
      if (!hex || typeof hex !== 'string' || hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
        console.warn(`Invalid pubkey format: "${hex}" (length: ${hex?.length || 0})`);
        return null;
      }
      return nip19.npubEncode(hex);
    } catch (error) {
      console.error('Invalid hex format:', error);
      return null;
    }
  }

  async debugSpecificUser(pubkey) {
    console.log(`=== DEBUG: Testing activity detection for ${pubkey.substring(0, 8)}... ===`);
    
    await this.initialize();
    
    // Test multiple queries
    const queries = [
      {
        name: 'Recent posts (30 days)',
        filter: {
          kinds: [1],
          authors: [pubkey],
          limit: 10,
          since: Math.floor((Date.now() - (30 * 24 * 60 * 60 * 1000)) / 1000)
        }
      },
      {
        name: 'Any posts (no time limit)',
        filter: {
          kinds: [1],
          authors: [pubkey],
          limit: 10
        }
      },
      {
        name: 'All activity types (30 days)',
        filter: {
          kinds: [0, 1, 3, 6, 7, 9735],
          authors: [pubkey],
          limit: 20,
          since: Math.floor((Date.now() - (30 * 24 * 60 * 60 * 1000)) / 1000)
        }
      },
      {
        name: 'Profile updates only',
        filter: {
          kinds: [0],
          authors: [pubkey],
          limit: 5
        }
      }
    ];
    
    for (const query of queries) {
      try {
        console.log(`Testing: ${query.name}`);
        const events = await this.ndk.fetchEvents(query.filter);
        console.log(`  Found ${events.size} events`);
        
        for (const event of events) {
          console.log(`  - Kind ${event.kind} at ${new Date(event.created_at * 1000).toISOString()}`);
          if (event.content && event.content.length > 0) {
            console.log(`    Content: ${event.content.substring(0, 100)}${event.content.length > 100 ? '...' : ''}`);
          }
        }
      } catch (error) {
        console.error(`  Error: ${error.message}`);
      }
    }
    
    console.log(`=== END DEBUG ===`);
  }

  async getProfileMetadata(pubkeys) {
    if (!pubkeys || pubkeys.length === 0) {
      return new Map();
    }

    await this.initialize();
    
    // Filter out invalid pubkeys first
    const validPubkeys = pubkeys.filter(pubkey => {
      if (!pubkey || typeof pubkey !== 'string' || pubkey.length !== 64 || !/^[0-9a-fA-F]+$/.test(pubkey)) {
        console.warn(`Skipping invalid pubkey: "${pubkey}" (length: ${pubkey?.length || 0})`);
        return false;
      }
      return true;
    });
    
    console.log(`Filtered pubkeys: ${validPubkeys.length} valid out of ${pubkeys.length} total`);
    
    const profileMap = new Map();
    
    // Initialize with empty profiles (only for valid pubkeys)
    validPubkeys.forEach(pubkey => {
      profileMap.set(pubkey, {
        pubkey,
        name: null,
        display_name: null,
        about: null,
        picture: null,
        nip05: null,
        deleted: false,
        npub: this.hexToNpub(pubkey),
        lastSeen: null
      });
    });
    
    // Batch in groups of 25 for profile metadata (use validPubkeys)
    const batchSize = 25;
    for (let i = 0; i < validPubkeys.length; i += batchSize) {
      const batch = validPubkeys.slice(i, i + batchSize);
      
      try {
        console.log(`Fetching profiles for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(validPubkeys.length/batchSize)}...`);
        
        // Get kind 0 (profile) events
        const profileFilter = {
          kinds: [0],
          authors: batch,
          limit: 50
        };
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
        );
        
        const events = await Promise.race([
          this.ndk.fetchEvents(profileFilter),
          timeoutPromise
        ]);
        
        // Process profile events
        const profileEvents = new Map();
        for (const event of events) {
          const existing = profileEvents.get(event.pubkey);
          if (!existing || event.created_at > existing.created_at) {
            profileEvents.set(event.pubkey, event);
          }
        }
        
        // Parse profile data
        for (const [pubkey, event] of profileEvents) {
          try {
            const profile = JSON.parse(event.content);
            const existingProfile = profileMap.get(pubkey);
            
            profileMap.set(pubkey, {
              ...existingProfile,
              name: profile.name || null,
              display_name: profile.display_name || profile.displayName || null,
              about: profile.about || null,
              picture: profile.picture || null,
              nip05: profile.nip05 || null,
              deleted: profile.deleted === true || profile.deleted === 'true',
              lastSeen: event.created_at
            });
          } catch (error) {
            console.error(`Failed to parse profile for ${pubkey}:`, error);
          }
        }
        
        // Add small delay between batches
        if (i + batchSize < pubkeys.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`Failed to fetch profiles for batch starting at ${i}:`, error);
      }
    }
    
    console.log(`Profile fetch complete. Found metadata for ${Array.from(profileMap.values()).filter(p => p.name || p.display_name).length} out of ${pubkeys.length} profiles.`);
    
    return profileMap;
  }

  async getFollowList() {
    if (!this.pubkey) {
      throw new Error('Public key not set');
    }

    await this.initialize();
    
    // Get the most recent kind 3 (contacts) event with a longer timeout
    const followListFilter = {
      kinds: [3],
      authors: [this.pubkey],
      limit: 5 // Get a few recent events to ensure we have the latest
    };
    
    console.log('Fetching follow list...');
    const events = await this.ndk.fetchEvents(followListFilter);
    
    if (!events || events.size === 0) {
      console.log('No follow list events found');
      return [];
    }

    // Convert to array and sort by created_at to get the most recent
    const eventArray = Array.from(events).sort((a, b) => b.created_at - a.created_at);
    const mostRecentEvent = eventArray[0];
    
    console.log(`Found ${eventArray.length} follow list events, using most recent from ${new Date(mostRecentEvent.created_at * 1000)}`);
    
    // Extract and validate follow list - only include valid 64-character hex pubkeys
    const rawFollowList = mostRecentEvent.tags
      .filter(tag => tag[0] === 'p' && tag[1]) // Ensure tag[1] exists
      .map(tag => tag[1]);
    
    console.log(`Raw follow list contains ${rawFollowList.length} entries`);
    
    // Validate each entry is a proper 64-character hex pubkey
    const validFollowList = rawFollowList.filter(pubkey => {
      if (!pubkey || typeof pubkey !== 'string') {
        console.warn(`Filtering out non-string follow entry: ${typeof pubkey} "${pubkey}"`);
        return false;
      }
      
      if (pubkey.length !== 64) {
        console.warn(`Filtering out invalid length pubkey: "${pubkey}" (length: ${pubkey.length})`);
        return false;
      }
      
      if (!/^[0-9a-fA-F]+$/.test(pubkey)) {
        console.warn(`Filtering out non-hex pubkey: "${pubkey}"`);
        return false;
      }
      
      return true;
    });
    
    const filteredCount = rawFollowList.length - validFollowList.length;
    if (filteredCount > 0) {
      console.warn(`⚠️ Filtered out ${filteredCount} invalid entries from follow list`);
    }
    
    console.log(`Valid follow list contains ${validFollowList.length} follows`);
    return validFollowList;
  }

  async getProfilesActivity(pubkeys, limit = 10, progressCallback = null) {
    if (!pubkeys || pubkeys.length === 0) {
      return new Map();
    }

    await this.initialize();
    
    // Get recent posts for each pubkey to determine activity
    const activityMap = new Map();
    
    // Initialize all pubkeys with empty arrays
    pubkeys.forEach(pubkey => {
      activityMap.set(pubkey, []);
    });
    
    // Use smaller batches to improve reliability 
    const batchSize = 10;
    for (let i = 0; i < pubkeys.length; i += batchSize) {
      const batch = pubkeys.slice(i, i + batchSize);
      
      try {
        // Cast an extremely wide net for activity detection to prevent false positives
        // Look back much further and include more event types
        const filter = {
          kinds: [
            0,     // Profile metadata
            1,     // Text notes (posts)
            2,     // Recommend relay
            3,     // Contacts (follow lists)
            4,     // Encrypted DMs
            5,     // Event deletion
            6,     // Reposts
            7,     // Reactions (likes)
            8,     // Badge award
            9,     // Group chat message
            10,    // Group chat threaded reply
            11,    // Group thread
            12,    // Group thread reply
            40,    // Channel creation
            41,    // Channel metadata
            42,    // Channel message
            43,    // Channel hide message
            44,    // Channel mute user
            1063,  // File metadata
            1311,  // Live chat message
            1984,  // Reporting
            1985,  // Label
            9734,  // Zap request
            9735,  // Zap receipt
            10000, // Mute list
            10001, // Pin list
            10002, // Relay list metadata
            30000, // People lists
            30001, // Music lists
            30008, // Profile badges
            30009, // Badge definition
            30017, // Create or update a stall
            30018, // Create or update a product
            30023, // Long-form content
            30024, // Draft long-form content
            31890, // DVM job request
            31922, // Date-based calendar event
            31923, // Time-based calendar event
            31924, // Calendar
            31925, // Calendar event RSVP
            31989, // Handler recommendation
            31990, // Handler information
            34550  // Community definition
          ],
          authors: batch,
          limit: limit * 5, // Even more events per author
          since: Math.floor((Date.now() - (365 * 24 * 60 * 60 * 1000)) / 1000) // Look back a full year to catch any activity
        };
        
        console.log(`🔍 BATCH FILTER: Looking for events since ${new Date(filter.since * 1000).toISOString()} (${Math.floor((Date.now() / 1000 - filter.since) / (24 * 60 * 60))} days ago)`);
        
        const batchNum = Math.floor(i/batchSize) + 1;
        const totalBatches = Math.ceil(pubkeys.length/batchSize);
        console.log(`Fetching activity for batch ${batchNum}/${totalBatches}...`);
        
        // Report progress
        if (progressCallback) {
          progressCallback({
            total: pubkeys.length,
            processed: i,
            stage: `Fetching activity batch ${batchNum}/${totalBatches}`,
            currentNpub: batch[0].substring(0, 8) + '...'
          });
        }
        
        // Shorter timeout for faster failure detection
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 8000)
        );
        
        let events;
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
          try {
            const attemptTimeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), 8000)
            );
            
            events = await Promise.race([
              this.ndk.fetchEvents(filter),
              attemptTimeoutPromise
            ]);
            
            console.log(`Batch ${Math.floor(i/batchSize) + 1}: Found ${events.size} events for ${batch.length} authors`);
            break; // Success, exit retry loop
            
          } catch (error) {
            retryCount++;
            if (retryCount <= maxRetries) {
              console.log(`Batch ${Math.floor(i/batchSize) + 1} failed (attempt ${retryCount}), retrying...`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
            } else {
              throw error; // Final failure
            }
          }
        }
        
        for (const event of events) {
          const pubkey = event.pubkey;
          
          const currentEvents = activityMap.get(pubkey) || [];
          currentEvents.push({
            id: event.id,
            created_at: event.created_at,
            content: event.content,
            kind: event.kind
          });
          
          // Sort by most recent and keep only the limit number of events
          currentEvents.sort((a, b) => b.created_at - a.created_at);
          activityMap.set(pubkey, currentEvents.slice(0, limit));
          
          // Debug logging for specific problematic users and very recent activity
          const daysSinceEvent = (Date.now() / 1000 - event.created_at) / (24 * 60 * 60);
          const debugPrefixes = ['f2aa7b81', '42ca8dc2', '0461fcbe', 'c83723d3', 'd0debf9f'];
          const isDebugUser = debugPrefixes.some(prefix => pubkey.startsWith(prefix));
          
          if (isDebugUser || daysSinceEvent < 90) {
            console.log(`🔍 SCAN: Found activity for ${pubkey.substring(0, 8)}...: kind=${event.kind}, ${daysSinceEvent.toFixed(1)} days ago, created=${new Date(event.created_at * 1000).toISOString()}`);
          }
        }
        
        // Report batch completion progress
        if (progressCallback) {
          progressCallback({
            processed: Math.min(i + batchSize, pubkeys.length),
            stage: `Completed batch ${batchNum}/${totalBatches} (${events.size} events found)`,
            currentNpub: ''
          });
        }
        
        // Add a small delay between batches to be nice to relays
        if (i + batchSize < pubkeys.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Failed to fetch activity for batch starting at ${i}:`, error);
        // Continue with next batch even if one fails
      }
    }
    
    const activeProfiles = Array.from(activityMap.values()).filter(events => events.length > 0).length;
    const inactiveProfiles = pubkeys.filter(pubkey => {
      const events = activityMap.get(pubkey) || [];
      return events.length === 0;
    });
    
    console.log(`Initial scan complete. Found activity for ${activeProfiles} out of ${pubkeys.length} profiles.`);
    
    // Fallback: Try a second pass for users with no activity found, with broader search
    if (inactiveProfiles.length > 0) {
      console.log(`Performing fallback scan for ${inactiveProfiles.length} profiles with no activity...`);
      
      const fallbackBatchSize = 5; // Even smaller batches for fallback
      for (let i = 0; i < inactiveProfiles.length; i += fallbackBatchSize) {
        const batch = inactiveProfiles.slice(i, i + fallbackBatchSize);
        
        try {
          // Comprehensive fallback search - no time limit, all event types
          const fallbackFilter = {
            kinds: [
              0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
              40, 41, 42, 43, 44,
              1063, 1311, 1984, 1985,
              9734, 9735,
              10000, 10001, 10002,
              30000, 30001, 30008, 30009, 30017, 30018, 30023, 30024,
              31890, 31922, 31923, 31924, 31925, 31989, 31990,
              34550
            ], // All possible event types
            authors: batch,
            limit: 100 // Very high limit for comprehensive search
            // No 'since' - search all time to find ANY activity
          };
          
          const fallbackBatchNum = Math.floor(i/fallbackBatchSize) + 1;
          const totalFallbackBatches = Math.ceil(inactiveProfiles.length/fallbackBatchSize);
          console.log(`Fallback batch ${fallbackBatchNum}/${totalFallbackBatches}...`);
          
          // Report fallback progress
          if (progressCallback) {
            progressCallback({
              total: pubkeys.length,
              processed: pubkeys.length - inactiveProfiles.length + i,
              stage: `Fallback scan ${fallbackBatchNum}/${totalFallbackBatches} (deeper search)`,
              currentNpub: batch[0].substring(0, 8) + '...'
            });
          }
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fallback timeout')), 12000)
          );
          
          const events = await Promise.race([
            this.ndk.fetchEvents(fallbackFilter),
            timeoutPromise
          ]);
          
          console.log(`Fallback: Found ${events.size} events for ${batch.length} authors`);
          
          for (const event of events) {
            const pubkey = event.pubkey;
            
            // Only update if we still have no activity for this pubkey
            if (!activityMap.get(pubkey) || activityMap.get(pubkey).length === 0) {
              const currentEvents = activityMap.get(pubkey) || [];
              currentEvents.push({
                id: event.id,
                created_at: event.created_at,
                content: event.content,
                kind: event.kind
              });
              
              currentEvents.sort((a, b) => b.created_at - a.created_at);
              activityMap.set(pubkey, currentEvents.slice(0, limit));
              
              console.log(`Fallback found activity for ${pubkey.substring(0, 8)}...: kind=${event.kind}, created=${new Date(event.created_at * 1000).toISOString()}`);
            }
          }
          
          // Longer delay for fallback to be nice to relays
          if (i + fallbackBatchSize < inactiveProfiles.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`Fallback batch failed for batch starting at ${i}:`, error);
          
          // Final fallback: try each user individually
          console.log(`Trying individual queries for batch ${Math.floor(i/fallbackBatchSize) + 1}...`);
          for (const pubkey of batch) {
            try {
              const individualFilter = {
                kinds: [1], // Just posts for speed
                authors: [pubkey],
                limit: 5
                // No time limit
              };
              
              const individualTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Individual timeout')), 5000)
              );
              
              const individualEvents = await Promise.race([
                this.ndk.fetchEvents(individualFilter),
                individualTimeout
              ]);
              
              if (individualEvents.size > 0) {
                console.log(`🎯 Individual query found ${individualEvents.size} events for ${pubkey.substring(0, 8)}...`);
                
                for (const event of individualEvents) {
                  const currentEvents = activityMap.get(pubkey) || [];
                  currentEvents.push({
                    id: event.id,
                    created_at: event.created_at,
                    content: event.content,
                    kind: event.kind
                  });
                  
                  currentEvents.sort((a, b) => b.created_at - a.created_at);
                  activityMap.set(pubkey, currentEvents.slice(0, limit));
                }
              }
              
              await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between individuals
            } catch (individualError) {
              console.error(`Individual query failed for ${pubkey.substring(0, 8)}...:`, individualError.message);
            }
          }
        }
      }
    }
    
    const finalActiveProfiles = Array.from(activityMap.values()).filter(events => events.length > 0).length;
    console.log(`Activity scan complete. Found activity for ${finalActiveProfiles} out of ${pubkeys.length} profiles (improved from ${activeProfiles}).`);
    
    // Debug final results for specific users
    const debugUsers = ['f2aa7b81', 'd0debf9f'];
    for (const prefix of debugUsers) {
      const pubkey = pubkeys.find(pk => pk.startsWith(prefix));
      if (pubkey) {
        const events = activityMap.get(pubkey) || [];
        console.log(`🔍 FINAL SCAN RESULT for ${pubkey.substring(0, 8)}...: ${events.length} events found`);
        if (events.length > 0) {
          const mostRecent = events[0];
          const daysSince = (Date.now() / 1000 - mostRecent.created_at) / (24 * 60 * 60);
          console.log(`  Most recent: kind=${mostRecent.kind}, ${daysSince.toFixed(1)} days ago`);
        }
      }
    }
    
    return activityMap;
  }

  /**
   * Aggressive retry method specifically for users showing "Unknown" activity
   * This method tries multiple strategies to find ANY activity
   */
  async aggressiveActivityRetry(pubkeys, progressCallback = null) {
    console.log(`🔍 AGGRESSIVE RETRY: Attempting to find activity for ${pubkeys.length} users with unknown activity`);
    
    await this.initialize();
    const retryResults = new Map();
    
    // Initialize with empty arrays
    pubkeys.forEach(pubkey => {
      retryResults.set(pubkey, []);
    });

    // Strategy 1: Single user queries with maximum event limits
    for (let i = 0; i < pubkeys.length; i++) {
      const pubkey = pubkeys[i];
      console.log(`🔍 RETRY STRATEGY 1: Individual search for ${pubkey.substring(0, 8)}...`);
      
      if (progressCallback) {
        progressCallback({
          stage: `Aggressive retry: searching user ${i + 1}/${pubkeys.length}...`,
          currentNpub: pubkey.substring(0, 8) + '...',
          processed: i + 1,
          total: pubkeys.length
        });
      }
      
      try {
        const individualFilter = {
          kinds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 40, 41, 42, 43, 44, 1063, 1311, 1984, 1985, 9734, 9735, 10000, 10001, 10002, 30000, 30001, 30008, 30009, 30017, 30018, 30023, 30024, 31890, 31922, 31923, 31924, 31925, 31989, 31990, 34550],
          authors: [pubkey],
          limit: 500 // Very high limit for individual search
          // No time limit - search all time
        };

        const events = await Promise.race([
          this.ndk.fetchEvents(individualFilter),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Individual search timeout')), 15000))
        ]);

        for (const event of events) {
          const currentEvents = retryResults.get(pubkey) || [];
          currentEvents.push({
            id: event.id,
            created_at: event.created_at,
            content: event.content,
            kind: event.kind
          });
          retryResults.set(pubkey, currentEvents);
        }

        if (events.size > 0) {
          console.log(`🎉 RETRY SUCCESS: Found ${events.size} events for ${pubkey.substring(0, 8)}... using individual search`);
        }

      } catch (error) {
        console.warn(`Individual search failed for ${pubkey.substring(0, 8)}...:`, error.message);
      }

      // Small delay between individual searches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Strategy 2: Look for just the most basic activity (kind 1 posts only)
    const stillEmpty = pubkeys.filter(pubkey => (retryResults.get(pubkey) || []).length === 0);
    
    if (stillEmpty.length > 0) {
      console.log(`🔍 RETRY STRATEGY 2: Basic post search for ${stillEmpty.length} remaining users`);
      
      const basicBatchSize = 3;
      for (let i = 0; i < stillEmpty.length; i += basicBatchSize) {
        const batch = stillEmpty.slice(i, i + basicBatchSize);
        
        try {
          const basicFilter = {
            kinds: [1], // Just text notes/posts
            authors: batch,
            limit: 1000 // Very high limit
            // No time limit
          };

          const events = await Promise.race([
            this.ndk.fetchEvents(basicFilter),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Basic search timeout')), 10000))
          ]);

          for (const event of events) {
            const currentEvents = retryResults.get(event.pubkey) || [];
            currentEvents.push({
              id: event.id,
              created_at: event.created_at,
              content: event.content,
              kind: event.kind
            });
            retryResults.set(event.pubkey, currentEvents);
          }

          if (events.size > 0) {
            console.log(`🎉 RETRY SUCCESS: Found ${events.size} basic posts in batch ${Math.floor(i/basicBatchSize) + 1}`);
          }

        } catch (error) {
          console.warn(`Basic search failed for batch:`, error.message);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Sort all results by most recent
    for (const [pubkey, events] of retryResults.entries()) {
      if (events.length > 0) {
        events.sort((a, b) => b.created_at - a.created_at);
        retryResults.set(pubkey, events.slice(0, 10)); // Keep top 10
      }
    }

    const foundActivity = Array.from(retryResults.values()).filter(events => events.length > 0).length;
    console.log(`🔍 AGGRESSIVE RETRY COMPLETE: Found activity for ${foundActivity}/${pubkeys.length} users`);

    return retryResults;
  }

  async createUnfollowEvent(pubkeysToRemove) {
    if (!this.pubkey) {
      throw new Error('Public key not set');
    }
    
    console.log('Current pubkey:', this.pubkey);
    console.log('Creating unfollow event for', pubkeysToRemove.length, 'pubkeys');
    
    if (!pubkeysToRemove || pubkeysToRemove.length === 0) {
      throw new Error('No pubkeys to remove');
    }

    // Get current follow list
    const currentFollows = await this.getFollowList();
    console.log('Current follows count:', currentFollows.length);
    console.log('Pubkeys to remove count:', pubkeysToRemove.length);
    
    // Remove the specified pubkeys
    const newFollows = currentFollows.filter(pubkey => !pubkeysToRemove.includes(pubkey));
    console.log('New follows count after removal:', newFollows.length);
    
    // Check if the event would be too large
    if (newFollows.length > 1000) {
      console.warn('⚠️ Large follow list detected:', newFollows.length, 'follows');
    }
    
    // Create new tags for the contacts event
    const tags = newFollows.map(pubkey => ['p', pubkey]);
    console.log('Created', tags.length, 'tags for event');
    
    // Create the event
    const event = {
      kind: 3,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: ''
    };
    
    // Validate extension availability
    if (typeof window.nostr === 'undefined') {
      throw new Error('No Nostr extension found. Please install Alby, nos2x, or another NIP-07 compatible extension.');
    }
    
    // Check extension permissions
    try {
      await window.nostr.getPublicKey();
    } catch (permError) {
      throw new Error('Extension not authorized for this site. Please check your extension settings and grant permissions.');
    }
    
    console.log('🔐 Starting signing process...');
    
    // First, try direct manual signing (often more reliable)
    try {
      console.log('Attempting direct manual signing...');
      
      const signedEvent = await Promise.race([
        window.nostr.signEvent(event),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Signing timeout - please approve the signing request in your extension')), 60000)
        )
      ]);
      
      console.log('✅ Event signed successfully:', signedEvent.id);
      
      // Publish to relays using simple WebSocket connections
      const publishResults = await this.publishEventToRelays(signedEvent);
      
      console.log(`✅ Event published to ${publishResults.successful}/${this.relays.length} relays`);
      
      if (publishResults.successful === 0) {
        throw new Error('Failed to publish to any relays. Please check your internet connection.');
      }
      
      return {
        success: true,
        removedCount: pubkeysToRemove.length,
        newFollowCount: newFollows.length,
        publishedToRelays: publishResults.successful
      };
      
    } catch (directSignError) {
      console.warn('❌ Direct signing failed:', directSignError.message);
      
      // Fallback to NDK if direct signing fails
      try {
        console.log('🔄 Trying NDK fallback...');
        
        await this.initialize();
        
        if (!this.ndk.signer) {
          throw new Error('NDK signer not available');
        }
        
        const ndkEvent = new NDKEvent(this.ndk);
        ndkEvent.kind = event.kind;
        ndkEvent.content = event.content;
        ndkEvent.created_at = event.created_at;
        ndkEvent.tags = event.tags;
        
        const relays = await Promise.race([
          ndkEvent.publish(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('NDK publish timeout')), 45000)
          )
        ]);
        
        console.log('✅ NDK signing and publishing successful to', relays.size, 'relays');
        
        return {
          success: true,
          removedCount: pubkeysToRemove.length,
          newFollowCount: newFollows.length,
          publishedToRelays: relays.size
        };
        
      } catch (ndkError) {
        console.error('❌ Both signing methods failed');
        console.error('Direct signing error:', directSignError.message);
        console.error('NDK signing error:', ndkError.message);
        
        // Provide specific error messages based on the failure type
        if (directSignError.message.includes('timeout') || ndkError.message.includes('timeout')) {
          throw new Error('Signing request timed out. Please try again and approve the signing prompt quickly in your Nostr extension.');
        } else if (directSignError.message.includes('User rejected') || directSignError.message.includes('denied')) {
          throw new Error('Signing was rejected. Please approve the signing request to update your follow list.');
        } else if (directSignError.message.includes('not authorized') || directSignError.message.includes('permission')) {
          throw new Error('Extension permissions not granted. Please check your Nostr extension settings for this site.');
        } else {
          throw new Error(`Failed to sign follow list update: ${directSignError.message}. Check your Nostr extension is unlocked and permissions are granted.`);
        }
      }
    }
  }
  
  async publishEventToRelays(signedEvent) {
    const publishPromises = this.relays.map(async (relayUrl) => {
      try {
        return new Promise((resolve, reject) => {
          const ws = new WebSocket(relayUrl);
          let resolved = false;
          
          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              ws.close();
              reject(new Error(`Publish timeout to ${relayUrl}`));
            }
          }, 10000);
          
          ws.onopen = () => {
            if (!resolved) {
              ws.send(JSON.stringify(['EVENT', signedEvent]));
              setTimeout(() => {
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeout);
                  ws.close();
                  resolve(relayUrl);
                }
              }, 3000);
            }
          };
          
          ws.onerror = (error) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              reject(new Error(`Failed to connect to ${relayUrl}: ${error.message}`));
            }
          };
          
          ws.onclose = () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve(relayUrl);
            }
          };
        });
      } catch (e) {
        console.warn('Failed to publish to', relayUrl, e.message);
        return null;
      }
    });
    
    const results = await Promise.allSettled(publishPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`Publish results: ${successful} successful, ${failed} failed`);
    
    return { successful, failed, total: this.relays.length };
  }
  
  async backupFollowList() {
    if (!this.pubkey) {
      throw new Error('Public key not set');
    }
    
    const followList = await this.getFollowList();
    
    // Create a backup object
    const backup = {
      pubkey: this.pubkey,
      npub: this.hexToNpub(this.pubkey),
      timestamp: Date.now(),
      followCount: followList.length,
      follows: followList
    };
    
    return backup;
  }

  logout() {
    this.pubkey = null;
    this.userProfile = null;
    this.follows.clear();
    
    // Clear session from localStorage
    localStorage.removeItem('nostr_session');
    
    // Optionally disconnect from relays
    if (this.ndk) {
      this.ndk = null;
    }
  }

  saveSession() {
    if (this.pubkey && this.userProfile) {
      const session = {
        pubkey: this.pubkey,
        userProfile: this.userProfile,
        timestamp: Date.now()
      };
      localStorage.setItem('nostr_session', JSON.stringify(session));
    }
  }

  async restoreSession() {
    try {
      const sessionData = localStorage.getItem('nostr_session');
      
      if (sessionData) {
        const session = JSON.parse(sessionData);
        
        // Check if session is not too old (24 hours)
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        if (Date.now() - session.timestamp < maxAge) {
          this.pubkey = session.pubkey;
          this.userProfile = session.userProfile;
          
          // Initialize NDK connection
          await this.initialize();
          
          return true;
        } else {
          // Session expired, clear it
          localStorage.removeItem('nostr_session');
        }
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      localStorage.removeItem('nostr_session');
    }
    
    return false;
  }
}

// Create singleton instance
const nostrService = new NostrService();
export default nostrService;