/**
 * Relay Configuration Settings Service
 *
 * Manages relay configuration with relay sync support.
 * Stores settings both locally (localStorage) and on Nostr relays (NIP-78).
 */

import relayStorage from '../relayStorage';
import syncManager from '../syncManager';

class RelayConfigSettings {
  constructor() {
    this.dTag = 'relay-config';
    this.storageKey = 'relay_config_settings';

    // Default relays
    this.defaultRelays = [
      'wss://relay.damus.io',
      'wss://relay.nostr.band',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://nostr.wine'
    ];

    // Default settings
    this.defaults = {
      relays: [...this.defaultRelays],
      useNIP65: true, // Use NIP-65 relay list if available
      preferredRelays: [] // Preferred relays for this app specifically
    };

    // Current settings
    this.settings = { ...this.defaults };

    // Load from localStorage on init
    this.loadFromLocalStorage();

    // Register with sync manager
    syncManager.registerService('relayConfig', this);
  }

  /**
   * Get current settings
   * @returns {Object} Current relay config settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Get current relay list
   * @returns {string[]} Array of relay URLs
   */
  getRelays() {
    return [...this.settings.relays];
  }

  /**
   * Add a relay
   * @param {string} relayUrl - Relay URL to add
   * @param {boolean} publish - Whether to publish to relay (default: true)
   * @returns {Promise<boolean>} Success status
   */
  async addRelay(relayUrl, publish = true) {
    try {
      // Validate relay URL
      const url = new URL(relayUrl);
      if (!['wss:', 'ws:'].includes(url.protocol)) {
        throw new Error('Invalid relay protocol. Must be wss: or ws:');
      }

      // Add relay if not already present
      if (!this.settings.relays.includes(relayUrl)) {
        this.settings.relays.push(relayUrl);
        this.saveToLocalStorage();

        if (publish) {
          await this.publishToRelay();
        }

        console.log('[RelayConfigSettings] Added relay:', relayUrl);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[RelayConfigSettings] Failed to add relay:', error);
      throw error;
    }
  }

  /**
   * Remove a relay
   * @param {string} relayUrl - Relay URL to remove
   * @param {boolean} publish - Whether to publish to relay (default: true)
   * @returns {Promise<boolean>} Success status
   */
  async removeRelay(relayUrl, publish = true) {
    try {
      const index = this.settings.relays.indexOf(relayUrl);
      if (index > -1) {
        this.settings.relays.splice(index, 1);
        this.saveToLocalStorage();

        if (publish) {
          await this.publishToRelay();
        }

        console.log('[RelayConfigSettings] Removed relay:', relayUrl);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[RelayConfigSettings] Failed to remove relay:', error);
      return false;
    }
  }

  /**
   * Update settings
   * @param {Object} newSettings - New settings to apply
   * @param {boolean} publish - Whether to publish to relay (default: true)
   * @returns {Promise<boolean>} Success status
   */
  async updateSettings(newSettings, publish = true) {
    try {
      // Apply settings
      if (newSettings.relays !== undefined && Array.isArray(newSettings.relays)) {
        // Validate all relays
        for (const relayUrl of newSettings.relays) {
          const url = new URL(relayUrl);
          if (!['wss:', 'ws:'].includes(url.protocol)) {
            throw new Error(`Invalid relay protocol: ${relayUrl}`);
          }
        }
        this.settings.relays = [...newSettings.relays];
      }

      if (newSettings.useNIP65 !== undefined) {
        this.settings.useNIP65 = Boolean(newSettings.useNIP65);
      }

      if (newSettings.preferredRelays !== undefined && Array.isArray(newSettings.preferredRelays)) {
        this.settings.preferredRelays = [...newSettings.preferredRelays];
      }

      // Save to localStorage
      this.saveToLocalStorage();

      // Publish to relay if requested
      if (publish) {
        await this.publishToRelay();
      }

      console.log('[RelayConfigSettings] Settings updated:', this.settings);
      return true;
    } catch (error) {
      console.error('[RelayConfigSettings] Failed to update settings:', error);
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

    console.log('[RelayConfigSettings] Reset to defaults');
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
        console.log('[RelayConfigSettings] Loaded from localStorage:', this.settings);
      }
    } catch (error) {
      console.warn('[RelayConfigSettings] Failed to load from localStorage:', error);
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
      console.log('[RelayConfigSettings] Saved to localStorage');
    } catch (error) {
      console.error('[RelayConfigSettings] Failed to save to localStorage:', error);
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
        ...this.settings
      };

      const eventId = await relayStorage.publish(this.dTag, data, false);
      console.log('[RelayConfigSettings] Published to relay:', eventId);
      return eventId;
    } catch (error) {
      console.error('[RelayConfigSettings] Failed to publish to relay:', error);
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

      if (data && data.relays) {
        console.log('[RelayConfigSettings] Fetched from relay:', data);

        // Compare timestamps to determine which is newer
        const localTimestamp = this.getLocalTimestamp();
        const relayTimestamp = data.timestamp || 0;

        if (relayTimestamp > localTimestamp) {
          // Relay data is newer, update local settings
          console.log('[RelayConfigSettings] Relay data is newer, updating local');
          this.settings = {
            ...this.defaults,
            relays: data.relays || this.defaults.relays,
            useNIP65: data.useNIP65 !== undefined ? data.useNIP65 : this.defaults.useNIP65,
            preferredRelays: data.preferredRelays || this.defaults.preferredRelays
          };
          this.saveToLocalStorage();
          this.setLocalTimestamp(relayTimestamp);
        } else if (localTimestamp > relayTimestamp) {
          // Local data is newer, publish to relay
          console.log('[RelayConfigSettings] Local data is newer, publishing to relay');
          await this.publishToRelay();
        } else {
          console.log('[RelayConfigSettings] Data is in sync');
        }

        return true;
      } else {
        // No data on relay, publish current settings
        console.log('[RelayConfigSettings] No data on relay, publishing current settings');
        await this.publishToRelay();
        return true;
      }
    } catch (error) {
      console.error('[RelayConfigSettings] Sync failed:', error);
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
      console.log('[RelayConfigSettings] Deleted from relay:', eventId);
      return eventId;
    } catch (error) {
      console.error('[RelayConfigSettings] Failed to delete from relay:', error);
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
      console.error('[RelayConfigSettings] Failed to set timestamp:', error);
    }
  }
}

// Export singleton instance
export default new RelayConfigSettings();
