/**
 * Scan Settings Service
 *
 * Manages scan-related settings with relay sync support.
 * Stores settings both locally (localStorage) and on Nostr relays (NIP-78).
 */

import relayStorage from '../relayStorage';
import syncManager from '../syncManager';

class ScanSettings {
  constructor() {
    this.dTag = 'scan-settings';
    this.storageKey = 'scan_settings';

    // Default settings
    this.defaults = {
      autoBackupOnScan: true,
      useEnhancedScanning: false,
      maxFollowsToScan: 1000,
      showOnlyZombies: false,
      sortBy: 'score' // 'score' | 'name' | 'date'
    };

    // Current settings
    this.settings = { ...this.defaults };

    // Load from localStorage on init
    this.loadFromLocalStorage();

    // Register with sync manager
    syncManager.registerService('scanSettings', this);
  }

  /**
   * Get current settings
   * @returns {Object} Current scan settings
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
      if (newSettings.autoBackupOnScan !== undefined) {
        this.settings.autoBackupOnScan = Boolean(newSettings.autoBackupOnScan);
      }
      if (newSettings.useEnhancedScanning !== undefined) {
        this.settings.useEnhancedScanning = Boolean(newSettings.useEnhancedScanning);
      }
      if (newSettings.maxFollowsToScan !== undefined) {
        this.settings.maxFollowsToScan = Math.max(1, Math.min(10000, newSettings.maxFollowsToScan));
      }
      if (newSettings.showOnlyZombies !== undefined) {
        this.settings.showOnlyZombies = Boolean(newSettings.showOnlyZombies);
      }
      if (newSettings.sortBy !== undefined && ['score', 'name', 'date'].includes(newSettings.sortBy)) {
        this.settings.sortBy = newSettings.sortBy;
      }

      // Save to localStorage
      this.saveToLocalStorage();

      // Publish to relay if requested
      if (publish) {
        await this.publishToRelay();
      }

      console.log('[ScanSettings] Settings updated:', this.settings);
      return true;
    } catch (error) {
      console.error('[ScanSettings] Failed to update settings:', error);
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

    console.log('[ScanSettings] Reset to defaults');
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
        console.log('[ScanSettings] Loaded from localStorage:', this.settings);
      }

      // Also load legacy settings from their original keys
      const autoBackup = localStorage.getItem('autoBackupOnScan');
      if (autoBackup !== null) {
        this.settings.autoBackupOnScan = JSON.parse(autoBackup);
      }

      const enhancedScanning = localStorage.getItem('useEnhancedScanning');
      if (enhancedScanning !== null) {
        this.settings.useEnhancedScanning = JSON.parse(enhancedScanning);
      }
    } catch (error) {
      console.warn('[ScanSettings] Failed to load from localStorage:', error);
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

      // Also save to legacy keys for backwards compatibility
      localStorage.setItem('autoBackupOnScan', JSON.stringify(this.settings.autoBackupOnScan));
      localStorage.setItem('useEnhancedScanning', JSON.stringify(this.settings.useEnhancedScanning));

      console.log('[ScanSettings] Saved to localStorage');
    } catch (error) {
      console.error('[ScanSettings] Failed to save to localStorage:', error);
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
      console.log('[ScanSettings] Published to relay:', eventId);
      return eventId;
    } catch (error) {
      console.error('[ScanSettings] Failed to publish to relay:', error);
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
        console.log('[ScanSettings] Fetched from relay:', data);

        // Compare timestamps to determine which is newer
        const localTimestamp = this.getLocalTimestamp();
        const relayTimestamp = data.timestamp || 0;

        if (relayTimestamp > localTimestamp) {
          // Relay data is newer, update local settings
          console.log('[ScanSettings] Relay data is newer, updating local');
          this.settings = {
            ...this.defaults,
            ...data.settings
          };
          this.saveToLocalStorage();
          this.setLocalTimestamp(relayTimestamp);
        } else if (localTimestamp > relayTimestamp) {
          // Local data is newer, publish to relay
          console.log('[ScanSettings] Local data is newer, publishing to relay');
          await this.publishToRelay();
        } else {
          console.log('[ScanSettings] Data is in sync');
        }

        return true;
      } else {
        // No data on relay, publish current settings
        console.log('[ScanSettings] No data on relay, publishing current settings');
        await this.publishToRelay();
        return true;
      }
    } catch (error) {
      console.error('[ScanSettings] Sync failed:', error);
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
      console.log('[ScanSettings] Deleted from relay:', eventId);
      return eventId;
    } catch (error) {
      console.error('[ScanSettings] Failed to delete from relay:', error);
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
      console.error('[ScanSettings] Failed to set timestamp:', error);
    }
  }
}

// Export singleton instance
export default new ScanSettings();
