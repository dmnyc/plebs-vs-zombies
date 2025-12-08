/**
 * Preferences Settings Service
 *
 * Manages general app preferences with relay sync support.
 * Stores settings both locally (localStorage) and on Nostr relays (NIP-78).
 */

import relayStorage from '../relayStorage';
import syncManager from '../syncManager';

class PreferencesSettings {
  constructor() {
    this.dTag = 'preferences';
    this.storageKey = 'app_preferences';

    // Default settings
    this.defaults = {
      theme: 'dark',
      hasCompletedOnboarding: false,
      showWelcomeModal: true,
      language: 'en',
      notifications: {
        enabled: true,
        scanComplete: true,
        syncComplete: false
      }
    };

    // Current settings
    this.settings = { ...this.defaults };

    // Load from localStorage on init
    this.loadFromLocalStorage();

    // Register with sync manager
    syncManager.registerService('preferences', this);
  }

  /**
   * Get current settings
   * @returns {Object} Current preferences
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Get a specific preference
   * @param {string} key - Preference key (supports dot notation)
   * @returns {*} Preference value
   */
  get(key) {
    const keys = key.split('.');
    let value = this.settings;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set a specific preference
   * @param {string} key - Preference key (supports dot notation)
   * @param {*} value - Preference value
   * @param {boolean} publish - Whether to publish to relay (default: true)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, publish = true) {
    try {
      const keys = key.split('.');
      let current = this.settings;

      // Navigate to the correct nested object
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!(k in current)) {
          current[k] = {};
        }
        current = current[k];
      }

      // Set the value
      current[keys[keys.length - 1]] = value;

      // Save to localStorage
      this.saveToLocalStorage();

      // Publish to relay if requested
      if (publish) {
        await this.publishToRelay();
      }

      console.log(`[PreferencesSettings] Set ${key}:`, value);
      return true;
    } catch (error) {
      console.error('[PreferencesSettings] Failed to set preference:', error);
      return false;
    }
  }

  /**
   * Update multiple settings
   * @param {Object} newSettings - New settings to apply
   * @param {boolean} publish - Whether to publish to relay (default: true)
   * @returns {Promise<boolean>} Success status
   */
  async updateSettings(newSettings, publish = true) {
    try {
      // Deep merge settings
      this.settings = this.deepMerge(this.settings, newSettings);

      // Save to localStorage
      this.saveToLocalStorage();

      // Publish to relay if requested
      if (publish) {
        await this.publishToRelay();
      }

      console.log('[PreferencesSettings] Settings updated:', this.settings);
      return true;
    } catch (error) {
      console.error('[PreferencesSettings] Failed to update settings:', error);
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

    console.log('[PreferencesSettings] Reset to defaults');
    return true;
  }

  /**
   * Deep merge two objects
   * @private
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const output = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }

    return output;
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
        this.settings = this.deepMerge(this.defaults, parsed);
        console.log('[PreferencesSettings] Loaded from localStorage:', this.settings);
      }
    } catch (error) {
      console.warn('[PreferencesSettings] Failed to load from localStorage:', error);
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
      console.log('[PreferencesSettings] Saved to localStorage');
    } catch (error) {
      console.error('[PreferencesSettings] Failed to save to localStorage:', error);
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
        preferences: this.settings
      };

      const eventId = await relayStorage.publish(this.dTag, data, false);
      console.log('[PreferencesSettings] Published to relay:', eventId);
      return eventId;
    } catch (error) {
      console.error('[PreferencesSettings] Failed to publish to relay:', error);
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

      if (data && data.preferences) {
        console.log('[PreferencesSettings] Fetched from relay:', data);

        // Compare timestamps to determine which is newer
        const localTimestamp = this.getLocalTimestamp();
        const relayTimestamp = data.timestamp || 0;

        if (relayTimestamp > localTimestamp) {
          // Relay data is newer, update local settings
          console.log('[PreferencesSettings] Relay data is newer, updating local');
          this.settings = this.deepMerge(this.defaults, data.preferences);
          this.saveToLocalStorage();
          this.setLocalTimestamp(relayTimestamp);
        } else if (localTimestamp > relayTimestamp) {
          // Local data is newer, publish to relay
          console.log('[PreferencesSettings] Local data is newer, publishing to relay');
          await this.publishToRelay();
        } else {
          console.log('[PreferencesSettings] Data is in sync');
        }

        return true;
      } else {
        // No data on relay, publish current settings
        console.log('[PreferencesSettings] No data on relay, publishing current settings');
        await this.publishToRelay();
        return true;
      }
    } catch (error) {
      console.error('[PreferencesSettings] Sync failed:', error);
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
      console.log('[PreferencesSettings] Deleted from relay:', eventId);
      return eventId;
    } catch (error) {
      console.error('[PreferencesSettings] Failed to delete from relay:', error);
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
      console.error('[PreferencesSettings] Failed to set timestamp:', error);
    }
  }
}

// Export singleton instance
export default new PreferencesSettings();
