import NDK, { NDKEvent, NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import nip46Service from './nip46Service.js';
import syncManager from './syncManager.js';

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
    
    // Signing method management
    this.signingMethod = 'nip07'; // 'nip07' | 'nip46'
    this.nip46Service = nip46Service;
    
    // NIP-07 specific state
    this.extensionConnected = false;
    this.extensionAuthorized = false;
    this.connectionPromise = null; // Prevent multiple simultaneous connections
    
    // NIP-65 relay lists
    this.userRelayList = null; // User's own relay preferences
    this.followsRelayLists = new Map(); // Map of pubkey -> relay list
    
    // Restore signing method preference and connections
    this.restoreSigningMethod();
  }

  async initialize() {
    if (!this.ndk) {
      console.log('🔧 Initializing NDK with relays:', this.relays);
      console.log('🔍 NDK instance check - creating new NDK instance');
      
      // Create NDK with appropriate signer based on signing method
      let signer = null;
      
      if (this.signingMethod === 'nip07' && typeof window.nostr !== 'undefined') {
        signer = new NDKNip07Signer();
      } else if (this.signingMethod === 'nip46' && this.nip46Service.isConnected()) {
        signer = this.nip46Service.getSigner();
      }
      
      this.ndk = new NDK({
        explicitRelayUrls: this.relays,
        signer: signer
      });
      
      console.log('🔗 Connecting to NDK...');

      // Start connection
      this.ndk.connect().catch(error => {
        console.warn('⚠️ NDK connection error (non-blocking):', error.message);
      });

      // Wait for at least one relay to connect (with timeout)
      const maxWaitTime = 5000; // 5 seconds max
      const checkInterval = 100; // Check every 100ms
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        const connectedRelays = Array.from(this.ndk?.pool?.relays?.values() || [])
          .filter(r => r.connectivity.status === 1);

        if (connectedRelays.length > 0) {
          console.log(`✅ NDK initialized with ${connectedRelays.length} connected relay(s) (more may connect in background)`);
          break;
        }

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }

      const finalConnected = Array.from(this.ndk?.pool?.relays?.values() || [])
        .filter(r => r.connectivity.status === 1).length;

      if (finalConnected === 0) {
        console.warn('⚠️ No relays connected after 5s, but continuing anyway');
      }
    }
    return this.ndk;
  }

  /**
   * Get the appropriate signer for the current signing method
   */
  getSigner() {
    if (this.signingMethod === 'nip07' && typeof window.nostr !== 'undefined') {
      return new NDKNip07Signer();
    } else if (this.signingMethod === 'nip46' && this.nip46Service.isConnected()) {
      return this.nip46Service.getSigner();
    }
    return null;
  }

  /**
   * Proper NIP-07 extension connection and authorization
   * This should be called once at app startup, not repeatedly
   */
  async connectExtension() {
    if (this.connectionPromise) {
      // Already connecting, wait for existing connection
      console.log('🔄 Connection already in progress, waiting...');
      return this.connectionPromise;
    }

    this.connectionPromise = Promise.race([
      this._connectExtensionImpl(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Overall connection timeout after 30 seconds')), 30000)
      )
    ]).finally(() => {
      // Clear the connection promise when done (success or failure)
      this.connectionPromise = null;
    });
    return this.connectionPromise;
  }

  async _connectExtensionImpl() {
    console.log('🔌 Starting NIP-07 extension connection...');

    // Check if extension is available
    if (typeof window.nostr === 'undefined') {
      this.extensionConnected = false;
      throw new Error('No Nostr extension found. Please install Alby, nos2x, or another NIP-07 compatible extension.');
    }

    try {
      // Test extension responsiveness first
      console.log('🔍 Testing extension responsiveness...');
      
      // Get public key with reasonable timeout
      const pubkey = await Promise.race([
        window.nostr.getPublicKey(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Extension connection timeout')), 15000)
        )
      ]);

      this.pubkey = pubkey;
      this.extensionConnected = true;
      this.extensionAuthorized = true;

      console.log('✅ Extension connected successfully');
      console.log('👤 Public key:', pubkey.substring(0, 8) + '...');

      // Initialize NDK after successful extension connection
      console.log('🔧 Initializing NDK...');
      await this.initialize();
      console.log('✅ NDK initialization complete');

      // Load user profile
      console.log('👤 Loading user profile...');
      await this.loadUserProfile();
      console.log('✅ User profile loaded');

      // Fetch user's relay list (NIP-65)
      console.log('📡 Fetching user relay list...');
      try {
        await this.fetchUserRelayList();
        if (this.userRelayList) {
          const writeRelays = this.getWriteRelays(this.userRelayList);
          const readRelays = this.getReadRelays(this.userRelayList);
          console.log(`✅ User relay list loaded: ${writeRelays.length} write, ${readRelays.length} read relays`);
        } else {
          console.log('ℹ️ No user relay list found, using default relays');
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch user relay list:', error);
      }

      // Save session
      this.saveSession();

      // Trigger relay sync (non-blocking, delayed to allow initialization)
      setTimeout(() => {
        console.log('🔄 Triggering automatic relay sync...');
        syncManager.syncAll().then((result) => {
          if (result.success) {
            console.log(`✅ Auto-sync complete: synced ${result.synced.length} services`);
          } else {
            console.warn('⚠️ Auto-sync failed:', result.error || result.message);
          }
        }).catch(error => {
          console.warn('⚠️ Auto-sync error:', error);
        });
      }, 1000); // Delay 1 second to allow full initialization

      return {
        success: true,
        pubkey: this.pubkey,
        extensionType: window.nostr.constructor?.name || 'unknown'
      };

    } catch (error) {
      this.extensionConnected = false;
      this.extensionAuthorized = false;
      
      console.error('❌ Extension connection failed:', error);
      
      if (error.message.includes('timeout')) {
        throw new Error('Extension connection timed out. Please check if your Nostr extension is unlocked and responding.');
      } else if (error.message.toLowerCase().includes('user rejected') || error.message.toLowerCase().includes('denied')) {
        throw new Error('Connection was denied. Please approve the connection request in your Nostr extension.');
      } else {
        throw new Error(`Failed to connect to Nostr extension: ${error.message}`);
      }
    }
  }

  /**
   * Set the signing method to use
   */
  setSigningMethod(method) {
    if (!['nip07', 'nip46'].includes(method)) {
      throw new Error('Invalid signing method. Must be "nip07" or "nip46"');
    }
    
    // Only change if it's different
    if (this.signingMethod === method) {
      console.log(`ℹ️ Signing method already set to ${method}`);
      return;
    }
    
    console.log(`🔄 Switching signing method from ${this.signingMethod} to ${method}`);
    this.signingMethod = method;
    
    // Reset NDK to force recreation with new signer
    this.ndk = null;
    
    // Save preference
    localStorage.setItem('signing_method', method);
  }

  /**
   * Get the current signing method
   */
  getSigningMethod() {
    return this.signingMethod;
  }

  /**
   * Restore signing method preference
   */
  restoreSigningMethod() {
    try {
      const savedMethod = localStorage.getItem('signing_method');
      if (savedMethod && ['nip07', 'nip46'].includes(savedMethod)) {
        this.signingMethod = savedMethod;
        console.log(`📋 Restored signing method: ${savedMethod}`);
      }
    } catch (error) {
      console.warn('Failed to restore signing method preference:', error);
    }
  }

  /**
   * Check if extension is properly connected and authorized
   */
  isExtensionReady() {
    return this.signingMethod === 'nip07' && 
           this.extensionConnected && 
           this.extensionAuthorized && 
           this.pubkey && 
           typeof window.nostr !== 'undefined';
  }

  /**
   * Check if NIP-46 bunker is connected and ready
   */
  isBunkerReady() {
    return this.signingMethod === 'nip46' && 
           this.nip46Service.isConnected();
  }

  /**
   * Check if any signing method is ready
   */
  isSigningReady() {
    return this.isExtensionReady() || this.isBunkerReady();
  }

  async getPublicKey() {
    // Return pubkey if already set
    if (this.pubkey) {
      return this.pubkey;
    }

    // Get public key based on signing method
    if (this.signingMethod === 'nip07') {
      if (!this.isExtensionReady()) {
        await this.connectExtension();
      }
      return this.pubkey;
    } else if (this.signingMethod === 'nip46') {
      if (!this.isBunkerReady()) {
        throw new Error('NIP-46 bunker not connected. Please connect your bunker first.');
      }
      if (!this.pubkey) {
        this.pubkey = await this.nip46Service.getPublicKey();
      }
      return this.pubkey;
    } else {
      throw new Error('No signing method available');
    }
  }

  async loadUserProfile() {
    if (!this.pubkey) return null;
    
    try {
      await this.initialize();
      
      // Check for cached profile data first
      const cacheKey = `profile_${this.pubkey}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedProfile = JSON.parse(cached);
          // Use cached data if it's less than 1 hour old
          if (Date.now() - cachedProfile.timestamp < 3600000) {
            console.log('📋 Using cached profile data');
            this.userProfile = {
              pubkey: this.pubkey,
              name: cachedProfile.name || null,
              display_name: cachedProfile.display_name || cachedProfile.displayName || null,
              about: cachedProfile.about || null,
              picture: cachedProfile.picture || null,
              nip05: cachedProfile.nip05 || null
            };
            
            // Dispatch event immediately with cached data
            if (this.userProfile && this.signingMethod === 'nip46') {
              console.log('📡 Dispatching cached user-profile-loaded event for NIP-46');
              const profileEvent = new CustomEvent('user-profile-loaded', {
                detail: this.userProfile
              });
              window.dispatchEvent(profileEvent);
            }
          }
        }
      } catch (cacheError) {
        console.warn('Failed to load cached profile:', cacheError);
      }
      
      const filter = {
        kinds: [0],
        authors: [this.pubkey],
        limit: 1
      };
      
      // Add timeout to prevent long delays
      const events = await Promise.race([
        this.ndk.fetchEvents(filter),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
        )
      ]);
      const eventArray = Array.from(events);
      
      if (eventArray.length > 0) {
        const profileEvent = eventArray[0];
        let profileData;
        
        try {
          profileData = JSON.parse(profileEvent.content);
        } catch (jsonError) {
          console.warn(`Failed to parse user profile JSON: ${jsonError.message}`);
          // Create basic profile with just pubkey if JSON is invalid
          this.userProfile = {
            pubkey: this.pubkey,
            name: null,
            display_name: null,
            about: null,
            picture: null,
            nip05: null
          };
          return this.userProfile;
        }
        
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
      
      
      // Cache the profile data if we successfully loaded it
      if (this.userProfile && (this.userProfile.name || this.userProfile.display_name || this.userProfile.picture)) {
        try {
          const cacheKey = `profile_${this.pubkey}`;
          const cacheData = {
            ...this.userProfile,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log('💾 Cached profile data');
        } catch (cacheError) {
          console.warn('Failed to cache profile data:', cacheError);
        }
      }
      
      // Dispatch event to update UI with loaded profile data
      if (this.userProfile && this.signingMethod === 'nip46') {
        console.log('📡 Dispatching user-profile-loaded event for NIP-46');
        const profileEvent = new CustomEvent('user-profile-loaded', {
          detail: this.userProfile
        });
        window.dispatchEvent(profileEvent);
      }

      // Save session after profile is loaded
      this.saveSession();

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

  async getProfileMetadata(pubkeys, progressCallback = null) {
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
        const batchNumber = Math.floor(i/batchSize) + 1;
        const totalBatches = Math.ceil(validPubkeys.length/batchSize);
        console.log(`Fetching profiles for batch ${batchNumber}/${totalBatches}...`);
        
        // Report batch progress to UI
        if (progressCallback) {
          progressCallback({
            total: validPubkeys.length,
            processed: i,
            stage: `Fetching profiles for batch ${batchNumber}/${totalBatches}`,
            currentNpub: ''
          });
        }
        
        // Get kind 0 (profile) events - fetch more to track deletion history
        const profileFilter = {
          kinds: [0],
          authors: batch,
          limit: 100 // Increased to get more profile history
          // Removed 'since' filter to get all profile events, not just recent ones
        };
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
        );
        
        const events = await Promise.race([
          this.ndk.fetchEvents(profileFilter),
          timeoutPromise
        ]);
        
        // Process all profile events to track deletion timeline
        const profileEventsByUser = new Map();
        for (const event of events) {
          if (!profileEventsByUser.has(event.pubkey)) {
            profileEventsByUser.set(event.pubkey, []);
          }
          profileEventsByUser.get(event.pubkey).push(event);
        }
        
        // Sort events by timestamp for each user
        for (const [pubkey, userEvents] of profileEventsByUser) {
          userEvents.sort((a, b) => b.created_at - a.created_at); // Most recent first
        }
        
        // Parse profile data with deletion timeline tracking
        for (const [pubkey, userEvents] of profileEventsByUser) {
          try {
            const latestEvent = userEvents[0];
            let latestProfile;
            
            try {
              latestProfile = JSON.parse(latestEvent.content);
            } catch (jsonError) {
              console.warn(`Failed to parse profile JSON for ${pubkey.substring(0, 8)}...: ${jsonError.message}`);
              // Skip this profile if JSON is invalid
              continue;
            }
            
            const existingProfile = profileMap.get(pubkey);
            
            // Track deletion status changes
            let deletionTimeline = null;
            let currentlyDeleted = latestProfile.deleted === true || latestProfile.deleted === 'true';
            
            if (currentlyDeleted) {
              // Find when deletion was first marked
              for (let i = userEvents.length - 1; i >= 0; i--) {
                try {
                  let eventProfile;
                  try {
                    eventProfile = JSON.parse(userEvents[i].content);
                  } catch (jsonError) {
                    console.warn(`Failed to parse deletion timeline JSON for ${pubkey.substring(0, 8)}...: ${jsonError.message}`);
                    continue; // Skip this event if JSON is invalid
                  }
                  const wasDeleted = eventProfile.deleted === true || eventProfile.deleted === 'true';
                  if (wasDeleted) {
                    deletionTimeline = {
                      markedDeletedAt: userEvents[i].created_at,
                      deletionAge: Math.floor((Date.now() / 1000) - userEvents[i].created_at),
                      profileUpdatesAfterDeletion: 0
                    };
                    
                    // Count profile updates after deletion
                    for (let j = i - 1; j >= 0; j--) {
                      if (userEvents[j].created_at > userEvents[i].created_at) {
                        deletionTimeline.profileUpdatesAfterDeletion++;
                      }
                    }
                    break;
                  }
                } catch (e) {
                  console.warn(`Failed to parse profile event for deletion timeline: ${pubkey}`);
                }
              }
            }
            
            const updatedProfile = {
              ...existingProfile,
              name: latestProfile.name || null,
              display_name: latestProfile.display_name || latestProfile.displayName || null,
              about: latestProfile.about || null,
              picture: latestProfile.picture || null,
              nip05: latestProfile.nip05 || null,
              deleted: currentlyDeleted,
              deletionTimeline: deletionTimeline,
              profileEventCount: userEvents.length,
              lastSeen: latestEvent.created_at
            };
            
            profileMap.set(pubkey, updatedProfile);
            
            if (deletionTimeline) {
              console.log(`🔥 User ${pubkey.substring(0, 8)}... marked deleted ${Math.floor(deletionTimeline.deletionAge / (24 * 60 * 60))} days ago, ${deletionTimeline.profileUpdatesAfterDeletion} profile updates since`);
            }
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
    
    // Final progress update
    if (progressCallback) {
      progressCallback({
        total: validPubkeys.length,
        processed: validPubkeys.length,
        stage: 'Profile fetching complete',
        currentNpub: ''
      });
    }
    
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
    
    const activityMap = new Map();
    pubkeys.forEach(pubkey => {
      activityMap.set(pubkey, []);
    });
    
    console.log(`🔍 Starting balanced activity scan for ${pubkeys.length} profiles...`);
    
    // Balanced approach: reasonable batches, good event coverage, sufficient time window
    const batchSize = 25; // Balanced batch size
    const totalBatches = Math.ceil(pubkeys.length / batchSize);
    
    for (let i = 0; i < pubkeys.length; i += batchSize) {
      const batch = pubkeys.slice(i, i + batchSize);
      const batchNum = Math.floor(i/batchSize) + 1;
      
      try {
        // Comprehensive filter - multiple event types, reasonable time window
        const filter = {
          kinds: [0, 1, 3, 6, 7, 9735], // Profiles, posts, contacts, reposts, reactions, zaps
          authors: batch,
          limit: limit * batch.length, // Proportional limit
          since: Math.floor(Date.now() / 1000) - (120 * 24 * 60 * 60) // 120 days - good balance
        };
        
        console.log(`📡 Batch ${batchNum}/${totalBatches}: Scanning ${batch.length} users (balanced approach)...`);
        
        // Report progress before attempting
        if (progressCallback) {
          const progressData = {
            total: pubkeys.length,
            processed: i,
            stage: `Scanning batch ${batchNum}/${totalBatches}`,
            currentNpub: batch[0].substring(0, 8) + '...'
          };
          progressCallback(progressData);
        }
        
        // Balanced timeout approach
        let events = new Set();
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 15000) // 15 second timeout
          );
          
          events = await Promise.race([
            this.ndk.fetchEvents(filter),
            timeoutPromise
          ]);
          
          console.log(`✅ Batch ${batchNum}: Found ${events.size} events`);
        } catch (error) {
          console.warn(`⚠️ Batch ${batchNum} failed: ${error.message}, continuing...`);
          events = new Set(); // Empty set to continue
        }
        
        // Process events
        for (const event of events) {
          const pubkey = event.pubkey;
          const currentEvents = activityMap.get(pubkey) || [];
          currentEvents.push({
            id: event.id,
            created_at: event.created_at,
            content: event.content,
            kind: event.kind
          });
          
          // Sort by most recent and keep only the limit
          currentEvents.sort((a, b) => b.created_at - a.created_at);
          activityMap.set(pubkey, currentEvents.slice(0, limit));
        }
        
        // Report batch completion with progress update
        if (progressCallback) {
          const processed = Math.min(i + batchSize, pubkeys.length);
          
          const completionData = {
            total: pubkeys.length,
            processed: processed,
            stage: `Completed batch ${batchNum}/${totalBatches} (${events.size} events)`,
            currentNpub: ''
          };
          progressCallback(completionData);
        }
        
        // Reasonable delay between batches
        if (i + batchSize < pubkeys.length) {
          await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
        }
        
      } catch (error) {
        console.error(`❌ Batch ${batchNum} failed:`, error);
        
        // Still report progress even on failure
        if (progressCallback) {
          progressCallback({
            total: pubkeys.length,
            processed: Math.min(i + batchSize, pubkeys.length),
            stage: `Batch ${batchNum} failed, continuing...`,
            currentNpub: ''
          });
        }
        
        // Continue with next batch
      }
    }
    
    const activeProfiles = Array.from(activityMap.values()).filter(events => events.length > 0).length;
    console.log(`📊 Balanced activity scan complete. Found activity for ${activeProfiles} out of ${pubkeys.length} profiles.`);
    
    // Final progress report
    if (progressCallback) {
      const finalData = {
        total: pubkeys.length,
        processed: pubkeys.length,
        stage: 'Activity scanning complete',
        currentNpub: ''
      };
      progressCallback(finalData);
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

    // Get the complete current contacts event (not just the pubkeys)
    await this.initialize();
    
    const followListFilter = {
      kinds: [3],
      authors: [this.pubkey],
      limit: 5
    };
    
    const events = await this.ndk.fetchEvents(followListFilter);
    
    if (!events || events.size === 0) {
      throw new Error('No follow list events found');
    }

    // Get the most recent contacts event
    const eventArray = Array.from(events).sort((a, b) => b.created_at - a.created_at);
    const mostRecentEvent = eventArray[0];
    
    console.log(`Found ${eventArray.length} follow list events, using most recent from ${new Date(mostRecentEvent.created_at * 1000)}`);
    
    // Separate user follows ('p' tags) from all other tags (including 't' tags)
    const userFollowTags = mostRecentEvent.tags.filter(tag => tag[0] === 'p' && tag[1]);
    const nonUserTags = mostRecentEvent.tags.filter(tag => tag[0] !== 'p');
    
    console.log(`Current tags: ${userFollowTags.length} user follows, ${nonUserTags.length} other tags (topics, relays, etc.)`);
    console.log('Non-user tags:', nonUserTags.map(tag => `${tag[0]}:${tag[1] || ''}`).join(', '));
    
    // Remove the specified pubkeys from user follow tags only
    const newUserFollowTags = userFollowTags.filter(tag => !pubkeysToRemove.includes(tag[1]));
    console.log(`Filtered user follows: ${userFollowTags.length} -> ${newUserFollowTags.length} (removed ${userFollowTags.length - newUserFollowTags.length})`);
    
    // Combine the preserved non-user tags with the filtered user follow tags
    const tags = [...nonUserTags, ...newUserFollowTags];
    
    console.log(`Final tag count: ${tags.length} (${newUserFollowTags.length} user follows + ${nonUserTags.length} preserved tags)`);
    
    // Check if the event would be too large
    if (newUserFollowTags.length > 1000) {
      console.warn('⚠️ Large follow list detected:', newUserFollowTags.length, 'follows');
      console.warn('⚠️ Some Nostr extensions may have trouble with very large follow lists');
      console.warn('⚠️ If signing fails, you may need to unfollow users in smaller batches');
    }
    
    // Estimate event size with all tags
    const estimatedSize = JSON.stringify({
      kind: 3,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: mostRecentEvent.content || ''
    }).length;
    
    console.log('📏 Estimated event size:', Math.round(estimatedSize / 1024), 'KB');
    
    if (estimatedSize > 1024 * 1024) { // 1MB
      throw new Error(`Follow list too large (${Math.round(estimatedSize / 1024)} KB). Please unfollow users in smaller batches.`);
    }
    
    console.log('Preserved all non-user tags and filtered user follows only');
    
    // Create the event with preserved content and all tags
    const event = {
      kind: 3,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: mostRecentEvent.content || ''
    };
    
    // Ensure appropriate signing method is ready
    if (!this.isSigningReady()) {
      if (this.signingMethod === 'nip07') {
        console.log('🔄 Extension not ready, attempting connection...');
        await this.connectExtension();
      } else if (this.signingMethod === 'nip46') {
        throw new Error('NIP-46 bunker not connected. Please connect your bunker first.');
      }
    }
    
    // Double-check connection is still valid
    if (!this.isSigningReady()) {
      throw new Error(`Unable to establish connection with signing method: ${this.signingMethod}`);
    }
    
    console.log('🔐 Starting signing process...');
    console.log('Event to sign:', {
      kind: event.kind,
      created_at: event.created_at,
      tags: event.tags.length,
      content: event.content.length
    });
    
    // Log signing method being used
    console.log('🔌 Using signing method:', this.signingMethod);
    if (this.signingMethod === 'nip07' && window.nostr) {
      const extensionType = window.nostr.constructor?.name || 'unknown';
      console.log('🔌 Extension type:', extensionType);
    }
    
    // Sign event using appropriate method
    let signedEvent;
    try {
      if (this.signingMethod === 'nip07') {
        console.log('Attempting NIP-07 signing...');
        console.log('⏳ Calling window.nostr.signEvent() - check your extension for signing prompt...');
        
        signedEvent = await Promise.race([
          window.nostr.signEvent(event),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Signing timeout - please approve the signing request in your extension')), 60000)
          )
        ]);
      } else if (this.signingMethod === 'nip46') {
        console.log('Attempting NIP-46 signing...');
        console.log('⏳ Requesting signature from bunker - check your bunker app for signing prompt...');
        
        signedEvent = await this.nip46Service.signEvent(event);
      } else {
        throw new Error(`Invalid signing method: ${this.signingMethod}`);
      }
      
      console.log('✅ Event signed successfully:', signedEvent.id);
      
      // Publish to relays using simple WebSocket connections
      const publishResults = await this.publishEventToRelays(signedEvent);
      
      console.log(`✅ Event published to ${publishResults.successful}/${this.getPublishRelays().length} relays`);
      
      if (publishResults.successful === 0) {
        throw new Error('Failed to publish to any relays. Please check your internet connection.');
      }
      
      return {
        success: true,
        removedCount: pubkeysToRemove.length,
        newFollowCount: newUserFollowTags.length,
        publishedToRelays: publishResults.successful
      };
      
    } catch (signingError) {
      console.error('❌ Signing failed:', signingError);
      
      // Handle signing errors based on method
      if (this.signingMethod === 'nip07') {
        // NIP-07 specific error handling
        if (signingError.message && signingError.message.toLowerCase().includes('user rejected')) {
          throw new Error('You rejected the signing request. Please try again and approve the signing prompt to update your follow list.');
        } else if (signingError.message && signingError.message.toLowerCase().includes('timeout')) {
          throw new Error('Signing request timed out. Your extension may not be responding. Please check if your extension is unlocked and try again.');
        } else if (signingError.message.includes('not authorized') || signingError.message.includes('permission')) {
          throw new Error('Extension permissions not granted. Please check your Nostr extension settings for this site.');
        } else {
          throw new Error(`Failed to sign follow list update: ${signingError.message}. Check your Nostr extension is unlocked and permissions are granted.`);
        }
      } else if (this.signingMethod === 'nip46') {
        // NIP-46 specific error handling
        if (signingError.message && signingError.message.toLowerCase().includes('rejected')) {
          throw new Error('Signing was rejected in your bunker app. Please approve the signing request to update your follow list.');
        } else if (signingError.message && signingError.message.toLowerCase().includes('timeout')) {
          throw new Error('Signing request timed out. Please check your bunker app is responding.');
        } else {
          throw new Error(`Failed to sign follow list update: ${signingError.message}. Check your bunker connection.`);
        }
      } else {
        throw new Error(`Failed to sign follow list update: ${signingError.message}`);
      }
    }
  }
  
  async publishEventToRelays(signedEvent) {
    const relaysToUse = this.getPublishRelays();
    const publishPromises = relaysToUse.map(async (relayUrl) => {
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

    return { successful, failed, total: relaysToUse.length };
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
    // Clear common state
    this.pubkey = null;
    this.userProfile = null;
    this.follows.clear();
    this.userRelayList = null;
    this.followsRelayLists.clear();
    
    // Clear NIP-07 specific state
    this.extensionConnected = false;
    this.extensionAuthorized = false;
    this.connectionPromise = null;
    
    // Disconnect NIP-46 if connected
    if (this.signingMethod === 'nip46') {
      this.nip46Service.disconnect();
    }
    
    // Clear sessions from localStorage
    localStorage.removeItem('nostr_session');
    localStorage.removeItem('signing_method');
    
    // Disconnect from relays
    if (this.ndk) {
      this.ndk = null;
    }
    
    // Reset to default signing method
    this.signingMethod = 'nip07';
    
    console.log('✅ User logged out - all connection state cleared');
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
      // Try to restore based on signing method
      if (this.signingMethod === 'nip07') {
        return await this.restoreNip07Session();
      } else if (this.signingMethod === 'nip46') {
        return await this.restoreNip46Session();
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
    }
    
    return false;
  }

  async restoreNip07Session() {
    try {
      const sessionData = localStorage.getItem('nostr_session');
      
      if (sessionData) {
        const session = JSON.parse(sessionData);
        
        // Check if session is not too old (24 hours)
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        if (Date.now() - session.timestamp < maxAge) {
          // Restore session data
          this.pubkey = session.pubkey;
          this.userProfile = session.userProfile;
          
          // Check if extension is still available and responsive
          if (typeof window.nostr !== 'undefined') {
            try {
              // Test if extension is still working (quick check)
              const currentPubkey = await Promise.race([
                window.nostr.getPublicKey(),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Extension check timeout')), 3000)
                )
              ]);
              
              // Verify it's the same user
              if (currentPubkey === this.pubkey) {
                this.extensionConnected = true;
                this.extensionAuthorized = true;

                // Initialize NDK connection
                await this.initialize();

                console.log('✅ NIP-07 session restored successfully');

                // Trigger relay sync (non-blocking, delayed to allow initialization)
                setTimeout(() => {
                  console.log('🔄 Triggering automatic relay sync on session restore...');
                  syncManager.syncAll().then((result) => {
                    if (result.success) {
                      console.log(`✅ Auto-sync complete: synced ${result.synced.length} services`);
                    } else {
                      console.warn('⚠️ Auto-sync failed:', result.error || result.message);
                    }
                  }).catch(error => {
                    console.warn('⚠️ Auto-sync error:', error);
                  });
                }, 1000); // Delay 1 second to allow full initialization

                return true;
              } else {
                console.log('⚠️ Different user detected - clearing session');
                localStorage.removeItem('nostr_session');
              }
            } catch (extensionError) {
              console.log('⚠️ Extension not responsive - session invalid');
              localStorage.removeItem('nostr_session');
            }
          } else {
            console.log('⚠️ Extension not available - clearing session');
            localStorage.removeItem('nostr_session');
          }
        } else {
          // Session expired, clear it
          console.log('⚠️ NIP-07 session expired - clearing');
          localStorage.removeItem('nostr_session');
        }
      }
    } catch (error) {
      console.error('Failed to restore NIP-07 session:', error);
      localStorage.removeItem('nostr_session');
    }
    
    return false;
  }

  async restoreNip46Session() {
    try {
      const restored = await this.nip46Service.restoreConnection();
      if (restored) {
        // Get pubkey from restored connection
        this.pubkey = await this.nip46Service.getPublicKey();

        // Load user profile
        await this.loadUserProfile();

        // Initialize NDK with NIP-46 signer
        await this.initialize();

        console.log('✅ NIP-46 session restored successfully');

        // Trigger relay sync (non-blocking, delayed to allow initialization)
        setTimeout(() => {
          console.log('🔄 Triggering automatic relay sync on NIP-46 session restore...');
          syncManager.syncAll().then((result) => {
            if (result.success) {
              console.log(`✅ Auto-sync complete: synced ${result.synced.length} services`);
            } else {
              console.warn('⚠️ Auto-sync failed:', result.error || result.message);
            }
          }).catch(error => {
            console.warn('⚠️ Auto-sync error:', error);
          });
        }, 1000); // Delay 1 second to allow full initialization

        return true;
      }
    } catch (error) {
      console.error('Failed to restore NIP-46 session:', error);
    }

    return false;
  }

  /**
   * Parse a NIP-65 relay list event into a structured format
   */
  parseRelayList(event) {
    if (!event || event.kind !== 10002) {
      return null;
    }

    const relayList = {
      readRelays: [],
      writeRelays: [],
      bothRelays: [],
      lastUpdated: event.created_at
    };

    // Parse r tags from the relay list event
    for (const tag of event.tags) {
      if (tag[0] === 'r' && tag[1]) {
        const relayUrl = tag[1];
        const permission = tag[2]; // 'read', 'write', or undefined (both)
        
        if (permission === 'read') {
          relayList.readRelays.push(relayUrl);
        } else if (permission === 'write') {
          relayList.writeRelays.push(relayUrl);
        } else {
          // No permission specified means both read and write
          relayList.bothRelays.push(relayUrl);
        }
      }
    }

    return relayList;
  }

  /**
   * Get effective read relays for a user (bothRelays + readRelays)
   */
  getReadRelays(relayList) {
    if (!relayList) return [];
    return [...relayList.bothRelays, ...relayList.readRelays];
  }

  /**
   * Get effective write relays for a user (bothRelays + writeRelays)
   */
  getWriteRelays(relayList) {
    if (!relayList) return [];
    return [...relayList.bothRelays, ...relayList.writeRelays];
  }

  /**
   * Fetch the relay list for a specific pubkey
   */
  async fetchRelayList(pubkey) {
    if (!this.ndk) {
      await this.initialize();
    }

    try {
      const filter = {
        kinds: [10002],
        authors: [pubkey],
        limit: 1
      };

      console.log(`🔍 Fetching NIP-65 relay list for ${pubkey.substring(0, 8)}...`);
      
      // Use fetchEvents approach directly (same as follow lists) - faster and more reliable
      try {
        const events = await this.ndk.fetchEvents({
          kinds: [10002],
          authors: [pubkey],
          limit: 1
        });
        
        if (events && events.size > 0) {
          const eventArray = Array.from(events).sort((a, b) => b.created_at - a.created_at);
          const relayList = this.parseRelayList(eventArray[0]);
          console.log(`✅ Found relay list for ${pubkey.substring(0, 8)}...:`, relayList);
          return relayList;
        } else {
          console.log(`❌ No relay list found for ${pubkey.substring(0, 8)}...`);
        }
      } catch (fastError) {
        console.warn('⚠️ fetchEvents method failed, falling back to subscription:', fastError);
      }
      
      // Fallback to subscription method only if fetchEvents fails
      const connectedRelays = Array.from(this.ndk?.pool?.relays?.values() || [])
        .filter(r => r.connectivity.status === 1);
      
      console.log('🔧 NDK state for fallback:', {
        exists: !!this.ndk,
        signingMethod: this.signingMethod,
        relaysCount: this.ndk?.pool?.relays?.size || 0,
        connectedRelays: connectedRelays.length,
        relayUrls: connectedRelays.map(r => r.url)
      });
      
      // If no relays are connected yet, wait briefly for connections to establish
      if (connectedRelays.length === 0) {
        console.log('⏳ No relays connected yet, waiting for connections...');
        
        // Wait up to 3 seconds for at least one relay to connect (fallback only)
        let attempts = 0;
        const maxAttempts = 6; // 6 x 500ms = 3 seconds max
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
          
          const nowConnectedRelays = Array.from(this.ndk?.pool?.relays?.values() || [])
            .filter(r => r.connectivity.status === 1);
          
          if (nowConnectedRelays.length > 0) {
            console.log(`✅ Connected to ${nowConnectedRelays.length} relays after ${attempts * 500}ms`);
            console.log(`📡 Connected relay URLs:`, nowConnectedRelays.map(r => r.url));
            break;
          }
          
          if (attempts % 6 === 0) { // Log every 3 seconds
            console.log(`⏳ Still waiting for relay connections... (${attempts * 500}ms)`);
            // Log relay statuses to debug connection issues
            const allRelays = Array.from(this.ndk?.pool?.relays?.values() || []);
            const relayStatuses = allRelays.map(r => ({ 
              url: r.url, 
              status: r.connectivity.status,
              statusText: r.connectivity.status === 0 ? 'connecting' : 
                         r.connectivity.status === 1 ? 'connected' : 'disconnected'
            }));
            console.log(`🔍 Current relay statuses:`, relayStatuses);
            
            // Log individual relay status for clarity
            relayStatuses.forEach(relay => {
              console.log(`  📡 ${relay.url}: ${relay.statusText} (${relay.status})`);
            });
          }
        }
        
        const finalConnectedRelays = Array.from(this.ndk?.pool?.relays?.values() || [])
          .filter(r => r.connectivity.status === 1);
        
        if (finalConnectedRelays.length === 0) {
          console.warn('⚠️ No relays connected after 3 second fallback timeout');
          return null; // Return null since primary method already tried fetchEvents
        }
      }
      
      const events = [];
      const subscription = this.ndk.subscribe(filter);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          subscription.stop();
          console.log(`⏰ Relay list fetch timeout for ${pubkey.substring(0, 8)}...`);
          resolve(null); // Return null on timeout rather than rejecting
        }, 5000);

        subscription.on('event', (event) => {
          events.push(event);
        });

        subscription.on('eose', () => {
          clearTimeout(timeout);
          subscription.stop();
          
          if (events.length > 0) {
            // Get the most recent relay list event
            events.sort((a, b) => b.created_at - a.created_at);
            const relayList = this.parseRelayList(events[0]);
            console.log(`✅ Found relay list for ${pubkey.substring(0, 8)}...:`, relayList);
            resolve(relayList);
          } else {
            console.log(`❌ No relay list found for ${pubkey.substring(0, 8)}...`);
            resolve(null);
          }
        });

        subscription.on('error', (error) => {
          clearTimeout(timeout);
          subscription.stop();
          console.error(`❌ Error fetching relay list for ${pubkey.substring(0, 8)}...:`, error);
          resolve(null); // Return null on error rather than rejecting
        });
      });
    } catch (error) {
      console.error(`❌ Failed to fetch relay list for ${pubkey.substring(0, 8)}...:`, error);
      return null;
    }
  }

  /**
   * Fetch and cache the logged-in user's relay list
   */
  async fetchUserRelayList() {
    console.log('📋 fetchUserRelayList called with:', {
      hasPubkey: !!this.pubkey,
      signingMethod: this.signingMethod,
      pubkeyPreview: this.pubkey?.substring(0, 8) + '...'
    });
    
    if (!this.pubkey) {
      console.warn('❌ Cannot fetch user relay list - no pubkey available');
      return null;
    }

    const relayList = await this.fetchRelayList(this.pubkey);
    this.userRelayList = relayList;
    console.log('📋 fetchUserRelayList result:', !!relayList);
    return relayList;
  }

  /**
   * Fetch relay lists for multiple pubkeys (follows)
   */
  async fetchFollowsRelayLists(pubkeys, progressCallback = null) {
    if (!Array.isArray(pubkeys) || pubkeys.length === 0) {
      return new Map();
    }

    console.log(`🔍 Fetching relay lists for ${pubkeys.length} follows...`);
    
    const relayLists = new Map();
    const batchSize = 20; // Process in batches to avoid overwhelming relays
    
    for (let i = 0; i < pubkeys.length; i += batchSize) {
      const batch = pubkeys.slice(i, i + batchSize);
      
      if (progressCallback) {
        progressCallback({
          stage: 'Fetching relay lists...',
          processed: i,
          total: pubkeys.length
        });
      }
      
      const batchPromises = batch.map(async (pubkey) => {
        const relayList = await this.fetchRelayList(pubkey);
        if (relayList) {
          relayLists.set(pubkey, relayList);
          this.followsRelayLists.set(pubkey, relayList); // Cache it
        }
        return { pubkey, relayList };
      });
      
      await Promise.all(batchPromises);
      
      // Small delay between batches to be nice to relays
      if (i + batchSize < pubkeys.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (progressCallback) {
      progressCallback({
        stage: 'Relay lists fetched',
        processed: pubkeys.length,
        total: pubkeys.length
      });
    }
    
    console.log(`✅ Fetched relay lists for ${relayLists.size} out of ${pubkeys.length} follows`);
    return relayLists;
  }

  /**
   * Enhanced activity scanning using per-user relay preferences
   * This method queries each user's preferred write relays for more accurate results
   */
  async getProfilesActivityOptimized(pubkeys, limit = 10, progressCallback = null) {
    if (!pubkeys || pubkeys.length === 0) {
      return new Map();
    }

    await this.initialize();
    
    const activityMap = new Map();
    
    // Initialize all pubkeys with empty arrays
    pubkeys.forEach(pubkey => {
      activityMap.set(pubkey, []);
    });
    
    console.log('🚀 Using optimized activity scanning with per-user relay preferences');
    
    // Process users individually or in small relay-specific batches
    let processed = 0;
    for (const pubkey of pubkeys) {
      if (progressCallback) {
        progressCallback({
          stage: `Scanning activity... (${processed}/${pubkeys.length})`,
          processed: processed,
          total: pubkeys.length
        });
      }
      
      const relaysToScan = this.getActivityScanRelays(pubkey);
      
      try {
        const events = await this.fetchUserActivity(pubkey, relaysToScan, limit);
        if (events.length > 0) {
          activityMap.set(pubkey, events);
          console.log(`📊 Found ${events.length} events for ${pubkey.substring(0, 8)}... using ${relaysToScan.length} relays`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch activity for ${pubkey.substring(0, 8)}...:`, error.message);
      }
      
      processed++;
      
      // Small delay to be nice to relays
      if (processed % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (progressCallback) {
      progressCallback({
        stage: 'Activity scanning complete',
        processed: pubkeys.length,
        total: pubkeys.length
      });
    }
    
    const foundActivity = Array.from(activityMap.values()).filter(events => events.length > 0).length;
    console.log(`✅ Optimized activity scan complete: found activity for ${foundActivity}/${pubkeys.length} users`);
    
    return activityMap;
  }

  /**
   * Smart relay-aware retry for users with no detected activity
   * This targets only users who have specific relay preferences to prevent false positives
   */
  async smartRelayRetry(pubkeys, progressCallback = null) {
    if (!pubkeys || pubkeys.length === 0) {
      return new Map();
    }

    console.log(`🎯 Starting smart relay retry for ${pubkeys.length} users with cached relay preferences`);
    
    const retryResults = new Map();
    
    // Initialize all pubkeys with empty arrays
    pubkeys.forEach(pubkey => {
      retryResults.set(pubkey, []);
    });
    
    // Group users by their specific relay preferences (only those who have relay lists)
    const usersWithRelayLists = pubkeys.filter(pubkey => this.followsRelayLists.has(pubkey));
    const usersWithoutRelayLists = pubkeys.filter(pubkey => !this.followsRelayLists.has(pubkey));
    
    console.log(`📊 Smart retry: ${usersWithRelayLists.length} users have relay lists, ${usersWithoutRelayLists.length} don't`);
    
    if (usersWithRelayLists.length > 0) {
      // Process users with relay lists in small batches
      const batchSize = 10;
      let processed = 0;
      
      for (let i = 0; i < usersWithRelayLists.length; i += batchSize) {
        const batch = usersWithRelayLists.slice(i, i + batchSize);
        
        if (progressCallback) {
          progressCallback({
            stage: `Smart retry: ${processed}/${usersWithRelayLists.length} users with relay preferences...`,
            processed: processed,
            total: usersWithRelayLists.length
          });
        }
        
        // Process each user in the batch with their specific relays
        for (const pubkey of batch) {
          const relayList = this.followsRelayLists.get(pubkey);
          const writeRelays = this.getWriteRelays(relayList);
          
          if (writeRelays.length > 0) {
            try {
              const events = await this.fetchUserActivitySingle(pubkey, writeRelays, 5);
              if (events.length > 0) {
                retryResults.set(pubkey, events);
                console.log(`🎯 SMART SUCCESS: ${pubkey.substring(0, 8)}... found on their ${writeRelays.length} preferred relays`);
              }
            } catch (error) {
              console.warn(`⚠️ Smart retry failed for ${pubkey.substring(0, 8)}...:`, error.message);
            }
          }
        }
        
        processed += batch.length;
        
        // Small delay between batches to avoid overwhelming relays
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    const recoveredCount = Array.from(retryResults.values()).filter(events => events.length > 0).length;
    console.log(`✅ Smart relay retry complete: recovered ${recoveredCount}/${usersWithRelayLists.length} users with relay preferences`);
    
    return retryResults;
  }

  /**
   * Fetch activity for a single user from their preferred relays (optimized for retry)
   */
  async fetchUserActivitySingle(pubkey, relays, limit = 5) {
    const filter = {
      kinds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      authors: [pubkey],
      limit: limit,
      since: Math.floor((Date.now() - (180 * 24 * 60 * 60 * 1000)) / 1000) // Only look back 6 months for retry
    };

    const events = [];
    
    try {
      // Use main NDK instance but query specific relays temporarily
      const subscription = this.ndk.subscribe(filter, { closeOnEose: true });
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          subscription.stop();
          resolve(events);
        }, 5000); // Shorter timeout for retry
        
        subscription.on('event', (event) => {
          events.push(event);
        });
        
        subscription.on('eose', () => {
          clearTimeout(timeout);
          subscription.stop();
          events.sort((a, b) => b.created_at - a.created_at);
          resolve(events.slice(0, limit));
        });
        
        subscription.on('error', () => {
          clearTimeout(timeout);
          subscription.stop();
          resolve(events);
        });
      });
    } catch (error) {
      console.warn(`Single user fetch failed for ${pubkey.substring(0, 8)}...:`, error);
      return [];
    }
  }

  /**
   * Fetch activity for a single user from their preferred relays
   */
  async fetchUserActivity(pubkey, relays, limit = 10) {
    const filter = {
      kinds: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 40, 41, 42, 43, 44,
        1063, 1311, 1984, 1985, 9734, 9735, 10000, 10001, 10002,
        30000, 30001, 30008, 30009, 30017, 30018, 30023, 30024,
        31890, 31922, 31923, 31924, 31925, 31989, 31990, 34550
      ],
      authors: [pubkey],
      limit: limit * 2, // Get a few extra to account for filtering
      since: Math.floor((Date.now() - (365 * 24 * 60 * 60 * 1000)) / 1000) // Look back 1 year
    };

    const events = [];
    
    // Try to use NDK with specific relays
    try {
      // Create temporary NDK instance with specific relays for this user
      const specificNdk = new NDK({
        explicitRelayUrls: relays
      });
      
      await specificNdk.connect();
      
      const subscription = specificNdk.subscribe(filter);
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          subscription.stop();
          specificNdk.pool.close();
          resolve(events);
        }, 8000); // 8 second timeout per user
        
        subscription.on('event', (event) => {
          events.push(event);
        });
        
        subscription.on('eose', () => {
          clearTimeout(timeout);
          subscription.stop();
          specificNdk.pool.close();
          
          // Sort by creation time and limit results
          events.sort((a, b) => b.created_at - a.created_at);
          resolve(events.slice(0, limit));
        });
        
        subscription.on('error', (error) => {
          clearTimeout(timeout);
          subscription.stop();
          specificNdk.pool.close();
          console.warn(`Error in user-specific relay scan for ${pubkey.substring(0, 8)}...:`, error);
          resolve(events);
        });
      });
    } catch (error) {
      console.warn(`Failed to create specific relay connection for ${pubkey.substring(0, 8)}...:`, error);
      return [];
    }
  }

  /**
   * Get the best relays to scan for a user's activity
   * Returns write relays (where they publish) + read relays (comprehensive coverage) + fallback to default relays
   * Enhanced to reduce false positives through better outbox/inbox relay coverage
   */
  getActivityScanRelays(pubkey) {
    const relayList = this.followsRelayLists.get(pubkey);
    if (relayList) {
      const writeRelays = this.getWriteRelays(relayList);
      const readRelays = this.getReadRelays(relayList);
      
      // Combine write and read relays for comprehensive coverage
      const combinedRelays = [...new Set([...writeRelays, ...readRelays])];
      
      if (combinedRelays.length > 0) {
        console.log(`📡 Using ${writeRelays.length} write + ${readRelays.length} read relays (${combinedRelays.length} unique) for ${pubkey.substring(0, 8)}...`);
        return combinedRelays;
      }
    }
    
    // Fallback to default relays if no specific relay list found
    return this.relays;
  }

  /**
   * Enhanced activity scanning with parallel relay queries to reduce false positives
   * Queries both user-specific relays and default relays simultaneously for comprehensive coverage
   */
  async getEnhancedUserActivity(pubkeys, progressCallback = null) {
    console.log(`🔍 ENHANCED SCAN: Starting comprehensive activity scan for ${pubkeys.length} users`);
    
    await this.initialize();
    const results = new Map();
    
    // Initialize results map
    pubkeys.forEach(pubkey => {
      results.set(pubkey, []);
    });

    const batchSize = 8; // Smaller batches for parallel processing
    const totalBatches = Math.ceil(pubkeys.length / batchSize);

    for (let i = 0; i < pubkeys.length; i += batchSize) {
      const batch = pubkeys.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      console.log(`🔍 Processing enhanced batch ${batchNumber}/${totalBatches} (${batch.length} users)`);
      
      if (progressCallback) {
        progressCallback({
          stage: `Enhanced scanning batch ${batchNumber}/${totalBatches}...`,
          processed: i,
          total: pubkeys.length
        });
      }

      // Create parallel queries for each user in the batch
      const batchPromises = batch.map(pubkey => this.queryUserActivityParallel(pubkey));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process results
        batchResults.forEach((result, index) => {
          const pubkey = batch[index];
          if (result.status === 'fulfilled' && result.value) {
            results.set(pubkey, result.value);
            if (result.value.length > 0) {
              console.log(`✅ Enhanced scan found ${result.value.length} events for ${pubkey.substring(0, 8)}...`);
            }
          } else {
            console.warn(`⚠️ Enhanced scan failed for ${pubkey.substring(0, 8)}...`);
          }
        });
      } catch (error) {
        console.error(`Batch ${batchNumber} failed:`, error);
      }

      // Small delay between batches to prevent overwhelming relays
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    return results;
  }

  /**
   * Query user activity from both user-specific and default relays in parallel
   * This reduces false positives by ensuring comprehensive relay coverage
   */
  async queryUserActivityParallel(pubkey) {
    const userSpecificRelays = this.getActivityScanRelays(pubkey);
    const defaultRelays = this.relays;
    
    // Determine if user has specific relays different from defaults
    const hasUserSpecificRelays = userSpecificRelays.some(relay => !defaultRelays.includes(relay));
    
    const filter = {
      kinds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 40, 41, 42, 43, 44, 1063, 1311, 1984, 1985, 9734, 9735, 10000, 10001, 10002, 30000, 30001, 30008, 30009, 30017, 30018, 30023, 30024, 31890, 31922, 31923, 31924, 31925, 31989, 31990, 34550],
      authors: [pubkey],
      since: Math.floor((Date.now() / 1000) - (365 * 24 * 60 * 60)), // Look back 1 year
      limit: 100
    };

    const queries = [];
    
    // Query 1: User-specific relays (if different from defaults)
    if (hasUserSpecificRelays) {
      const userRelayNDK = new (await import('@nostr-dev-kit/ndk')).default({
        explicitRelayUrls: userSpecificRelays
      });
      
      queries.push(
        Promise.race([
          userRelayNDK.connect().then(() => userRelayNDK.fetchEvents(filter)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('User relay timeout')), 8000))
        ]).catch(error => {
          console.warn(`User-specific relay query failed for ${pubkey.substring(0, 8)}...:`, error.message);
          return new Set(); // Return empty set on failure
        })
      );
    }

    // Query 2: Default relays (always query for comprehensive coverage)
    queries.push(
      Promise.race([
        this.ndk.fetchEvents(filter),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Default relay timeout')), 8000))
      ]).catch(error => {
        console.warn(`Default relay query failed for ${pubkey.substring(0, 8)}...:`, error.message);
        return new Set(); // Return empty set on failure
      })
    );

    try {
      // Execute both queries in parallel
      const queryResults = await Promise.all(queries);
      
      // Combine results from all queries, removing duplicates by event ID
      const allEvents = new Map();
      
      queryResults.forEach(eventSet => {
        if (eventSet && eventSet.size > 0) {
          for (const event of eventSet) {
            if (!allEvents.has(event.id)) {
              allEvents.set(event.id, {
                id: event.id,
                created_at: event.created_at,
                content: event.content,
                kind: event.kind
              });
            }
          }
        }
      });

      const combinedEvents = Array.from(allEvents.values());
      
      if (combinedEvents.length > 0) {
        console.log(`🎯 Parallel query success: Found ${combinedEvents.length} unique events for ${pubkey.substring(0, 8)}... from ${queries.length} relay sets`);
      }
      
      return combinedEvents;
      
    } catch (error) {
      console.error(`Parallel query failed for ${pubkey.substring(0, 8)}...:`, error);
      return [];
    }
  }

  /**
   * Get the best relays to publish to for the logged-in user
   * Returns user's write relays + fallback to default relays
   */
  getPublishRelays() {
    if (this.userRelayList) {
      const writeRelays = this.getWriteRelays(this.userRelayList);
      if (writeRelays.length > 0) {
        console.log(`📡 Using ${writeRelays.length} user write relays for publishing`);
        return writeRelays;
      }
    }
    
    // Fallback to default relays if no user relay list
    console.log(`📡 Using ${this.relays.length} default relays for publishing`);
    return this.relays;
  }

  async restoreNip46Session() {
    try {
      const restored = await this.nip46Service.restoreConnection();
      if (restored) {
        // Get pubkey from restored connection
        this.pubkey = await this.nip46Service.getPublicKey();

        // Load user profile
        await this.loadUserProfile();

        // Initialize NDK with NIP-46 signer
        await this.initialize();

        console.log('✅ NIP-46 session restored successfully');

        // Trigger relay sync (non-blocking, delayed to allow initialization)
        setTimeout(() => {
          console.log('🔄 Triggering automatic relay sync on NIP-46 session restore...');
          syncManager.syncAll().then((result) => {
            if (result.success) {
              console.log(`✅ Auto-sync complete: synced ${result.synced.length} services`);
            } else {
              console.warn('⚠️ Auto-sync failed:', result.error || result.message);
            }
          }).catch(error => {
            console.warn('⚠️ Auto-sync error:', error);
          });
        }, 1000); // Delay 1 second to allow full initialization

        return true;
      }
    } catch (error) {
      console.error('Failed to restore NIP-46 session:', error);
    }

    return false;
  }
}

// Create singleton instance
const nostrService = new NostrService();
export default nostrService;