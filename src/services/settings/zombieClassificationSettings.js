/**
 * Zombie Classification Settings Service
 *
 * Manages zombie classification thresholds with relay sync support.
 * Stores settings both locally (localStorage) and on Nostr relays (NIP-78).
 */

import relayStorage from '../relayStorage';
import syncManager from '../syncManager';

class ZombieClassificationSettings {
  constructor() {
    this.dTag = 'zombie-classification';
    this.storageKey = 'zombie_classification_settings';

    // Default settings
    this.defaults = {
      fresh: 90,    // Days inactive for "fresh" zombie
      rotting: 180, // Days inactive for "rotting" zombie
      ancient: 365  // Days inactive for "ancient" zombie
    };

    // Current settings
    this.settings = { ...this.defaults };

    // Load from localStorage on init
    this.loadFromLocalStorage();

    // Register with sync manager
    syncManager.registerService('zombieClassification', this);
  }

  /**
   * Get current settings
   * @returns {Object} Current zombie classification settings
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
      // Validate and apply settings
      if (newSettings.fresh !== undefined) {
        this.settings.fresh = Math.max(1, Math.min(365, newSettings.fresh));
      }
      if (newSettings.rotting !== undefined) {
        this.settings.rotting = Math.max(1, Math.min(365, newSettings.rotting));
      }
      if (newSettings.ancient !== undefined) {
        this.settings.ancient = Math.max(1, Math.min(1000, newSettings.ancient));
      }

      // Save to localStorage
      this.saveToLocalStorage();

      // Publish to relay if requested
      if (publish) {
        await this.publishToRelay();
      }

      console.log('[ZombieClassificationSettings] Settings updated:', this.settings);
      return true;
    } catch (error) {
      console.error('[ZombieClassificationSettings] Failed to update settings:', error);
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

    console.log('[ZombieClassificationSettings] Reset to defaults');
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
        console.log('[ZombieClassificationSettings] Loaded from localStorage:', this.settings);
      }
    } catch (error) {
      console.warn('[ZombieClassificationSettings] Failed to load from localStorage:', error);
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
      console.log('[ZombieClassificationSettings] Saved to localStorage');
    } catch (error) {
      console.error('[ZombieClassificationSettings] Failed to save to localStorage:', error);
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
      console.log('[ZombieClassificationSettings] Published to relay:', eventId);
      return eventId;
    } catch (error) {
      console.error('[ZombieClassificationSettings] Failed to publish to relay:', error);
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
        console.log('[ZombieClassificationSettings] Fetched from relay:', data);

        // Compare timestamps to determine which is newer
        const localTimestamp = this.getLocalTimestamp();
        const relayTimestamp = data.timestamp || 0;

        if (relayTimestamp > localTimestamp) {
          // Relay data is newer, update local settings
          console.log('[ZombieClassificationSettings] Relay data is newer, updating local');
          this.settings = {
            ...this.defaults,
            ...data.settings
          };
          this.saveToLocalStorage();
          this.setLocalTimestamp(relayTimestamp);
        } else if (localTimestamp > relayTimestamp) {
          // Local data is newer, publish to relay
          console.log('[ZombieClassificationSettings] Local data is newer, publishing to relay');
          await this.publishToRelay();
        } else {
          console.log('[ZombieClassificationSettings] Data is in sync');
        }

        return true;
      } else {
        // No data on relay, publish current settings
        console.log('[ZombieClassificationSettings] No data on relay, publishing current settings');
        await this.publishToRelay();
        return true;
      }
    } catch (error) {
      console.error('[ZombieClassificationSettings] Sync failed:', error);
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
      console.log('[ZombieClassificationSettings] Deleted from relay:', eventId);
      return eventId;
    } catch (error) {
      console.error('[ZombieClassificationSettings] Failed to delete from relay:', error);
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
      console.error('[ZombieClassificationSettings] Failed to set timestamp:', error);
    }
  }
}

// Export singleton instance
export default new ZombieClassificationSettings();
