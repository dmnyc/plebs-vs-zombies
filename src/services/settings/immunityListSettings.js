/**
 * Immunity List Settings Service
 *
 * Manages the immunity list (whitelist) with encrypted relay sync support.
 * Stores settings both locally (localforage) and on Nostr relays (NIP-78 + NIP-04 encryption).
 */

import relayStorage from '../relayStorage';
import syncManager from '../syncManager';
import localforage from 'localforage';

// Configure localforage for immunity list
const immunityStorage = localforage.createInstance({
  name: 'plebs-vs-zombies',
  storeName: 'immunity_list'
});

class ImmunityListSettings {
  constructor() {
    this.dTag = 'immunity-list';

    // Current immunity list
    this.immunePubkeys = new Set();
    this.immunityReasons = {};

    // Load from localforage on init
    this.loadFromLocalStorage();

    // Register with sync manager
    syncManager.registerService('immunityList', this);
  }

  /**
   * Initialize the service (async)
   * @returns {Promise<void>}
   */
  async init() {
    await this.loadFromLocalStorage();
  }

  /**
   * Get all immune pubkeys
   * @returns {string[]} Array of pubkeys
   */
  getImmunePubkeys() {
    return Array.from(this.immunePubkeys);
  }

  /**
   * Get all immunity records with reasons
   * @returns {Array<Object>} Array of immunity records
   */
  getAllImmunityRecords() {
    return this.getImmunePubkeys().map(pubkey => ({
      pubkey,
      reason: this.immunityReasons[pubkey]?.reason || 'No reason provided',
      timestamp: this.immunityReasons[pubkey]?.timestamp || null,
      npub: null // Will be filled by the UI if needed
    }));
  }

  /**
   * Check if a pubkey has immunity
   * @param {string} pubkey - Pubkey to check
   * @returns {boolean} Whether pubkey has immunity
   */
  hasImmunity(pubkey) {
    return this.immunePubkeys.has(pubkey);
  }

  /**
   * Grant immunity to a pubkey
   * @param {string} pubkey - Pubkey to grant immunity
   * @param {string} reason - Reason for immunity
   * @param {boolean} publish - Whether to publish to relay (default: true)
   * @returns {Promise<boolean>} Success status
   */
  async grantImmunity(pubkey, reason = '', publish = true) {
    try {
      if (!pubkey) {
        throw new Error('Pubkey is required');
      }

      this.immunePubkeys.add(pubkey);
      this.immunityReasons[pubkey] = {
        reason,
        timestamp: Math.floor(Date.now() / 1000)
      };

      await this.saveToLocalStorage();

      if (publish) {
        await this.publishToRelay();
      }

      console.log('[ImmunityListSettings] Granted immunity to:', pubkey.substring(0, 8));
      return true;
    } catch (error) {
      console.error('[ImmunityListSettings] Failed to grant immunity:', error);
      return false;
    }
  }

  /**
   * Revoke immunity from a pubkey
   * @param {string} pubkey - Pubkey to revoke immunity
   * @param {boolean} publish - Whether to publish to relay (default: true)
   * @returns {Promise<boolean>} Success status
   */
  async revokeImmunity(pubkey, publish = true) {
    try {
      if (!pubkey) {
        throw new Error('Pubkey is required');
      }

      this.immunePubkeys.delete(pubkey);
      delete this.immunityReasons[pubkey];

      await this.saveToLocalStorage();

      if (publish) {
        await this.publishToRelay();
      }

      console.log('[ImmunityListSettings] Revoked immunity from:', pubkey.substring(0, 8));
      return true;
    } catch (error) {
      console.error('[ImmunityListSettings] Failed to revoke immunity:', error);
      return false;
    }
  }

  /**
   * Clear all immunity records
   * @param {boolean} publish - Whether to publish to relay (default: true)
   * @returns {Promise<boolean>} Success status
   */
  async clearAllImmunity(publish = true) {
    try {
      this.immunePubkeys.clear();
      this.immunityReasons = {};

      await this.saveToLocalStorage();

      if (publish) {
        await this.publishToRelay();
      }

      console.log('[ImmunityListSettings] Cleared all immunity records');
      return true;
    } catch (error) {
      console.error('[ImmunityListSettings] Failed to clear immunity records:', error);
      return false;
    }
  }

