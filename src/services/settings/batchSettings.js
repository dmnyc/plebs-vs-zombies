/**
 * Batch Settings Service
 *
 * Manages batch operation settings with relay sync support.
 * Stores settings both locally (localStorage) and on Nostr relays (NIP-78).
 */

import relayStorage from '../relayStorage';
import syncManager from '../syncManager';

class BatchSettings {
  constructor() {
    this.dTag = 'batch-settings';
    this.storageKey = 'batch_settings';

    // Default settings
    this.defaults = {
      batchSize: 30,
      delayBetweenBatches: 2000, // milliseconds
      autoConfirm: false,
      preserveImportantFollows: true
    };

    // Current settings
    this.settings = { ...this.defaults };

    // Load from localStorage on init
    this.loadFromLocalStorage();

    // Register with sync manager
    syncManager.registerService('batchSettings', this);
  }

  /**
   * Get current settings
   * @returns {Object} Current batch settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Update settings
   * @param {Object} newSettings - New settings to apply
   * @param {boolean} publish - Whether to publish to relay (default: true)
   * @returns {Promise<boolean>} Success status
   */
  async updateSettings(newSettings, publish = true) {
    try {
      // Apply settings with validation
      if (newSettings.batchSize !== undefined) {
        this.settings.batchSize = Math.max(5, Math.min(100, newSettings.batchSize));
      }
      if (newSettings.delayBetweenBatches !== undefined) {
        this.settings.delayBetweenBatches = Math.max(500, Math.min(10000, newSettings.delayBetweenBatches));
      }
      if (newSettings.autoConfirm !== undefined) {
        this.settings.autoConfirm = Boolean(newSettings.autoConfirm);
      }
      if (newSettings.preserveImportantFollows !== undefined) {
        this.settings.preserveImportantFollows = Boolean(newSettings.preserveImportantFollows);
      }

      // Save to localStorage
      this.saveToLocalStorage();

      // Publish to relay if requested
      if (publish) {
        await this.publishToRelay();
      }

      console.log('[BatchSettings] Settings updated:', this.settings);
      return true;
    } catch (error) {
      console.error('[BatchSettings] Failed to update settings:', error);
      return false;
    }
  }

  /**
   * Reset to defaults
   * @param {boolean} publish - Whether to publish to relay (default: true)
   * @returns {Promise<boolean>} Success status
   */
  async resetToDefaults(publish = true) {
    this.settings = { ...this.defaults };
    this.saveToLocalStorage();

    if (publish) {
      await this.publishToRelay();
    }

    console.log('[BatchSettings] Reset to defaults');
    return true;
  }

  /**
   * Load settings from localStorage
   * @private
   */
  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = {
          ...this.defaults,
          ...parsed
        };
        console.log('[BatchSettings] Loaded from localStorage:', this.settings);
      }
    } catch (error) {
      console.warn('[BatchSettings] Failed to load from localStorage:', error);
      this.settings = { ...this.defaults };
    }
  }

  /**
   * Save settings to localStorage
   * @private
   */
  saveToLocalStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      console.log('[BatchSettings] Saved to localStorage');
    } catch (error) {
      console.error('[BatchSettings] Failed to save to localStorage:', error);
    }
  }

  /**
   * Publish settings to relay (NIP-78)
   * @returns {Promise<string>} Event ID
   */
  async publishToRelay() {
    try {
      const data = {
        version: 1,
        settings: this.settings
      };

      const eventId = await relayStorage.publish(this.dTag, data, false);
      console.log('[BatchSettings] Published to relay:', eventId);
      return eventId;
    } catch (error) {
      console.error('[BatchSettings] Failed to publish to relay:', error);
      throw error;
    }
  }

  /**
   * Sync settings with relay (fetch and merge)
   * @returns {Promise<boolean>} Success status
   */
  async syncWithRelay() {
    try {
      const data = await relayStorage.fetch(this.dTag, false);

      if (data && data.settings) {
        console.log('[BatchSettings] Fetched from relay:', data);

        // Compare timestamps to determine which is newer
        const localTimestamp = this.getLocalTimestamp();
        const relayTimestamp = data.timestamp || 0;

        if (relayTimestamp > localTimestamp) {
          // Relay data is newer, update local settings
          console.log('[BatchSettings] Relay data is newer, updating local');
          this.settings = {
            ...this.defaults,
            ...data.settings
          };
          this.saveToLocalStorage();
          this.setLocalTimestamp(relayTimestamp);
        } else if (localTimestamp > relayTimestamp) {
          // Local data is newer, publish to relay
          console.log('[BatchSettings] Local data is newer, publishing to relay');
          await this.publishToRelay();
        } else {
          console.log('[BatchSettings] Data is in sync');
        }

        return true;
      } else {
        // No data on relay, publish current settings
        console.log('[BatchSettings] No data on relay, publishing current settings');
        await this.publishToRelay();
        return true;
      }
    } catch (error) {
      console.error('[BatchSettings] Sync failed:', error);
      return false;
    }
  }

  /**
   * Delete settings from relay
   * @returns {Promise<string>} Deletion event ID
   */
  async deleteFromRelay() {
    try {
      const eventId = await relayStorage.delete(this.dTag);
      console.log('[BatchSettings] Deleted from relay:', eventId);
      return eventId;
    } catch (error) {
      console.error('[BatchSettings] Failed to delete from relay:', error);
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
      const timestamp = localStorage.getItem(`${this.storageKey}_timestamp`);
      return timestamp ? parseInt(timestamp, 10) : 0;
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
      localStorage.setItem(`${this.storageKey}_timestamp`, timestamp.toString());
    } catch (error) {
      console.error('[BatchSettings] Failed to set timestamp:', error);
    }
  }
}

// Export singleton instance
export default new BatchSettings();
