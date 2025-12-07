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
      } else {
        this.log(`Found ${this.deletedProfiles.length} deleted profile(s)`, 'warning');
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