  /**
   * Import immunity list from array
   * @param {Array<Object>} records - Array of immunity records
   * @param {boolean} publish - Whether to publish to relay (default: true)
   * @returns {Promise<Object>} Import result
   */
  async importImmunityList(records, publish = true) {
    try {
      let imported = 0;

      for (const record of records) {
        if (record.pubkey) {
          this.immunePubkeys.add(record.pubkey);
          this.immunityReasons[record.pubkey] = {
            reason: record.reason || 'Imported',
            timestamp: record.timestamp || Math.floor(Date.now() / 1000)
          };
          imported++;
        }
      }

      await this.saveToLocalStorage();

      if (publish) {
        await this.publishToRelay();
      }

      console.log(`[ImmunityListSettings] Imported ${imported} immunity records`);
      return {
        success: true,
        imported
      };
    } catch (error) {
      console.error('[ImmunityListSettings] Failed to import immunity list:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load immunity list from localStorage
   * @private
   * @returns {Promise<void>}
   */
  async loadFromLocalStorage() {
    try {
      // Load pubkeys
      const immuneList = await immunityStorage.getItem('immunePubkeys') || [];
      this.immunePubkeys = new Set(immuneList);

      // Load reasons
      const reasons = await immunityStorage.getItem('immunityReasons') || {};
      this.immunityReasons = reasons;

      console.log(`[ImmunityListSettings] Loaded ${this.immunePubkeys.size} immunity records from localStorage`);
    } catch (error) {
      console.error('[ImmunityListSettings] Failed to load from localStorage:', error);
      this.immunePubkeys = new Set();
      this.immunityReasons = {};
    }
  }

  /**
   * Save immunity list to localStorage
   * @private
   * @returns {Promise<void>}
   */
  async saveToLocalStorage() {
    try {
      await immunityStorage.setItem('immunePubkeys', Array.from(this.immunePubkeys));
      await immunityStorage.setItem('immunityReasons', this.immunityReasons);
      console.log('[ImmunityListSettings] Saved to localStorage');
    } catch (error) {
      console.error('[ImmunityListSettings] Failed to save to localStorage:', error);
    }
  }

  /**
   * Publish immunity list to relay (NIP-78 with NIP-04 encryption)
   * @returns {Promise<string>} Event ID
   */
  async publishToRelay() {
    try {
      const immuneUsers = this.getAllImmunityRecords().map(record => ({
        pubkey: record.pubkey,
        reason: record.reason,
        addedAt: record.timestamp
      }));

      const data = {
        version: 1,
        immuneUsers
      };

      // Publish with encryption
      const eventId = await relayStorage.publish(this.dTag, data, true);
      console.log('[ImmunityListSettings] Published to relay (encrypted):', eventId);
      return eventId;
    } catch (error) {
      console.error('[ImmunityListSettings] Failed to publish to relay:', error);
      throw error;
    }
  }

  /**
   * Sync immunity list with relay (fetch and merge)
   * @returns {Promise<boolean>} Success status
   */
  async syncWithRelay() {
    try {
      const data = await relayStorage.fetch(this.dTag, true);

      if (data && data.immuneUsers) {
        console.log(`[ImmunityListSettings] Fetched ${data.immuneUsers.length} immunity records from relay`);

        // Compare timestamps to determine which is newer
        const localTimestamp = this.getLocalTimestamp();
        const relayTimestamp = data.timestamp || 0;

        if (relayTimestamp > localTimestamp) {
          // Relay data is newer, update local
          console.log('[ImmunityListSettings] Relay data is newer, updating local');

          this.immunePubkeys = new Set();
          this.immunityReasons = {};

          for (const user of data.immuneUsers) {
            if (user.pubkey) {
              this.immunePubkeys.add(user.pubkey);
              this.immunityReasons[user.pubkey] = {
                reason: user.reason || 'No reason provided',
                timestamp: user.addedAt || relayTimestamp
              };
            }
          }

          await this.saveToLocalStorage();
          this.setLocalTimestamp(relayTimestamp);
        } else if (localTimestamp > relayTimestamp) {
          // Local data is newer, publish to relay
          console.log('[ImmunityListSettings] Local data is newer, publishing to relay');
          await this.publishToRelay();
        } else {
          console.log('[ImmunityListSettings] Data is in sync');
        }

        return true;
      } else {
        // No data on relay, publish current list
        console.log('[ImmunityListSettings] No data on relay, publishing current list');
        await this.publishToRelay();
        return true;
      }
    } catch (error) {
      console.error('[ImmunityListSettings] Sync failed:', error);
      return false;
    }
  }

  /**
   * Delete immunity list from relay
   * @returns {Promise<string>} Deletion event ID
   */
  async deleteFromRelay() {
    try {
      const eventId = await relayStorage.delete(this.dTag);
      console.log('[ImmunityListSettings] Deleted from relay:', eventId);
      return eventId;
    } catch (error) {
      console.error('[ImmunityListSettings] Failed to delete from relay:', error);
      throw error;
    }
  }

  /**
   * Get local timestamp for sync comparison
   * @private
   * @returns {number} Timestamp in seconds
   */
  getLocalTimestamp() {
    try {
      const timestampStr = localStorage.getItem(`${this.dTag}_timestamp`);
      return timestampStr ? parseInt(timestampStr, 10) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Set local timestamp for sync comparison
   * @private
   * @param {number} timestamp - Timestamp in seconds
   */
  setLocalTimestamp(timestamp) {
    try {
      localStorage.setItem(`${this.dTag}_timestamp`, timestamp.toString());
    } catch (error) {
      console.error('[ImmunityListSettings] Failed to set timestamp:', error);
    }
  }
}

// Export singleton instance
export default new ImmunityListSettings();
