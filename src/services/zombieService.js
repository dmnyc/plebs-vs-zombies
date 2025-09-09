import { differenceInDays } from 'date-fns';
import nostrService from './nostrService';
import immunityService from './immunityService';
import localforage from 'localforage';

// Configure localforage
localforage.config({
  name: 'plebs-vs-zombies',
  storeName: 'zombie_data'
});

class ZombieService {
  constructor() {
    this.zombieThresholds = {
      fresh: 90,    // 3 months minimum before considering zombie
      rotting: 180, // 6 months for "rotting" zombie  
      ancient: 365  // 1 year for "ancient" zombie (more conservative)
    };
    this.batchSize = 30;  // Default batch size for unfollows
  }

  /**
   * Set custom thresholds for zombie classification
   */
  setThresholds(fresh, rotting, ancient) {
    this.zombieThresholds.fresh = fresh || this.zombieThresholds.fresh;
    this.zombieThresholds.rotting = rotting || this.zombieThresholds.rotting;
    this.zombieThresholds.ancient = ancient || this.zombieThresholds.ancient;
  }

  /**
   * Set batch size for unfollows
   */
  setBatchSize(size) {
    if (size > 0 && size <= 100) {
      this.batchSize = size;
    }
  }

  /**
   * Classify follows based on their activity and deleted status
   */
  classifyZombies(activityData, profileData = null, progressCallback = null) {
    const now = Date.now() / 1000; // Current time in seconds
    const zombies = {
      burned: [], // Deleted accounts - highest priority for purging
      fresh: [],
      rotting: [],
      ancient: [],
      active: []
    };

    console.log(`Classifying zombies using thresholds: fresh=${this.zombieThresholds.fresh}d, rotting=${this.zombieThresholds.rotting}d, ancient=${this.zombieThresholds.ancient}d`);

    // Debug specific users before classification
    const debugUsers = ['f2aa7b81', '42ca8dc2', '0461fcbe', 'c83723d3', 'd0debf9f'];
    for (const prefix of debugUsers) {
      for (const [pubkey, events] of activityData.entries()) {
        if (pubkey.startsWith(prefix)) {
          console.log(`🎯 PRE-CLASSIFICATION: ${pubkey.substring(0, 8)}... has ${events.length} events`);
          if (events.length > 0) {
            const mostRecent = events[0];
            const daysSince = (Date.now() / 1000 - mostRecent.created_at) / (24 * 60 * 60);
            console.log(`  Most recent event: ${daysSince.toFixed(1)} days ago, kind=${mostRecent.kind}, created=${new Date(mostRecent.created_at * 1000).toISOString()}`);
            
            // Show all events for these debug users
            console.log(`  All ${events.length} events for ${pubkey.substring(0, 8)}:`);
            events.forEach((event, i) => {
              const eventDays = (Date.now() / 1000 - event.created_at) / (24 * 60 * 60);
              console.log(`    ${i+1}. kind=${event.kind}, ${eventDays.toFixed(1)} days ago, ${new Date(event.created_at * 1000).toISOString()}`);
            });
          } else {
            console.log(`  ❌ NO EVENTS FOUND for ${pubkey.substring(0, 8)}... - this will be classified as ancient zombie`);
          }
        }
      }
    }

    let processedCount = 0;
    const totalUsers = activityData.size;
    
    for (const [pubkey, events] of activityData.entries()) {
      processedCount++;
      
      
      // Report progress more frequently for better UX (every 3 users or when a zombie is found)
      const currentZombieCount = zombies.burned.length + zombies.fresh.length + zombies.rotting.length + zombies.ancient.length;
      const shouldReport = processedCount % 3 === 0 || processedCount === totalUsers || currentZombieCount !== (this.lastReportedZombieCount || 0);
      
      if (progressCallback && shouldReport) {
        this.lastReportedZombieCount = currentZombieCount;
        progressCallback({
          stage: 'Analyzing user activity and deleted accounts...',
          currentNpub: pubkey.substring(0, 8) + '...',
          zombiesFound: currentZombieCount
        });
      }
      
      // Check if account is deleted first (highest priority) with improved validation
      if (profileData && profileData.has(pubkey)) {
        const profile = profileData.get(pubkey);
        if (profile.deleted) {
          const timeline = profile.deletionTimeline;
          const hasRecentActivity = events.length > 0;
          const lastActivityTime = hasRecentActivity ? events[0].created_at : null;
          
          // Cross-validate: Check if they've been active AFTER marking as deleted
          let isGenuinelyDeleted = true;
          let validationReason = 'deleted_account';
          
          if (timeline && hasRecentActivity) {
            const activityAfterDeletion = lastActivityTime > timeline.markedDeletedAt;
            const daysSinceDeletion = Math.floor((now - timeline.markedDeletedAt) / (24 * 60 * 60));
            const daysSinceLastActivity = Math.floor((now - lastActivityTime) / (24 * 60 * 60));
            
            if (activityAfterDeletion && daysSinceLastActivity < 7) {
              // They've been active within the last week AFTER marking as deleted
              console.log(`⚠️  User ${pubkey.substring(0, 8)}... marked deleted ${daysSinceDeletion}d ago but posted ${daysSinceLastActivity}d ago - SUSPICIOUS`);
              isGenuinelyDeleted = false;
              validationReason = 'deleted_but_active';
            }
          }
          
          if (isGenuinelyDeleted) {
            const deletionInfo = timeline ? {
              markedDeletedAt: timeline.markedDeletedAt,
              deletionAge: timeline.deletionAge,
              profileUpdatesAfterDeletion: timeline.profileUpdatesAfterDeletion
            } : null;
            
            console.log(`🔥 User ${pubkey.substring(0, 8)}... is BURNED zombie: account marked as deleted${timeline ? ` ${Math.floor(timeline.deletionAge / (24 * 60 * 60))}d ago` : ''}`);
            
            zombies.burned.push({
              pubkey,
              lastActivity: lastActivityTime,
              daysSinceActivity: hasRecentActivity ? differenceInDays(now * 1000, lastActivityTime * 1000) : null,
              reason: validationReason,
              deletionInfo: deletionInfo
            });
            
            // Immediately update progress when a zombie is found
            if (progressCallback) {
              const currentZombieCount = zombies.burned.length + zombies.fresh.length + zombies.rotting.length + zombies.ancient.length;
              progressCallback({
                stage: 'Found burned zombie (deleted account)...',
                currentNpub: pubkey.substring(0, 8) + '...',
                zombiesFound: currentZombieCount,
                processed: processedCount
              });
            }
            continue;
          } else {
            // They're marked as deleted but are still active - treat as regular zombie based on activity
            console.log(`📝 User ${pubkey.substring(0, 8)}... marked deleted but still active - treating as regular zombie`);
          }
        }
      }
      
      if (events.length === 0) {
        // No activity found - but be very conservative here
        // Only classify as ancient if we really found nothing
        console.log(`No activity found for ${pubkey.substring(0, 8)}... - classifying as ancient zombie`);
        zombies.ancient.push({
          pubkey,
          lastActivity: null,
          daysSinceActivity: null,
          confidence: this.calculateConfidenceScore([], profileData ? profileData.get(pubkey) : null, pubkey)
        });
        
        // Immediately update progress when a zombie is found
        if (progressCallback) {
          const currentZombieCount = zombies.burned.length + zombies.fresh.length + zombies.rotting.length + zombies.ancient.length;
          progressCallback({
            stage: 'Found ancient zombie (no activity)...',
            currentNpub: pubkey.substring(0, 8) + '...',
            zombiesFound: currentZombieCount,
            processed: processedCount
          });
        }
        continue;
      }

      // Get the most recent activity
      const latestEvent = events[0];
      const daysSinceLastActivity = differenceInDays(
        now * 1000, // Convert to milliseconds
        latestEvent.created_at * 1000 // Convert to milliseconds
      );

      const zombieInfo = {
        pubkey,
        lastActivity: latestEvent.created_at,
        daysSinceActivity: daysSinceLastActivity,
        confidence: this.calculateConfidenceScore(events, profileData ? profileData.get(pubkey) : null, pubkey)
      };

      // ULTRA CONSERVATIVE - if there's ANY activity within 120 days (4 months), mark as active
      // This prevents false positives by being extremely cautious
      const conservativeThreshold = 120; // 4 months - even more conservative
      
      if (daysSinceLastActivity < conservativeThreshold) {
        zombies.active.push(zombieInfo);
        console.log(`User ${pubkey.substring(0, 8)}... is ACTIVE: last activity ${daysSinceLastActivity} days ago (< ${conservativeThreshold} days - CONSERVATIVE)`);
      } else if (daysSinceLastActivity >= this.zombieThresholds.ancient) {
        zombies.ancient.push(zombieInfo);
        console.log(`User ${pubkey.substring(0, 8)}... is ANCIENT zombie: last activity ${daysSinceLastActivity} days ago (>= ${this.zombieThresholds.ancient} days)`);
        
        // Immediately update progress when a zombie is found
        if (progressCallback) {
          const currentZombieCount = zombies.burned.length + zombies.fresh.length + zombies.rotting.length + zombies.ancient.length;
          progressCallback({
            stage: 'Found ancient zombie...',
            currentNpub: pubkey.substring(0, 8) + '...',
            zombiesFound: currentZombieCount,
            processed: processedCount
          });
        }
      } else if (daysSinceLastActivity >= this.zombieThresholds.rotting) {
        zombies.rotting.push(zombieInfo);
        console.log(`User ${pubkey.substring(0, 8)}... is ROTTING zombie: last activity ${daysSinceLastActivity} days ago (>= ${this.zombieThresholds.rotting} days)`);
        
        // Immediately update progress when a zombie is found
        if (progressCallback) {
          const currentZombieCount = zombies.burned.length + zombies.fresh.length + zombies.rotting.length + zombies.ancient.length;
          progressCallback({
            stage: 'Found rotting zombie...',
            currentNpub: pubkey.substring(0, 8) + '...',
            zombiesFound: currentZombieCount,
            processed: processedCount
          });
        }
      } else if (daysSinceLastActivity >= this.zombieThresholds.fresh) {
        zombies.fresh.push(zombieInfo);
        console.log(`User ${pubkey.substring(0, 8)}... is FRESH zombie: last activity ${daysSinceLastActivity} days ago (>= ${this.zombieThresholds.fresh} days)`);
        
        // Immediately update progress when a zombie is found
        if (progressCallback) {
          const currentZombieCount = zombies.burned.length + zombies.fresh.length + zombies.rotting.length + zombies.ancient.length;
          progressCallback({
            stage: 'Found fresh zombie...',
            currentNpub: pubkey.substring(0, 8) + '...',
            zombiesFound: currentZombieCount,
            processed: processedCount
          });
        }
      } else {
        // This shouldn't happen, but failsafe to active
        zombies.active.push(zombieInfo);
        console.log(`User ${pubkey.substring(0, 8)}... defaulted to ACTIVE: last activity ${daysSinceLastActivity} days ago`);
      }
    }

    console.log(`Classification complete: active=${zombies.active.length}, burned=${zombies.burned.length}, fresh=${zombies.fresh.length}, rotting=${zombies.rotting.length}, ancient=${zombies.ancient.length}`);

    return zombies;
  }

