/**
 * Scout Service - Analyze zombie follows for any Nostr user without signing in
 * This is a read-only service that doesn't require authentication
 */
import NDK, { NDKEvent, NDKUser } from '@nostr-dev-kit/ndk';
import immunityService from './immunityService.js';
import nostrService from './nostrService.js';
import zombieService from './zombieService.js';

class ScoutService {
  constructor() {
    this.ndk = null;
    this.cancelled = false;
    // Expanded relay list for better follow list coverage
    this.defaultRelays = [
      'wss://relay.damus.io',
      'wss://relay.nostr.band', 
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://nostr.wine',
      'wss://purplepag.es',
      'wss://relay.snort.social',
      'wss://offchain.pub',
      'wss://relay.current.fyi'
    ];
  }

  async initialize() {
    if (!this.ndk) {
      this.ndk = new NDK({
        explicitRelayUrls: this.defaultRelays
      });
      
      try {
        // Add timeout for connection
        await Promise.race([
          this.ndk.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 10000)
          )
        ]);
        } catch (error) {
        console.warn('⚠️ Some relays failed to connect:', error);
        // Continue anyway - NDK will work with whatever relays did connect
      }
    }
  }

  async scoutUser(targetPubkey, progressCallback = null) {
    try {
      // Reset cancellation flag
      this.cancelled = false;
      console.log('🔍 Starting scout user for pubkey:', targetPubkey.substring(0, 8));
      await this.initialize();
      
      if (progressCallback) {
        progressCallback({ stage: 'Fetching user relay list...', processed: 0, total: 1 });
      }

      // Get user's announced relays (NIP-65)
      const userRelays = await this.fetchUserRelays(targetPubkey);
      console.log('📡 Found relays:', userRelays.length);
      
      if (progressCallback) {
        progressCallback({ stage: 'Fetching follow list...', processed: 0, total: 1 });
      }

      // Get the user's follow list using their preferred relays for better coverage
      console.log('👥 Fetching follow list...');
      const followList = await this.fetchFollowList(targetPubkey, userRelays);
      console.log('👥 Found follows:', followList.length);
      
      if (!followList || followList.length === 0) {
        return {
          success: false,
          message: 'No follows found or private profile'
        };
      }

      if (progressCallback) {
        progressCallback({ 
          stage: 'Analyzing follows for zombie activity...', 
          processed: 0, 
          total: followList.length 
        });
      }

      // Analyze follows for zombie activity using authentic method
      const analysisResults = await this.analyzeFollows(followList, progressCallback);

      // Calculate zombie score and breakdown - authentic format
      const totalFollows = followList.length;
      const totalZombies = analysisResults.burned.length + analysisResults.fresh.length + 
                          analysisResults.rotting.length + analysisResults.ancient.length;
      const zombieScore = totalFollows > 0 ? Math.round((totalZombies / totalFollows) * 100) : 0;

      // Format breakdown to match expected structure
      const breakdown = {
        burned: analysisResults.burned.length,
        fresh: analysisResults.fresh.length,
        rotting: analysisResults.rotting.length,
        ancient: analysisResults.ancient.length
      };

      return {
        success: true,
        totalFollows,
        totalZombies,
        zombieScore,
        breakdown,
        analysisResults
      };

    } catch (error) {
      console.error('❌ Scout analysis failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async fetchUserRelays(pubkey) {
    try {
      // Fetch NIP-65 relay list events (kind: 10002)
      const relayListEvents = await this.ndk.fetchEvents({
        kinds: [10002],
        authors: [pubkey],
        limit: 1
      });

      const userRelays = [];
      
      if (relayListEvents.size > 0) {
        const latestEvent = Array.from(relayListEvents)[0];
        
        // Parse relay tags
        for (const tag of latestEvent.tags) {
          if (tag[0] === 'r' && tag[1]) {
            userRelays.push(tag[1]);
          }
        }
        
        } else {
        console.log('⚠️ No relay list found, using default relays');
      }

      // Always include some default relays for better coverage
      return [...new Set([...userRelays, ...this.defaultRelays])];
    } catch (error) {
      console.warn('⚠️ Failed to fetch user relays, using defaults:', error);
      return this.defaultRelays;
    }
  }

  async fetchFollowList(pubkey, relays = null) {
    try {
      // Check for cancellation
      if (this.cancelled) {
        console.log('🛑 Follow list fetch cancelled');
        return [];
      }
      
      // Create temporary NDK instance with user's relays if available
      let queryNdk = this.ndk;
      if (relays && relays.length > 0) {
        queryNdk = new NDK({
          explicitRelayUrls: relays.slice(0, 15) // Use up to 15 relays for better coverage
        });
        
        try {
          // Add timeout for user relay connection
          await Promise.race([
            queryNdk.connect(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('User relay connection timeout')), 8000)
            )
          ]);
          } catch (error) {
          console.warn('⚠️ Failed to connect to user relays, falling back to default:', error);
          queryNdk = this.ndk; // Fall back to default relays
        }
      }

      // Fetch multiple kind 3 (follow list) events to improve coverage
      const followEvents = await Promise.race([
        queryNdk.fetchEvents({
          kinds: [3],
          authors: [pubkey],
          limit: 5 // Fetch up to 5 recent events to merge follows
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Follow list fetch timeout')), 25000)
        )
      ]);

      if (followEvents.size === 0) {
        console.log('❌ No follow list found');
        return [];
      }

      // Check for cancellation before processing events
      if (this.cancelled) {
        console.log('🛑 Follow list processing cancelled');
        return [];
      }

      const allFollows = new Set(); // Use Set to avoid duplicates

      // Merge follows from all events, prioritizing newer ones
      const eventArray = Array.from(followEvents).sort((a, b) => b.created_at - a.created_at);
      
      for (const [index, event] of eventArray.entries()) {
        // Check for cancellation during event processing
        if (this.cancelled) {
          console.log('🛑 Follow list processing cancelled during event loop');
          return Array.from(allFollows);
        }
        // Extract pubkeys from p tags
        for (const tag of event.tags || []) {
          if (tag[0] === 'p' && tag[1]) {
            allFollows.add(tag[1]);
          }
        }
        
        }

      const followList = Array.from(allFollows);

      // If we got a surprisingly low count, try additional popular relays as fallback
      if (followList.length < 500 && !this.cancelled) {
        console.log(`⚠️ Low follow count (${followList.length}), trying additional popular relays...`);
        
        const additionalRelays = [
          'wss://relay.nostr.bg',
          'wss://nostr-pub.wellorder.net',
          'wss://relay.nostrmag.social',
          'wss://atlas.nostr.land',
          'wss://brb.io'
        ];
        
        try {
          const fallbackNdk = new NDK({
            explicitRelayUrls: additionalRelays
          });
          
          await Promise.race([
            fallbackNdk.connect(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Fallback relay timeout')), 10000)
            )
          ]);
          
          const fallbackEvents = await Promise.race([
            fallbackNdk.fetchEvents({
              kinds: [3],
              authors: [pubkey],
              limit: 3
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Fallback fetch timeout')), 15000)
            )
          ]);
          
          // Check for cancellation before processing fallback events
          if (this.cancelled) {
            console.log('🛑 Fallback processing cancelled');
            return Array.from(allFollows);
          }
          
          // Merge any new follows from fallback
          for (const event of fallbackEvents) {
            if (this.cancelled) {
              console.log('🛑 Fallback processing cancelled during event merge');
              break;
            }
            for (const tag of event.tags || []) {
              if (tag[0] === 'p' && tag[1]) {
                allFollows.add(tag[1]);
              }
            }
          }
          
          const finalFollowList = Array.from(allFollows);
          return finalFollowList;
          
        } catch (fallbackError) {
          console.warn('⚠️ Fallback relay strategy failed:', fallbackError);
        }
      }
      
      return followList;

    } catch (error) {
      console.error('❌ Failed to fetch follow list:', error);
      return [];
    }
  }

  async fetchUserProfiles(pubkeys) {
    try {
      // Fetch kind 0 (user profile) events with timeout
      const profileEvents = await Promise.race([
        this.ndk.fetchEvents({
          kinds: [0],
          authors: pubkeys,
          limit: pubkeys.length
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
        )
      ]);

      const profiles = new Map();
      
      for (const event of profileEvents) {
        try {
          const profile = JSON.parse(event.content);
          profiles.set(event.pubkey, {
            name: profile.name || profile.display_name || null,
            display_name: profile.display_name || profile.name || null,
            about: profile.about || null,
            picture: profile.picture || null
          });
        } catch (error) {
          // Skip invalid profile JSON
          profiles.set(event.pubkey, { name: null, display_name: null, about: null, picture: null });
        }
      }

      return profiles;

    } catch (error) {
      console.warn('⚠️ Failed to fetch user profiles:', error);
      return new Map();
    }
  }

  async analyzeFollows(followList, progressCallback = null) {
    // Check for cancellation
    if (this.cancelled) {
      console.log('🛑 Scout scan cancelled');
      return { active: [], fresh: [], rotting: [], ancient: [], burned: [] };
    }
    
    // Step 1: Use the ENHANCED authenticated mode scanning with all retry logic
    // 1a. Standard activity scanning using scout's cancellation-aware method
    const activityMap = await this.getProfilesActivityScout(followList, 10, progressCallback);
    
    // Check for cancellation before proceeding
    if (this.cancelled) {
      console.log('🛑 Scout scan cancelled during activity analysis');
      return { active: [], fresh: [], rotting: [], ancient: [], burned: [] };
    }
    
    // 1b. SMART RETRY: Use relay-aware targeting for high-accuracy verification
    const usersWithNoActivity = followList.filter(pubkey => {
      const events = activityMap.get(pubkey) || [];
      return events.length === 0;
    });
    
    if (usersWithNoActivity.length > 0) {
      if (progressCallback) {
        progressCallback({
          stage: `High-accuracy verification for ${usersWithNoActivity.length} users...`,
          processed: followList.length - usersWithNoActivity.length,
          total: followList.length
        });
      }
      
      const retryResults = await nostrService.smartRelayRetry(usersWithNoActivity, progressCallback);
      
      // Merge retry results back into main activity data
      let recoveredUsers = 0;
      for (const [pubkey, events] of retryResults.entries()) {
        if (events.length > 0) {
          activityMap.set(pubkey, events);
          recoveredUsers++;
        }
      }
      
      // 1c. Fall back to aggressive retry for remaining users without relay lists
      const stillNoActivity = usersWithNoActivity.filter(pubkey => {
        const events = activityMap.get(pubkey) || [];
        return events.length === 0;
      });
      
      if (stillNoActivity.length > 0) {
        const aggressiveResults = await nostrService.aggressiveActivityRetry(stillNoActivity, progressCallback);
        
        let fallbackRecovered = 0;
        for (const [pubkey, events] of aggressiveResults.entries()) {
          if (events.length > 0) {
            activityMap.set(pubkey, events);
            fallbackRecovered++;
          }
        }
        
        }
    }
    
    // Step 2: Use the ACTUAL authenticated mode's zombie classification method
    if (progressCallback) {
      progressCallback({
        stage: 'Analyzing user activity and deleted accounts...',
        processed: followList.length,
        total: followList.length
      });
    }
    
    // Use null callback to prevent conflicting progress reports from zombieService
    const rawZombieResults = zombieService.classifyZombies(activityMap, null, null);
    
    // Step 2.5: Use the ACTUAL authenticated mode's immunity filtering
    await immunityService.init();
    const zombieResults = immunityService.filterImmuneZombies(rawZombieResults);
    const rawCount = rawZombieResults.fresh.length + rawZombieResults.rotting.length + rawZombieResults.ancient.length;
    const filteredCount = zombieResults.fresh.length + zombieResults.rotting.length + zombieResults.ancient.length;
    // Step 3: Fetch profiles for display samples
    await this.addProfileSamples(zombieResults);
    
    return zombieResults;
  }

  // Scout Mode's own activity scanning to prevent background retries
  async getProfilesActivityScout(pubkeys, limit = 10, progressCallback = null) {
    if (!pubkeys || pubkeys.length === 0) {
      return new Map();
    }

    await this.initialize();
    
    const activityMap = new Map();
    pubkeys.forEach(pubkey => {
      activityMap.set(pubkey, []);
    });
    
    // PASS 1: Standard scanning with default relays
    const batchSize = 25;
    
    for (let i = 0; i < pubkeys.length; i += batchSize) {
      // Check for cancellation
      if (this.cancelled) {
        console.log('🛑 Scout scan cancelled during batch processing');
        break;
      }
      
      const batch = pubkeys.slice(i, i + batchSize);
      
      if (progressCallback) {
        progressCallback({
          stage: `Scanning batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(pubkeys.length/batchSize)}...`,
          processed: Math.min(i + batch.length, pubkeys.length),
          total: pubkeys.length
        });
      }

      try {
        const filter = {
          kinds: [0, 1, 3, 6, 7, 9735], // Original Scout Mode kinds
          authors: batch,
          limit: limit * batch.length,
          since: Math.floor(Date.now() / 1000) - (120 * 24 * 60 * 60) // 120 days
        };

        const events = await Promise.race([
          this.ndk.fetchEvents(filter),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Activity fetch timeout')), 15000)
          )
        ]);

        // Process events and group by author
        for (const event of events) {
          if (activityMap.has(event.author.pubkey)) {
            const existingEvents = activityMap.get(event.author.pubkey);
            
            if (existingEvents.length < limit) {
              const isDuplicate = existingEvents.some(e => e.id === event.id);
              if (!isDuplicate) {
                existingEvents.push({
                  id: event.id,
                  kind: event.kind,
                  created_at: event.created_at,
                  pubkey: event.author.pubkey
                });
                
                existingEvents.sort((a, b) => b.created_at - a.created_at);
                
                if (existingEvents.length > limit) {
                  activityMap.set(event.author.pubkey, existingEvents.slice(0, limit));
                }
              }
            }
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ Error in batch ${Math.floor(i/batchSize) + 1}:`, error.message);
      }
    }

    return activityMap;
  }

  // Simplified smart relay retry focusing on reliable relays only
  async smartRelayRetry(pubkeys, limit = 10, progressCallback = null) {
    const retryMap = new Map();
    
    // Only use well-known, reliable relays for retry to avoid connection failures
    const reliableRelays = [
      'wss://relay.damus.io',
      'wss://nos.lol', 
      'wss://relay.primal.net',
      'wss://nostr.wine',
      'wss://relay.nostr.band'
    ];
    
    // Initialize results
    for (const pubkey of pubkeys) {
      retryMap.set(pubkey, []);
    }
    
    try {
      // Create single NDK instance with reliable relays
      const retryNdk = new NDK({
        explicitRelayUrls: reliableRelays
      });
      
      // Connect with timeout
      await Promise.race([
        retryNdk.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Reliable relay connection timeout')), 8000)
        )
      ]);
      
      // Process users in small batches
      const batchSize = 10; // Larger batches since we're using reliable relays
      for (let i = 0; i < pubkeys.length; i += batchSize) {
        const userBatch = pubkeys.slice(i, i + batchSize);
        
        if (progressCallback) {
          progressCallback({
            stage: `Reliable retry batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(pubkeys.length/batchSize)}`,
            processed: Math.min(i + userBatch.length, pubkeys.length),
            total: pubkeys.length
          });
        }
        
        try {
          const filter = {
            kinds: [0, 1, 3, 6, 7, 9735],
            authors: userBatch,
            limit: limit * userBatch.length,
            since: Math.floor(Date.now() / 1000) - (120 * 24 * 60 * 60)
          };
          
          const events = await Promise.race([
            retryNdk.fetchEvents(filter),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Reliable relay query timeout')), 10000)
            )
          ]);
          
          // Process events for each user
          for (const event of events) {
            const pubkey = event.author.pubkey;
            if (retryMap.has(pubkey)) {
              const existingEvents = retryMap.get(pubkey);
              if (existingEvents.length < limit) {
                const isDuplicate = existingEvents.some(e => e.id === event.id);
                if (!isDuplicate) {
                  existingEvents.push({
                    id: event.id,
                    kind: event.kind,
                    created_at: event.created_at,
                    pubkey: event.author.pubkey
                  });
                  existingEvents.sort((a, b) => b.created_at - a.created_at);
                  retryMap.set(pubkey, existingEvents.slice(0, limit));
                }
              }
            }
          }
          
        } catch (error) {
          console.warn(`⚠️ Reliable retry batch ${Math.floor(i/batchSize) + 1} failed: ${error.message}`);
        }
        
        // Small delay between batches
        if (i + batchSize < pubkeys.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
    } catch (error) {
      console.warn(`⚠️ Reliable relay retry completely failed: ${error.message}`);
    }
    
    // Count successful recoveries
    const recoveredCount = Array.from(retryMap.values()).filter(events => events.length > 0).length;
    return retryMap;
  }

  // EXACT copy of authenticated mode's zombie classification
  classifyZombiesAuthentic(activityData, progressCallback = null) {
    const now = Date.now() / 1000; // Current time in seconds
    const zombies = {
      burned: [], // Deleted accounts - highest priority for purging
      fresh: [],
      rotting: [],
      ancient: [],
      active: []
    };

    // Use same thresholds as authenticated mode 
    const conservativeActiveThreshold = 120; // 4 months - ULTRA CONSERVATIVE
    const freshThreshold = 180; // 6 months
    const rottingThreshold = 365; // 1 year

    let processedCount = 0;
    const totalUsers = activityData.size;
    
    for (const [pubkey, events] of activityData.entries()) {
      processedCount++;
      
      // Check for no activity first
      if (events.length === 0) {
        zombies.ancient.push({
          pubkey,
          lastActivity: null,
          daysSinceActivity: null
        });
        continue;
      }

      // Get the most recent activity
      const latestEvent = events[0];
      const daysSinceLastActivity = (now - latestEvent.created_at) / (24 * 60 * 60);

      const zombieInfo = {
        pubkey,
        lastActivity: latestEvent.created_at,
        daysSinceActivity: daysSinceLastActivity
      };

      // ULTRA CONSERVATIVE - same as authenticated mode
      if (daysSinceLastActivity < conservativeActiveThreshold) {
        zombies.active.push(zombieInfo);
      } else if (daysSinceLastActivity >= rottingThreshold) {
        zombies.ancient.push(zombieInfo);
      } else if (daysSinceLastActivity >= freshThreshold) {
        zombies.rotting.push(zombieInfo);
      } else {
        zombies.fresh.push(zombieInfo);
      }

      // Report progress occasionally
      if (progressCallback && (processedCount % 10 === 0 || processedCount === totalUsers)) {
        const currentZombieCount = zombies.burned.length + zombies.fresh.length + zombies.rotting.length + zombies.ancient.length;
        progressCallback({
          stage: 'Classifying zombie activity...',
          processed: processedCount,
          total: totalUsers,
          zombiesFound: currentZombieCount
        });
      }
    }

    const totalZombies = zombies.burned.length + zombies.fresh.length + zombies.rotting.length + zombies.ancient.length;
    return zombies;
  }

  async addProfileSamples(zombieResults) {
    // Fetch profiles for samples from each category for display
    const sampleSize = 15;
    const sampleUsers = [
      ...zombieResults.active.slice(0, sampleSize),
      ...zombieResults.fresh.slice(0, sampleSize),
      ...zombieResults.rotting.slice(0, sampleSize),
      ...zombieResults.ancient.slice(0, sampleSize),
      ...zombieResults.burned.slice(0, sampleSize)
    ];

    if (sampleUsers.length > 0) {
      const samplePubkeys = sampleUsers.map(user => user.pubkey);
      const profiles = await this.fetchUserProfiles(samplePubkeys);
      
      // Add profile information to each category
      for (const category of Object.keys(zombieResults)) {
        for (const user of zombieResults[category]) {
          const profile = profiles.get(user.pubkey);
          if (profile) {
            user.name = profile.name;
            user.display_name = profile.display_name;
            user.about = profile.about;
            user.picture = profile.picture;
          }
        }
      }
    }
  }

  // Keep old method for fallback but it's no longer used
  async analyzeBatch(pubkeys) {
    try {
      // Use the SAME comprehensive event search as authenticated mode
      const oneYearAgo = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60);
      
      // Fetch ALL activity types that authenticated mode searches for
      const recentEvents = await this.ndk.fetchEvents({
        kinds: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 40, 41, 42, 43, 44,
          1063, 1311, 1984, 1985, 9734, 9735, 10000, 10001, 10002,
          30000, 30001, 30008, 30009, 30017, 30018, 30023, 30024,
          31890, 31922, 31923, 31924, 31925, 31989, 31990, 34550
        ],
        authors: pubkeys,
        since: oneYearAgo, // Look back full year like authenticated mode
        limit: pubkeys.length * 20 // More events per user
      });

      // Deletion events are already included in the comprehensive search above (kind 5)
      const deletionEvents = Array.from(recentEvents).filter(event => event.kind === 5);

      // Analyze activity for each user
      const results = {
        active: [],
        fresh: [],
        rotting: [],
        ancient: [],
        burned: []
      };

      const userActivity = new Map();
      const deletedUsers = new Set();

      // Process deletion events
      for (const event of deletionEvents) {
        deletedUsers.add(event.pubkey);
      }

      // Process all activity (not just "recent" - we're looking at full year)
      for (const event of recentEvents) {
        // Skip deletion events for activity tracking (but count them separately)
        if (event.kind === 5) continue;
        
        const existing = userActivity.get(event.pubkey);
        if (!existing || event.created_at > existing) {
          userActivity.set(event.pubkey, event.created_at);
        }
      }
      
      const now = Math.floor(Date.now() / 1000);
      
      // Use the same conservative thresholds as authenticated mode
      const conservativeActiveThreshold = 120; // 4 months - ULTRA CONSERVATIVE like main app
      const freshThreshold = 180; // 6 months
      const rottingThreshold = 365; // 1 year

      // Categorize each user using same logic as authenticated mode
      for (const pubkey of pubkeys) {
        const lastActivity = userActivity.get(pubkey);
        const userInfo = { 
          pubkey,
          lastActivity: lastActivity || null,
          daysSinceActivity: lastActivity ? (now - lastActivity) / (24 * 60 * 60) : null
        };

        // Check if account is deleted first (highest priority)
        if (deletedUsers.has(pubkey)) {
          results.burned.push(userInfo);
        } else if (!lastActivity) {
          // No activity found in last 90 days, consider ancient
          results.ancient.push(userInfo);
        } else {
          const daysSinceActivity = (now - lastActivity) / (24 * 60 * 60);
          
          // ULTRA CONSERVATIVE - same as authenticated mode
          if (daysSinceActivity < conservativeActiveThreshold) {
            results.active.push(userInfo);
          } else if (daysSinceActivity >= rottingThreshold) {
            results.ancient.push(userInfo);
          } else if (daysSinceActivity >= freshThreshold) {
            results.rotting.push(userInfo);
          } else {
            results.fresh.push(userInfo);
          }
        }
      }

      return results;

    } catch (error) {
      console.error('❌ Batch analysis failed:', error);
      // Return all users as unknown/ancient on error
      return {
        active: [],
        fresh: [],
        rotting: [],
        ancient: pubkeys.map(pubkey => ({ pubkey })),
        burned: []
      };
    }
  }

  categorizeZombies(analysisResults) {
    return {
      burned: analysisResults.burned.length,
      fresh: analysisResults.fresh.length,
      rotting: analysisResults.rotting.length,
      ancient: analysisResults.ancient.length
    };
  }

  cancelScan() {
    this.cancelled = true;
    console.log('🛑 Scout scan cancellation requested');
  }

  disconnect() {
    this.cancelled = true;
    if (this.ndk) {
      // NDK doesn't have explicit disconnect, connections are managed automatically
      this.ndk = null;
      }
  }
}

// Export singleton instance
const scoutService = new ScoutService();
export default scoutService;