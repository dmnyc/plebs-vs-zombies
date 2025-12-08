/**
 * Relay Storage Service - NIP-78 Implementation
 *
 * Handles persistent storage of application data on Nostr relays using NIP-78
 * (Application-specific Data). Supports both encrypted and non-encrypted data.
 *
 * NIP-78: https://github.com/nostr-protocol/nips/blob/master/78.md
 */

import { NDKEvent } from '@nostr-dev-kit/ndk';
import nostrService from './nostrService';

class RelayStorage {
  constructor() {
    this.APP_PREFIX = 'plebs-vs-zombies';
    this.KIND = 30078; // NIP-78 Application-specific Data
  }

  /**
   * Publish data to relays
   * @param {string} dTag - Identifier for this data type (e.g., "zombie-classification")
   * @param {Object} data - Data to store
   * @param {boolean} encrypted - Whether to encrypt the data
   * @param {string[]} relays - Optional relay list (uses nostrService relays if not provided)
   * @returns {Promise<string>} Event ID of published event
   */
  async publish(dTag, data, encrypted = false, relays = null) {
    try {
      await nostrService.initialize();

      const signer = nostrService.getSigner();
      if (!signer) {
        throw new Error('No signer available. Please connect with a browser extension.');
      }

      // Add timestamp to data
      const dataWithTimestamp = {
        ...data,
        timestamp: Math.floor(Date.now() / 1000)
      };

      // Create the event
      const event = new NDKEvent(nostrService.ndk);
      event.kind = this.KIND;
      event.tags = [['d', `${this.APP_PREFIX}:${dTag}`]];

      // Encrypt if requested
      if (encrypted) {
        const content = JSON.stringify(dataWithTimestamp);
        const pubkey = nostrService.pubkey;

        if (!pubkey) {
          throw new Error('No pubkey available for encryption');
        }

        // Use NIP-04 encryption (encrypt to self)
        if (window.nostr && window.nostr.nip04) {
          event.content = await window.nostr.nip04.encrypt(pubkey, content);
        } else {
          throw new Error('NIP-04 encryption not supported by signer');
        }
      } else {
        event.content = JSON.stringify(dataWithTimestamp);
      }

      // Sign the event
      await event.sign(signer);

      // Convert NDKEvent to plain object for publishing
      const signedEvent = event.rawEvent();

      // Publish using nostrService's publishEventToRelays method
      const targetRelays = relays || this._getPublishRelays();

      // Temporarily set publish relays for this operation
      const originalRelays = nostrService.relays;
      nostrService.relays = targetRelays;

      const publishResults = await nostrService.publishEventToRelays(signedEvent);

      // Restore original relays
      nostrService.relays = originalRelays;

      console.log(`[RelayStorage] Published ${dTag} to ${publishResults.successful}/${publishResults.total} relay(s)`, {
        eventId: event.id,
        encrypted
      });

      if (publishResults.successful === 0) {
        throw new Error('Failed to publish to any relays');
      }

      return event.id;
    } catch (error) {
      console.error(`[RelayStorage] Failed to publish ${dTag}:`, error);
      throw error;
    }
  }

  /**
   * Fetch data from relays
   * @param {string} dTag - Identifier for this data type
   * @param {boolean} encrypted - Whether the data is encrypted
   * @param {string} pubkey - Optional pubkey (uses nostrService.pubkey if not provided)
   * @param {string[]} relays - Optional relay list
   * @returns {Promise<Object|null>} Decrypted/parsed data or null if not found
   */
  async fetch(dTag, encrypted = false, pubkey = null, relays = null) {
    try {
      await nostrService.initialize();

      const targetPubkey = pubkey || nostrService.pubkey;
      if (!targetPubkey) {
        throw new Error('No pubkey available');
      }

      const targetRelays = relays || this._getFetchRelays();

      // Fetch the event
      const filter = {
        kinds: [this.KIND],
        authors: [targetPubkey],
        '#d': [`${this.APP_PREFIX}:${dTag}`]
      };

      const events = await nostrService.ndk.fetchEvents(filter, { relays: targetRelays });

      if (!events || events.size === 0) {
        console.log(`[RelayStorage] No data found for ${dTag}`);
        return null;
      }

      // Get the most recent event (highest created_at)
      const latestEvent = Array.from(events).reduce((latest, event) => {
        return (!latest || event.created_at > latest.created_at) ? event : latest;
      }, null);

      // Decrypt if needed
      let content = latestEvent.content;
      if (encrypted) {
        if (window.nostr && window.nostr.nip04) {
          content = await window.nostr.nip04.decrypt(targetPubkey, content);
        } else {
          throw new Error('NIP-04 decryption not supported by signer');
        }
      }

      const data = JSON.parse(content);

      console.log(`[RelayStorage] Fetched ${dTag}`, {
        eventId: latestEvent.id,
        timestamp: data.timestamp,
        encrypted
      });

      return data;
    } catch (error) {
      console.error(`[RelayStorage] Failed to fetch ${dTag}:`, error);
      throw error;
    }
  }

