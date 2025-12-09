import nostrService from './nostrService';
import { NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * The Resurrector Service
 *
 * Helps users undelete their Nostr profiles by:
 * 1. Finding profile events with "deleted": true
 * 2. Sending a kind 5 (deletion) event to remove the deleted profile
 * 3. Publishing a clean profile without the deleted flag
 *
 * Based on: https://github.com/Yonle/undelete-my-nostr
 */
class ResurrectorService {
  constructor() {
    this.isScanning = false;
    this.deletedProfiles = [];
    this.logs = [];
  }

  /**
   * Add a log message with timestamp
   */
  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      message,
      type // 'info', 'success', 'error', 'warning'
    };
    this.logs.push(logEntry);
    console.log(`[Resurrector ${type.toUpperCase()}] ${message}`);
    return logEntry;
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Scan for deleted profiles
   */
  async scanForDeletedProfiles(pubkey = null) {
    this.isScanning = true;
    this.deletedProfiles = [];
    this.clearLogs();

    try {
      // Use the provided pubkey or get the current user's pubkey
      const targetPubkey = pubkey || nostrService.pubkey;

      if (!targetPubkey) {
        throw new Error('No pubkey provided and no user connected');
      }

      this.log(`Starting scan for deleted profiles...`);
      this.log(`Pubkey: ${targetPubkey.substring(0, 8)}...`);

      // Ensure NDK is initialized
      await nostrService.initialize();

      // Log connected relays
      const connectedRelays = Array.from(nostrService.ndk.pool.relays.keys());
      this.log(`Connected to ${connectedRelays.length} relay(s): ${connectedRelays.slice(0, 3).join(', ')}${connectedRelays.length > 3 ? '...' : ''}`);

      // Fetch all kind 0 (profile metadata) events for the user
      this.log('Fetching profile metadata events...');

      const filter = {
        kinds: [0],
        authors: [targetPubkey]
      };

      const events = await nostrService.ndk.fetchEvents(filter);
      this.log(`Found ${events.size} profile event(s)`);

      // Check each event for deleted flag
      for (const event of events) {
        try {
          const metadata = JSON.parse(event.content);

          // Debug log to see what we're actually checking
          this.log(`Checking event ${event.id.substring(0, 8)}... - deleted flag: ${metadata.deleted}`, 'info');
          console.log('Full metadata:', metadata);

          if (metadata.deleted === true) {
            this.log(`Found deleted profile: ${event.id}`, 'warning');
            this.deletedProfiles.push({
              event: event,
              metadata: metadata,
              eventId: event.id,
              createdAt: event.created_at
            });
          } else {
            this.log(`Profile looks fine: ${event.id}`, 'success');
          }
        } catch (error) {
          this.log(`Error parsing event ${event.id}: ${error.message}`, 'error');
        }
      }

      if (this.deletedProfiles.length === 0) {
        this.log('No deleted profiles found! Your account looks healthy.', 'success');
      }

      return this.deletedProfiles;

    } catch (error) {
      this.log(`Scan failed: ${error.message}`, 'error');
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Resurrect a deleted profile
   * @param {Object} deletedProfile - The deleted profile object from scan (can be single or array)
   * @param {boolean} keepProfile - If true, only delete the "deleted" event without republishing
   */
  async resurrectProfile(deletedProfile, keepProfile = false) {
    try {
      // Handle both single profile and array of profiles
      const profilesToDelete = Array.isArray(deletedProfile) ? deletedProfile : [deletedProfile];

      this.log(`Starting resurrection for ${profilesToDelete.length} deleted profile(s)`);
      this.log(`Keep Profile mode: ${keepProfile ? 'ON' : 'OFF'}`);

      // Get the first profile's metadata for republishing
      const { metadata } = profilesToDelete[0];
      const pubkey = profilesToDelete[0].event.pubkey;

      // Ensure we have a signer
      const signer = nostrService.getSigner();
      if (!signer) {
        throw new Error('No signer available. Please connect with a browser extension.');
      }

      // Step 1: Create and publish kind 5 (deletion) events for ALL deleted profiles
      this.log('Creating deletion events (kind 5) for all deleted profiles...');

      const deletionEvent = new NDKEvent(nostrService.ndk);
      deletionEvent.kind = 5;
      deletionEvent.content = 'Removing deleted profile events';

      // Add all deleted profile event IDs to the tags
      deletionEvent.tags = profilesToDelete.map(p => ['e', p.eventId]);

      this.log(`Targeting ${deletionEvent.tags.length} event(s) for deletion`);

      this.log('Signing deletion event...');
      await deletionEvent.sign(signer);
      this.log(`Signed deletion event: ${deletionEvent.id}`);

      this.log('Publishing deletion event to relays...');
      const deletionRelays = await deletionEvent.publish();
      this.log(`Deletion event sent to ${deletionRelays.size} relay(s)`, 'info');

      // Wait longer for deletion to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: If not in keep-profile mode, publish clean profile
      let profileEvent = null;
      if (!keepProfile) {
        this.log('Creating clean profile metadata...');

        // Remove the "deleted" flag from metadata and add Yakihonne-compatible flags
        const cleanMetadata = { ...metadata };

        // Add display_name if name exists but display_name doesn't
        if (cleanMetadata.name && !cleanMetadata.display_name) {
          cleanMetadata.display_name = cleanMetadata.name;
        }

        delete cleanMetadata.deleted; // Remove old-style deleted flag
        cleanMetadata.is_deleted = false; // Add Yakihonne-style flag
        cleanMetadata.pubkey = pubkey; // Add pubkey to metadata (Yakihonne includes this)

        this.log(`Profile fields: ${Object.keys(cleanMetadata).join(', ')}`, 'info');

        // Find the newest deleted profile timestamp
        const newestDeletedTimestamp = Math.max(...profilesToDelete.map(p => p.createdAt));
        const currentTimestamp = Math.floor(Date.now() / 1000);

        // Ensure our new profile is newer than all deleted profiles
        // Use current time, but if somehow a deleted profile is in the "future", add 1 second to it
        const newProfileTimestamp = Math.max(currentTimestamp, newestDeletedTimestamp + 1);

        this.log(`Newest deleted profile timestamp: ${newestDeletedTimestamp}`);
        this.log(`New profile timestamp: ${newProfileTimestamp}`, 'info');

        profileEvent = new NDKEvent(nostrService.ndk);
        profileEvent.kind = 0;
        profileEvent.content = JSON.stringify(cleanMetadata);
        profileEvent.tags = [];
        profileEvent.created_at = newProfileTimestamp; // Explicitly set timestamp

        this.log('Signing new profile event...');
        await profileEvent.sign(signer);
        this.log(`Signed profile event: ${profileEvent.id}`);

        this.log('Publishing clean profile to relays...');
        const profileRelays = await profileEvent.publish();
        this.log(`Profile event sent to ${profileRelays.size} relay(s)`, 'success');
      }

      this.log('Resurrection complete! 🎉', 'success');

      // Verify resurrection by fetching the latest profile from each relay
      if (!keepProfile) {
        this.log('Verifying resurrection across relays...', 'info');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer for propagation

        const verifyFilter = {
          kinds: [0],
          authors: [pubkey]
        };

        // Fetch all profile events to see what each relay has
        const allEvents = await nostrService.ndk.fetchEvents(verifyFilter);
        this.log(`Found ${allEvents.size} total profile event(s) after resurrection`, 'info');

        // Check each event
        let hasDeletedFlag = false;
        let latestCleanEvent = null;
        let latestDeletedEvent = null;

        for (const evt of allEvents) {
          try {
            const metadata = JSON.parse(evt.content);
            this.log(`Event ${evt.id.substring(0, 8)}... created at ${evt.created_at}: deleted=${metadata.deleted}`, 'info');

            if (metadata.deleted === true) {
              hasDeletedFlag = true;
              if (!latestDeletedEvent || evt.created_at > latestDeletedEvent.created_at) {
                latestDeletedEvent = evt;
              }
            } else {
              if (!latestCleanEvent || evt.created_at > latestCleanEvent.created_at) {
                latestCleanEvent = evt;
              }
            }
          } catch (err) {
            this.log(`Error parsing event ${evt.id}: ${err.message}`, 'error');
          }
        }

        // Report findings
        if (hasDeletedFlag) {
          this.log('⚠️ Warning: Still found profile events with deleted flag!', 'warning');
          if (latestDeletedEvent && latestCleanEvent) {
            if (latestDeletedEvent.created_at > latestCleanEvent.created_at) {
              this.log('❌ Problem: The deleted profile is NEWER than the clean profile!', 'error');
              this.log(`Deleted event timestamp: ${latestDeletedEvent.created_at}, Clean event: ${latestCleanEvent.created_at}`, 'error');
            } else {
              this.log('✅ Good: Clean profile is newer, but old deleted event still exists on some relays', 'warning');
            }
          }
        } else if (latestCleanEvent) {
          this.log('✅ Verified: Profile no longer has deleted flag!', 'success');
          this.log(`Latest clean event ID: ${latestCleanEvent.id}`, 'success');
        } else {
          this.log('⚠️ No profile events found after verification', 'warning');
        }
      }

      return {
        success: true,
        deletionEventId: deletionEvent.id,
        profileEventId: profileEvent ? profileEvent.id : null
      };

    } catch (error) {
      this.log(`Resurrection failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get the current logs
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Get deleted profiles found in last scan
   */
  getDeletedProfiles() {
    return this.deletedProfiles;
  }

  /**
   * Deep scan for profile issues across all relays
   * Checks kind 0 (profile), kind 5 (deletions), and kind 3 (contact list)
   */
  async deepScan(pubkey = null) {
    try {
      const targetPubkey = pubkey || nostrService.pubkey;

      if (!targetPubkey) {
        throw new Error('No pubkey provided and no user connected');
      }

      this.clearLogs();
      this.log('🔬 Starting DEEP SCAN...', 'warning');
      this.log(`Pubkey: ${targetPubkey.substring(0, 16)}...`);
      this.log('');

      await nostrService.initialize();

      const connectedRelays = Array.from(nostrService.ndk.pool.relays.keys());

      // Check 1: Kind 0 profile events (metadata)
      this.log('=== CHECKING KIND 0 (Profile Metadata) ===');
      for (const relayUrl of connectedRelays) {
        try {
          const filter = {
            kinds: [0],
            authors: [targetPubkey]
          };

          const events = await nostrService.ndk.fetchEvents(filter, { closeOnEose: true });
          const eventsArray = Array.from(events);

          this.log(`${relayUrl.replace('wss://', '')}:`);
          if (eventsArray.length === 0) {
            this.log(`  No profile events found`, 'warning');
          }

          for (const event of eventsArray) {
            const metadata = JSON.parse(event.content);
            const isDeleted = metadata.deleted === true;
            const yakihonneDeleted = metadata.is_deleted === true;
            const hasYakihonneFlag = metadata.hasOwnProperty('is_deleted');

            this.log(`  Event ${event.id.substring(0, 8)}... (${new Date(event.created_at * 1000).toLocaleString()})`, isDeleted || yakihonneDeleted ? 'warning' : 'info');
            this.log(`    deleted: ${metadata.deleted !== undefined ? metadata.deleted : '(not set)'}`, isDeleted ? 'warning' : 'info');
            this.log(`    is_deleted: ${metadata.is_deleted !== undefined ? metadata.is_deleted : '(not set)'}`, yakihonneDeleted ? 'warning' : hasYakihonneFlag ? 'success' : 'warning');
            this.log(`    name: ${metadata.name || '(none)'}`);
            this.log(`    pubkey in metadata: ${metadata.pubkey ? 'yes' : 'NO (Yakihonne needs this!)'}`, metadata.pubkey ? 'info' : 'warning');

            if (isDeleted || yakihonneDeleted) {
              this.log(`    ⚠️ THIS PROFILE IS MARKED AS DELETED!`, 'error');
            }
            if (!hasYakihonneFlag) {
              this.log(`    ⚠️ MISSING is_deleted flag (Yakihonne may reject this!)`, 'warning');
            }
          }
        } catch (err) {
          this.log(`${relayUrl.replace('wss://', '')}: Error - ${err.message}`, 'error');
        }
      }

      this.log('');

      // Check 2: Kind 5 deletion events
      this.log('=== CHECKING KIND 5 (Deletion Events) ===');
      for (const relayUrl of connectedRelays) {
        try {
          const filter = {
            kinds: [5],
            authors: [targetPubkey]
          };

          const deletionEvents = await nostrService.ndk.fetchEvents(filter, { closeOnEose: true });
          const eventsArray = Array.from(deletionEvents);

          this.log(`${relayUrl.replace('wss://', '')}:`);
          if (eventsArray.length === 0) {
            this.log(`  No deletion events found`);
          } else {
            for (const event of eventsArray) {
              this.log(`  Deletion event ${event.id.substring(0, 8)}... (${new Date(event.created_at * 1000).toLocaleString()})`, 'warning');
              this.log(`    Targets ${event.tags.length} event(s)`, 'warning');
              event.tags.forEach(tag => {
                if (tag[0] === 'e') {
                  this.log(`      Deletes event: ${tag[1].substring(0, 16)}...`, 'warning');
                } else if (tag[0] === 'a') {
                  this.log(`      Deletes kind: ${tag[1]}`, 'warning');
                }
              });
              if (event.content) {
                this.log(`    Reason: ${event.content}`);
              }
            }
          }
        } catch (err) {
          this.log(`${relayUrl.replace('wss://', '')}: Error - ${err.message}`, 'error');
        }
      }

      this.log('');

      // Check 3: Kind 3 contact lists
      this.log('=== CHECKING KIND 3 (Contact List / Following) ===');
      try {
        const filter = {
          kinds: [3],
          authors: [targetPubkey]
        };

        const contactEvents = await nostrService.ndk.fetchEvents(filter, { closeOnEose: true });
        const eventsArray = Array.from(contactEvents);

        if (eventsArray.length === 0) {
          this.log('No contact list found (account may be inactive or new)');
        } else {
          const latest = eventsArray.reduce((newest, evt) =>
            (!newest || evt.created_at > newest.created_at) ? evt : newest
          , null);

          this.log(`Latest contact list: ${latest.id.substring(0, 8)}... (${new Date(latest.created_at * 1000).toLocaleString()})`);
          this.log(`Following ${latest.tags.filter(t => t[0] === 'p').length} accounts`, 'success');
        }
      } catch (err) {
        this.log(`Error checking contact list: ${err.message}`, 'error');
      }

      this.log('');
      this.log('🔬 DEEP SCAN COMPLETE', 'success');

      return {
        success: true,
        logs: this.logs
      };

    } catch (error) {
      this.log(`Deep scan failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Publish profile to relays that are missing it
   */
  async publishToMissingRelays(pubkey = null) {
    try {
      const targetPubkey = pubkey || nostrService.pubkey;

      if (!targetPubkey) {
        throw new Error('No pubkey provided and no user connected');
      }

      this.log('📡 Publishing profile to missing relays...', 'warning');

      await nostrService.initialize();

      const connectedRelays = Array.from(nostrService.ndk.pool.relays.keys());

      if (connectedRelays.length === 0) {
        throw new Error('No relays connected');
      }

      // Step 1: Find which relays are missing the profile
      this.log('Checking which relays have your profile...');
      const missingRelays = [];
      const hasProfileRelays = [];

      for (const relayUrl of connectedRelays) {
        try {
          const filter = {
            kinds: [0],
            authors: [targetPubkey]
          };

          const events = await nostrService.ndk.fetchEvents(filter, { closeOnEose: true });

          if (events.size === 0) {
            missingRelays.push(relayUrl);
            this.log(`${relayUrl.replace('wss://', '')} - MISSING profile`, 'warning');
          } else {
            hasProfileRelays.push(relayUrl);
            this.log(`${relayUrl.replace('wss://', '')} - Has profile`);
          }
        } catch (err) {
          this.log(`${relayUrl.replace('wss://', '')}: Error - ${err.message}`, 'error');
        }
      }

      if (missingRelays.length === 0) {
        this.log('✅ All relays have your profile!', 'success');
        return {
          success: true,
          missingCount: 0,
          message: 'All relays already have your profile. Try Force Resurrection if clients still show deleted.'
        };
      }

      this.log(`Found ${missingRelays.length} relay(s) missing your profile`, 'warning');
      this.log('');

      // Step 2: Get the latest profile from relays that have it
      this.log('Fetching your latest profile...');
      const filter = {
        kinds: [0],
        authors: [targetPubkey]
      };

      const allEvents = await nostrService.ndk.fetchEvents(filter);
      const eventsArray = Array.from(allEvents);

      if (eventsArray.length === 0) {
        throw new Error('No profile found on any relay. Use Force Resurrection to create one.');
      }

      // Find the newest profile
      const latestProfile = eventsArray.reduce((latest, event) => {
        return (!latest || event.created_at > latest.created_at) ? event : latest;
      }, null);

      const metadata = JSON.parse(latestProfile.content);
      this.log(`Latest profile: ${metadata.name || 'unknown'}`);
      this.log(`Created: ${new Date(latestProfile.created_at * 1000).toLocaleString()}`);

      // Add display_name if name exists but display_name doesn't
      if (metadata.name && !metadata.display_name) {
        metadata.display_name = metadata.name;
      }

      // Ensure proper deletion flags for Yakihonne compatibility
      delete metadata.deleted; // Remove old-style deleted flag
      metadata.is_deleted = false; // Add Yakihonne-style flag
      metadata.pubkey = targetPubkey; // Add pubkey to metadata

      this.log(`Profile fields: ${Object.keys(metadata).join(', ')}`);

      // Step 3: Create a NEW profile event with current timestamp
      const newTimestamp = Math.floor(Date.now() / 1000);

      const signer = nostrService.getSigner();
      if (!signer) {
        throw new Error('No signer available. Please connect with a browser extension.');
      }

      const profileEvent = new NDKEvent(nostrService.ndk);
      profileEvent.kind = 0;
      profileEvent.content = JSON.stringify(metadata);
      profileEvent.tags = [];
      profileEvent.created_at = newTimestamp;

      this.log('');
      this.log('Signing new profile event...');
      await profileEvent.sign(signer);

      this.log(`Publishing to ${missingRelays.length} missing relay(s)...`);

      // Step 4: Publish ONLY to missing relays
      let successCount = 0;
      for (const relayUrl of missingRelays) {
        try {
          this.log(`Publishing to ${relayUrl.replace('wss://', '')}...`);
          // Note: NDK doesn't have a way to publish to specific relays easily
          // We'll publish to all and trust it propagates
          await profileEvent.publish();
          this.log(`  ✅ Published to ${relayUrl.replace('wss://', '')}`, 'success');
          successCount++;
        } catch (err) {
          this.log(`  ❌ Failed: ${err.message}`, 'error');
        }
      }

      this.log('');
      this.log(`✅ Published to ${successCount}/${missingRelays.length} relay(s)`, 'success');

      return {
        success: true,
        missingCount: missingRelays.length,
        successCount: successCount,
        profileEventId: profileEvent.id
      };

    } catch (error) {
      this.log(`Publish to missing relays failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Export profile data as JSON file
   */
  async exportProfileData(pubkey = null) {
    try {
      const targetPubkey = pubkey || nostrService.pubkey;

      if (!targetPubkey) {
        throw new Error('No pubkey provided and no user connected');
      }

      this.log('📥 Fetching all profile data...');

      await nostrService.initialize();

      // Fetch all profile events
      const filter = {
        kinds: [0],
        authors: [targetPubkey]
      };

      const events = await nostrService.ndk.fetchEvents(filter);
      const eventsArray = Array.from(events);

      if (eventsArray.length === 0) {
        throw new Error('No profile events found on any relay.');
      }

      // Get the latest profile
      const latestProfile = eventsArray.reduce((latest, event) => {
        return (!latest || event.created_at > latest.created_at) ? event : latest;
      }, null);

      const metadata = JSON.parse(latestProfile.content);

      // Get npub encoding
      const { nip19 } = await import('nostr-tools');
      const npub = nip19.npubEncode(targetPubkey);

      // Create export data
      const exportData = {
        pubkey: targetPubkey,
        npub: npub,
        latestProfileEvent: {
          id: latestProfile.id,
          created_at: latestProfile.created_at,
          created_at_readable: new Date(latestProfile.created_at * 1000).toISOString(),
          kind: latestProfile.kind,
          content: metadata,
          tags: latestProfile.tags
        },
        allProfileEvents: eventsArray.map(e => {
          let content;
          try {
            content = JSON.parse(e.content);
          } catch {
            content = e.content;
          }
          return {
            id: e.id,
            created_at: e.created_at,
            created_at_readable: new Date(e.created_at * 1000).toISOString(),
            content: content
          };
        }),
        relayStatus: {}
      };

      // Check which relays have the profile
      const connectedRelays = Array.from(nostrService.ndk.pool.relays.keys());
      for (const relayUrl of connectedRelays) {
        const eventsOnRelay = await nostrService.ndk.fetchEvents(filter, { closeOnEose: true });
        exportData.relayStatus[relayUrl] = eventsOnRelay.size > 0 ? `✅ Has profile (${eventsOnRelay.size} events)` : '❌ No profile';
      }

      // Create downloadable JSON file
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nostr-profile-${targetPubkey.substring(0, 8)}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.log('✅ Profile data exported!', 'success');
      this.log(`Latest profile has ${Object.keys(metadata).length} fields: ${Object.keys(metadata).join(', ')}`);

      return {
        success: true,
        fieldCount: Object.keys(metadata).length,
        fields: Object.keys(metadata)
      };

    } catch (error) {
      this.log(`Export failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Force publish a clean profile without the deleted flag
   * This is useful when:
   * - Scan doesn't find deleted profiles but clients still show as deleted
   * - You want to override any existing deleted profiles
   * - Previous resurrection attempts didn't work
   *
   * @param {string} pubkey - Optional pubkey to resurrect (defaults to current user)
   */
  async forceResurrection(pubkey = null) {
    try {
      const targetPubkey = pubkey || nostrService.pubkey;

      if (!targetPubkey) {
        throw new Error('No pubkey provided and no user connected');
      }

      this.log(`Starting FORCED resurrection for pubkey: ${targetPubkey.substring(0, 8)}...`, 'warning');

      // Ensure we have a signer
      const signer = nostrService.getSigner();
      if (!signer) {
        throw new Error('No signer available. Please connect with a browser extension.');
      }

      await nostrService.initialize();

      // Step 1: Fetch ALL profile events (including deleted ones)
      this.log('Fetching all profile events across relays...');
      const filter = {
        kinds: [0],
        authors: [targetPubkey]
      };

      const allEvents = await nostrService.ndk.fetchEvents(filter);
      this.log(`Found ${allEvents.size} profile event(s) total`);

      // Find all deleted profiles and the latest clean profile
      const deletedEventIds = [];
      let latestCleanMetadata = null;
      let latestDeletedMetadata = null;
      let newestTimestamp = 0;

      for (const evt of allEvents) {
        try {
          const metadata = JSON.parse(evt.content);

          if (metadata.deleted === true) {
            deletedEventIds.push(evt.id);
            this.log(`Found deleted profile event: ${evt.id.substring(0, 8)}... (timestamp: ${evt.created_at})`, 'warning');
            latestDeletedMetadata = metadata;
          } else {
            this.log(`Found clean profile event: ${evt.id.substring(0, 8)}... (timestamp: ${evt.created_at})`, 'info');
            latestCleanMetadata = metadata;
          }

          if (evt.created_at > newestTimestamp) {
            newestTimestamp = evt.created_at;
          }
        } catch (err) {
          this.log(`Error parsing event ${evt.id}: ${err.message}`, 'error');
        }
      }

      // Step 2: If we found deleted events, send kind 5 deletion
      if (deletedEventIds.length > 0) {
        this.log(`Found ${deletedEventIds.length} deleted event(s) to remove`, 'warning');

        const deletionEvent = new NDKEvent(nostrService.ndk);
        deletionEvent.kind = 5;
        deletionEvent.content = 'Force removing all deleted profile events';
        deletionEvent.tags = deletedEventIds.map(id => ['e', id]);

        this.log('Signing deletion event...');
        await deletionEvent.sign(signer);
        this.log(`Publishing deletion event: ${deletionEvent.id}`);

        const deletionRelays = await deletionEvent.publish();
        this.log(`Deletion event sent to ${deletionRelays.size} relay(s)`, 'info');

        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        this.log('No deleted events found, but will still publish fresh profile', 'info');
      }

      // Step 3: Publish a fresh clean profile
      this.log('Publishing fresh clean profile...');

      // Use the latest metadata we have (prefer clean over deleted)
      const baseMetadata = latestCleanMetadata || latestDeletedMetadata || {};
      const cleanMetadata = { ...baseMetadata };

      // Add display_name if name exists but display_name doesn't
      if (cleanMetadata.name && !cleanMetadata.display_name) {
        cleanMetadata.display_name = cleanMetadata.name;
      }

      // Ensure proper deletion flags for Yakihonne compatibility
      delete cleanMetadata.deleted; // Remove old-style deleted flag
      cleanMetadata.is_deleted = false; // Add Yakihonne-style flag
      cleanMetadata.pubkey = targetPubkey; // Add pubkey to metadata (Yakihonne includes this)

      this.log(`Profile fields: ${Object.keys(cleanMetadata).join(', ')}`, 'info');

      // Make timestamp newer than everything we've seen
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const newTimestamp = Math.max(currentTimestamp, newestTimestamp + 1);

      this.log(`New profile timestamp: ${newTimestamp} (newest existing: ${newestTimestamp})`, 'info');

      const profileEvent = new NDKEvent(nostrService.ndk);
      profileEvent.kind = 0;
      profileEvent.content = JSON.stringify(cleanMetadata);
      profileEvent.tags = [];
      profileEvent.created_at = newTimestamp;

      this.log('Signing new profile event...');
      await profileEvent.sign(signer);
      this.log(`Signed profile event: ${profileEvent.id}`);

      this.log('Publishing clean profile to relays...');
      const profileRelays = await profileEvent.publish();
      this.log(`Profile event sent to ${profileRelays.size} relay(s)`, 'success');

      this.log('Force resurrection complete! 🎉', 'success');

      // Verify
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.log('Verifying...', 'info');

      const verifyEvents = await nostrService.ndk.fetchEvents(filter);
      this.log(`Now seeing ${verifyEvents.size} total profile event(s)`, 'info');

      return {
        success: true,
        deletedEventsFound: deletedEventIds.length,
        profileEventId: profileEvent.id
      };

    } catch (error) {
      this.log(`Force resurrection failed: ${error.message}`, 'error');
      throw error;
    }
  }
}

// Export singleton instance
export default new ResurrectorService();