  /**
   * Calculate confidence score for zombie classification
   * Higher score = more confident in the classification
   * Lower score = uncertain, may need manual review
   */
  calculateConfidenceScore(events, profile, pubkey) {
    let confidence = 0.5; // Start at medium confidence
    
    // Factor 1: Number of events found (more events = higher confidence)
    if (events.length === 0) {
      confidence -= 0.3; // Very low confidence if no events found
    } else if (events.length >= 5) {
      confidence += 0.2; // Higher confidence with many events
    } else if (events.length >= 2) {
      confidence += 0.1; // Some confidence with multiple events
    }
    
    // Factor 2: Relay list availability (having relay list = higher confidence)
    const hasRelayList = nostrService.followsRelayLists.has(pubkey);
    if (hasRelayList) {
      confidence += 0.2; // More confident when we know their preferred relays
    } else {
      confidence -= 0.2; // Less confident when we don't know their relay preferences
    }
    
    // Factor 3: Profile completeness (complete profile = likely active user)
    if (profile && profile.name && profile.about) {
      confidence += 0.1; // Complete profiles are less likely to be zombies
    } else if (profile && (profile.name || profile.about)) {
      confidence += 0.05; // Partial profile information
    }
    
    // Factor 4: Activity pattern consistency (recent events spread over time = higher confidence)
    if (events.length >= 2) {
      const timeSpan = events[0].created_at - events[events.length - 1].created_at;
      const daySpan = timeSpan / (24 * 60 * 60);
      if (daySpan > 30) {
        confidence += 0.1; // Activity spread over time indicates consistent usage
      }
    }
    
    // Factor 5: Account age (very new accounts might be missed due to indexing delays)
    if (events.length > 0) {
      const oldestEvent = events[events.length - 1];
      const accountAge = (Date.now() / 1000 - oldestEvent.created_at) / (24 * 60 * 60);
      if (accountAge < 30) {
        confidence -= 0.1; // Lower confidence for very new accounts
      }
    }
    
    // Clamp confidence to reasonable bounds
    confidence = Math.max(0.1, Math.min(0.9, confidence));
    
    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Scan follow list and detect zombies with profile enrichment
   */
  async scanForZombies(fetchProfiles = true, progressCallback = null, createBackup = true) {
    try {
      // Initialize tracking for progress reporting
      this.lastReportedZombieCount = 0;
      
      // Initialize immunity service
      await immunityService.init();
      
      // Create backup before scanning (if enabled)
      if (createBackup) {
        if (progressCallback) {
          progressCallback({
            stage: 'Creating pre-scan backup...',
            processed: 0,
            total: 0
          });
        }
        
        try {
          const backupService = (await import('./backupService')).default;
          const backupResult = await backupService.createBackup(`Pre-scan backup - ${new Date().toISOString()}`);
          
          if (!backupResult.success) {
            console.warn('Failed to create pre-scan backup:', backupResult.message);
          } else {
            console.log('✅ Pre-scan backup created successfully');
          }
        } catch (error) {
          console.warn('Failed to create pre-scan backup:', error);
        }
      }
      
      // Get the user's follow list
      const allFollows = await nostrService.getFollowList();
      
      if (!allFollows || allFollows.length === 0) {
        return {
          success: false,
          message: 'No follows found'
        };
      }
      
      // Filter out immune users before scanning
      const immunePubkeys = immunityService.getImmunePubkeys();
      const followList = allFollows.filter(pubkey => !immunityService.hasImmunity(pubkey));
      
      const immuneCount = allFollows.length - followList.length;
      if (immuneCount > 0) {
        console.log(`🛡️ Excluded ${immuneCount} immune users from scan (${immunePubkeys.length} total immune)`);
      }
      
      if (followList.length === 0) {
        return {
          success: false,
          message: `All ${allFollows.length} follows are immune from scanning`
        };
      }
      
      console.log(`Starting zombie scan for ${followList.length} follows (${immuneCount} immune users excluded)`);
      console.log(`🎯 IMPORTANT: Users with activity in the past ${this.zombieThresholds.fresh} days will be marked as ACTIVE, not zombies.`);
      console.log(`Zombie thresholds: Fresh >= ${this.zombieThresholds.fresh}d, Rotting >= ${this.zombieThresholds.rotting}d, Ancient >= ${this.zombieThresholds.ancient}d`);
      
      // Report initial progress
      if (progressCallback) {
        progressCallback({
          total: followList.length,
          processed: 0,
          stage: `Loading follow list (${followList.length} follows)`,
          zombiesFound: 0
        });
      }

      // Fetch relay lists for follows to optimize activity scanning
      console.log('📡 Fetching relay lists for follows to optimize activity scanning...');
      if (progressCallback) {
        progressCallback({
          stage: 'Fetching relay lists for better accuracy...',
          processed: 0,
          total: followList.length
        });
      }
      
      const relayListProgress = (progress) => {
        if (progressCallback) {
          progressCallback({
            stage: `Fetching relay lists... (${progress.processed}/${progress.total})`,
            processed: progress.processed,
            total: progress.total
          });
        }
      };
      
      await nostrService.fetchFollowsRelayLists(followList, relayListProgress);
      console.log('✅ Relay list fetching complete');
      
      // Get activity data for each follow
      if (progressCallback) {
        progressCallback({
          stage: 'Fetching activity data from relays...',
          processed: 0
        });
      }
      
      // Use standard activity scanning (relay optimization is still beneficial for retry phase)
      const activityData = await nostrService.getProfilesActivity(followList, 10, progressCallback);
      
      // SMART RETRY: Use relay-aware targeting for high-accuracy verification
      const usersWithNoActivity = followList.filter(pubkey => {
        const events = activityData.get(pubkey) || [];
        return events.length === 0;
      });
      
      if (usersWithNoActivity.length > 0) {
        console.log(`🎯 SMART RETRY: ${usersWithNoActivity.length} users need relay-aware verification to prevent false positives`);
        
        if (progressCallback) {
          progressCallback({
            stage: `High-accuracy verification for ${usersWithNoActivity.length} users...`,
            processed: followList.length
          });
        }
        
        const retryResults = await nostrService.smartRelayRetry(usersWithNoActivity, progressCallback);
        
        // Merge retry results back into main activity data
        let recoveredUsers = 0;
        for (const [pubkey, events] of retryResults.entries()) {
          if (events.length > 0) {
            activityData.set(pubkey, events);
            console.log(`✅ RELAY RETRY SUCCESS: Found ${events.length} events for ${pubkey.substring(0, 8)}... using their preferred relays`);
            recoveredUsers++;
          }
        }
        
        console.log(`🎉 SMART RETRY COMPLETE: Recovered ${recoveredUsers}/${usersWithNoActivity.length} users from false positive classification`);
        
        // Fall back to aggressive retry for remaining users without relay lists
        const stillNoActivity = usersWithNoActivity.filter(pubkey => {
          const events = activityData.get(pubkey) || [];
          return events.length === 0;
        });
        
        if (stillNoActivity.length > 0) {
          console.log(`🔍 FALLBACK RETRY: ${stillNoActivity.length} users without relay lists need aggressive retry`);
          
          const aggressiveResults = await nostrService.aggressiveActivityRetry(stillNoActivity, progressCallback);
          
          let fallbackRecovered = 0;
          for (const [pubkey, events] of aggressiveResults.entries()) {
            if (events.length > 0) {
              activityData.set(pubkey, events);
              fallbackRecovered++;
            }
          }
          
          console.log(`🔥 FALLBACK COMPLETE: Recovered ${fallbackRecovered}/${stillNoActivity.length} additional users`);
        }
      }
      
      // Get profile data first for deleted account detection
      let profileData = new Map();
      if (fetchProfiles) {
        if (progressCallback) {
          progressCallback({
            stage: `Fetching profiles for deleted account detection...`
          });
        }
        console.log('Fetching profile metadata for deleted account detection...');
        profileData = await nostrService.getProfileMetadata(followList);
      }
      
      // Classify zombies
      if (progressCallback) {
        progressCallback({
          stage: 'Classifying zombie status and deleted accounts...',
          processed: followList.length
        });
      }
      
      const rawZombieData = this.classifyZombies(activityData, profileData, progressCallback);
      
      // Filter out immune zombies
      const zombieData = immunityService.filterImmuneZombies(rawZombieData);
      
      if (progressCallback) {
        const zombiesFound = zombieData.fresh.length + zombieData.rotting.length + zombieData.ancient.length;
        progressCallback({
          stage: 'Filtering immune zombies...',
          zombiesFound
        });
      }
      
      // Profile data was already fetched above for deleted account detection
      // Just update progress callback
      if (fetchProfiles && progressCallback) {
        const allZombieCount = (zombieData.burned?.length || 0) + zombieData.fresh.length + zombieData.rotting.length + zombieData.ancient.length;
        progressCallback({
          stage: `Processing profiles for ${allZombieCount} zombies...`
        });
      }
      
      // Combine zombie data with profiles
      const enrichedZombieData = {
        active: zombieData.active,
        burned: (zombieData.burned || []).map(z => ({
          ...z,
          profile: profileData.get(z.pubkey) || null
        })),
        fresh: zombieData.fresh.map(z => ({
          ...z,
          profile: profileData.get(z.pubkey) || null
        })),
        rotting: zombieData.rotting.map(z => ({
          ...z,
          profile: profileData.get(z.pubkey) || null
        })),
        ancient: zombieData.ancient.map(z => ({
          ...z,
          profile: profileData.get(z.pubkey) || null
        }))
      };
      
      // Store the scan results
      await this.storeScanResults(enrichedZombieData, profileData);
      
      const filteredZombieCount = (enrichedZombieData.burned?.length || 0) + enrichedZombieData.fresh.length + enrichedZombieData.rotting.length + enrichedZombieData.ancient.length;
      const totalZombieCount = (rawZombieData.burned?.length || 0) + rawZombieData.fresh.length + rawZombieData.rotting.length + rawZombieData.ancient.length;
      
      return {
        success: true,
        zombieData: enrichedZombieData,
        profileData,
        totalFollows: allFollows.length, // Total including immune users
        scannedFollows: followList.length, // Actually scanned (excluding immune)
        immuneCount: immuneCount,
        activeCount: zombieData.active.length,
        zombieCount: filteredZombieCount,
        immuneZombieCount: totalZombieCount - filteredZombieCount
      };
    } catch (error) {
      console.error('Failed to scan for zombies:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Store scan results for later use
   */
  async storeScanResults(zombieData, profileData = null) {
    const scanResults = {
      timestamp: Date.now(),
      data: zombieData,
      hasProfiles: !!profileData
    };
    
    await localforage.setItem('latestScan', scanResults);
    
    // Store profile data separately to avoid bloat
    if (profileData) {
      await localforage.setItem('latestProfiles', Object.fromEntries(profileData));
    }
    
    // Also keep a history of scans
    let scanHistory = await localforage.getItem('scanHistory') || [];
    scanHistory.push({
      timestamp: scanResults.timestamp,
      activeCount: zombieData.active.length,
      burnedCount: zombieData.burned?.length || 0,
      freshCount: zombieData.fresh.length,
      rottingCount: zombieData.rotting.length,
      ancientCount: zombieData.ancient.length
    });
    
    // Keep only the last 10 scans
    if (scanHistory.length > 10) {
      scanHistory = scanHistory.slice(-10);
    }
    
    await localforage.setItem('scanHistory', scanHistory);
  }

  /**
   * Get the latest scan results
   */
  async getLatestScanResults() {
    return await localforage.getItem('latestScan');
  }

  /**
   * Get scan history
   */
  async getScanHistory() {
    return await localforage.getItem('scanHistory') || [];
  }

  /**
   * Create batches of zombies for unfollowing
   * Prioritizes burned zombies (deleted accounts) first
   */
  createZombieBatches(zombies) {
    const allZombies = [
      ...zombies.burned || [],  // Deleted accounts first (highest priority)
      ...zombies.ancient,
      ...zombies.rotting,
      ...zombies.fresh
    ];
    
    // Extract just the pubkeys for batching
    const pubkeys = allZombies.map(zombie => 
      typeof zombie === 'string' ? zombie : zombie.pubkey
    );
    
    const batches = [];
    for (let i = 0; i < pubkeys.length; i += this.batchSize) {
      batches.push(pubkeys.slice(i, i + this.batchSize));
    }
    
    return batches;
  }

  /**
   * Unfollow a batch of zombies
   */
  async unfollowZombieBatch(batch) {
    try {
      const result = await nostrService.createUnfollowEvent(batch);
      
      // Record the purge
      await this.recordZombiePurge(batch);
      
      return result;
    } catch (error) {
      console.error('Failed to unfollow zombie batch:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Record a zombie purge for statistics
   */
  async recordZombiePurge(batch) {
    // Ensure we're only storing serializable pubkey strings
    const cleanPubkeys = batch.map(item => {
      if (typeof item === 'string') {
        return item;
      } else if (item && item.pubkey) {
        return item.pubkey;
      } else {
        console.warn('Invalid zombie batch item:', item);
        return null;
      }
    }).filter(pubkey => pubkey !== null);

    const purgeRecord = {
      timestamp: Date.now(),
      count: cleanPubkeys.length,
      pubkeys: cleanPubkeys
    };
    
    console.log('Recording zombie purge:', purgeRecord);
    
    try {
      // Get existing purge history
      let purgeHistory = await localforage.getItem('purgeHistory') || [];
      purgeHistory.push(purgeRecord);
      
      await localforage.setItem('purgeHistory', purgeHistory);
      console.log('Zombie purge recorded successfully');
    } catch (error) {
      console.error('Failed to record zombie purge:', error);
      throw error;
    }
  }

  /**
   * Get purge history
   */
  async getPurgeHistory() {
    return await localforage.getItem('purgeHistory') || [];
  }

  /**
   * Calculate statistics about zombie hunting
   */
  async getZombieStatistics() {
    const scanHistory = await this.getScanHistory();
    const purgeHistory = await this.getPurgeHistory();
    
    // Calculate total zombies purged
    const totalPurged = purgeHistory.reduce((total, record) => total + record.count, 0);
    
    // Get latest scan if available
    const latestScan = await this.getLatestScanResults();
    
    // Calculate percentages if we have a latest scan
    let percentages = null;
    if (latestScan) {
      const { active, burned, fresh, rotting, ancient } = latestScan.data;
      const burnedLength = burned?.length || 0;
      const total = active.length + burnedLength + fresh.length + rotting.length + ancient.length;
      
      percentages = {
        active: (active.length / total) * 100,
        burned: (burnedLength / total) * 100,
        fresh: (fresh.length / total) * 100,
        rotting: (rotting.length / total) * 100,
        ancient: (ancient.length / total) * 100
      };
    }
    
    // Estimate bandwidth savings (very rough estimate)
    // Assume each zombie entry in a contact list is ~100 bytes
    const estimatedBandwidthSaved = totalPurged * 100; // in bytes
    
    return {
      totalScans: scanHistory.length,
      lastScanDate: scanHistory.length > 0 ? scanHistory[scanHistory.length - 1].timestamp : null,
      totalPurged,
      purgeEvents: purgeHistory.length,
      percentages,
      estimatedBandwidthSaved
    };
  }
}

// Create singleton instance
const zombieService = new ZombieService();
export default zombieService;