  /**
   * Delete data from relays (publish kind 5 deletion event)
   * @param {string} dTag - Identifier for this data type
   * @param {string[]} relays - Optional relay list
   * @returns {Promise<string>} Event ID of deletion event
   */
  async delete(dTag, relays = null) {
    try {
      await nostrService.initialize();

      const signer = nostrService.getSigner();
      if (!signer) {
        throw new Error('No signer available');
      }

      // Find the event to delete
      const pubkey = nostrService.pubkey;
      const filter = {
        kinds: [this.KIND],
        authors: [pubkey],
        '#d': [`${this.APP_PREFIX}:${dTag}`]
      };

      const events = await nostrService.ndk.fetchEvents(filter);

      if (!events || events.size === 0) {
        console.log(`[RelayStorage] No data to delete for ${dTag}`);
        return null;
      }

      // Create deletion event (kind 5)
      const deletionEvent = new NDKEvent(nostrService.ndk);
      deletionEvent.kind = 5;
      deletionEvent.content = `Deleting ${this.APP_PREFIX}:${dTag}`;
      deletionEvent.tags = Array.from(events).map(event => ['e', event.id]);

      await deletionEvent.sign(signer);

      // Convert NDKEvent to plain object for publishing
      const signedEvent = deletionEvent.rawEvent();

      // Publish using nostrService's publishEventToRelays method
      const targetRelays = relays || this._getPublishRelays();

      // Temporarily set publish relays for this operation
      const originalRelays = nostrService.relays;
      nostrService.relays = targetRelays;

      const publishResults = await nostrService.publishEventToRelays(signedEvent);

      // Restore original relays
      nostrService.relays = originalRelays;

      console.log(`[RelayStorage] Deleted ${dTag}`, {
        deletionEventId: deletionEvent.id,
        deletedEvents: deletionEvent.tags.length,
        publishedTo: `${publishResults.successful}/${publishResults.total} relays`
      });

      return deletionEvent.id;
    } catch (error) {
      console.error(`[RelayStorage] Failed to delete ${dTag}:`, error);
      throw error;
    }
  }

  /**
   * List all app-specific data types stored for the user
   * @param {string} pubkey - Optional pubkey
   * @param {string[]} relays - Optional relay list
   * @returns {Promise<string[]>} Array of d-tag identifiers
   */
  async listDataTypes(pubkey = null, relays = null) {
    try {
      await nostrService.initialize();

      const targetPubkey = pubkey || nostrService.pubkey;
      if (!targetPubkey) {
        throw new Error('No pubkey available');
      }

      const targetRelays = relays || this._getFetchRelays();

      const filter = {
        kinds: [this.KIND],
        authors: [targetPubkey]
      };

      const events = await nostrService.ndk.fetchEvents(filter, { relays: targetRelays });

      // Extract unique d-tags that match our app prefix
      const dTags = new Set();
      for (const event of events) {
        const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
        if (dTag && dTag.startsWith(this.APP_PREFIX)) {
          // Remove prefix for cleaner output
          dTags.add(dTag.replace(`${this.APP_PREFIX}:`, ''));
        }
      }

      return Array.from(dTags);
    } catch (error) {
      console.error('[RelayStorage] Failed to list data types:', error);
      throw error;
    }
  }

  /**
   * Get relays to use for publishing
   * @private
   * @returns {string[]}
   */
  _getPublishRelays() {
    // Use user's NIP-65 write relays if available, otherwise use connected relays
    const nip65Relays = nostrService.userRelayList;
    if (nip65Relays) {
      const writeRelays = nostrService.getWriteRelays(nip65Relays);
      if (writeRelays && writeRelays.length > 0) {
        return writeRelays;
      }
    }

    // Fallback to connected relays
    const connectedRelays = Array.from(nostrService.ndk.pool.relays.keys());
    return connectedRelays.slice(0, 5); // Limit to 5 relays to avoid spam
  }

  /**
   * Get relays to use for fetching
   * @private
   * @returns {string[]}
   */
  _getFetchRelays() {
    // Use user's NIP-65 read relays if available, otherwise use connected relays
    const nip65Relays = nostrService.userRelayList;
    if (nip65Relays) {
      const readRelays = nostrService.getReadRelays(nip65Relays);
      if (readRelays && readRelays.length > 0) {
        return readRelays;
      }
    }

    // Fallback to all connected relays
    return Array.from(nostrService.ndk.pool.relays.keys());
  }
}

// Export singleton instance
export default new RelayStorage();
