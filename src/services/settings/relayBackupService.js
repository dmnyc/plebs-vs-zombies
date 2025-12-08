/**
 * Relay Backup Service
 *
 * Manages encrypted backups on Nostr relays using NIP-78 + NIP-04.
 * Stores complete snapshots of all settings for recovery.
 * Automatically maintains the 3 most recent backups.
 */

import relayStorage from '../relayStorage';
import syncManager from '../syncManager';
import zombieClassificationSettings from './zombieClassificationSettings';
import scanSettings from './scanSettings';
import batchSettings from './batchSettings';
import relayConfigSettings from './relayConfigSettings';
import immunityListSettings from './immunityListSettings';
import preferencesSettings from './preferencesSettings';
import nostrService from '../nostrService';
import backupService from '../backupService';

class RelayBackupService {
  constructor() {
    this.dTagPrefix = 'backup';
    this.maxBackups = 3; // Keep only the 3 most recent backups

    // Don't register with sync manager - backups are manual/triggered
  }

  /**
   * Create a complete encrypted backup of all settings
   * @param {string} reason - Reason for backup ('manual' | 'auto' | 'pre-delete')
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Backup result
   */
  async createBackup(reason = 'manual', metadata = {}) {
    try {
      console.log(`[RelayBackupService] Creating ${reason} backup...`);

      // Collect all settings
      const settingsData = {
        zombieClassification: zombieClassificationSettings.getSettings(),
        scanSettings: scanSettings.getSettings(),
        batchSettings: batchSettings.getSettings(),
        relayConfig: relayConfigSettings.getSettings(),
        immunityList: {
          immunePubkeys: immunityListSettings.getImmunePubkeys(),
          immunityRecords: immunityListSettings.getAllImmunityRecords()
        },
        preferences: preferencesSettings.getSettings()
      };

      // Get current follow list
      let followListBackup = null;
      try {
        followListBackup = await nostrService.backupFollowList();
        console.log(`[RelayBackupService] Backed up follow list: ${followListBackup.followCount} follows`);
      } catch (error) {
        console.warn('[RelayBackupService] Failed to backup follow list:', error);
      }

      // Create backup structure
      const timestamp = Math.floor(Date.now() / 1000);
      const backup = {
        version: 1,
        timestamp,
        backupData: {
          settings: settingsData,
          followList: followListBackup
        },
        metadata: {
          deviceInfo: this.getDeviceInfo(),
          appVersion: this.getAppVersion(),
          backupReason: reason,
          followCount: followListBackup?.followCount || 0,
          ...metadata
        }
      };

      // Use timestamp-based d-tag for sorting
      const dTag = `${this.dTagPrefix}-${timestamp}`;

      // Publish encrypted backup to relay
      const eventId = await relayStorage.publish(dTag, backup, true);

      console.log(`[RelayBackupService] Created backup: ${dTag}, event: ${eventId}`);

      // Clean up old backups (keep only 3 most recent)
      await this.cleanupOldBackups();

      return {
        success: true,
        dTag,
        eventId,
        timestamp,
        followCount: followListBackup?.followCount || 0
      };
    } catch (error) {
      console.error('[RelayBackupService] Failed to create backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List all available backups from relay
   * @returns {Promise<Array>} List of backups
   */
  async listBackups() {
    try {
      // Get all data types from relay
      const allDataTypes = await relayStorage.listDataTypes();

      // Filter for backup d-tags
      const backupTags = allDataTypes
        .filter(tag => tag.startsWith(this.dTagPrefix))
        .sort()
        .reverse(); // Most recent first

      console.log(`[RelayBackupService] Found ${backupTags.length} backups on relay`);

      // Fetch metadata for each backup (without full data)
      const backups = [];
      for (const dTag of backupTags) {
        try {
          const backup = await relayStorage.fetch(dTag, true);
          if (backup) {
            // Extract timestamp from d-tag
            const timestamp = parseInt(dTag.split('-')[1], 10);

            backups.push({
              dTag,
              timestamp: backup.timestamp || timestamp,
              metadata: backup.metadata || {},
              version: backup.version || 1,
              hasData: !!backup.backupData
            });
          }
        } catch (error) {
          console.warn(`[RelayBackupService] Failed to fetch backup ${dTag}:`, error);
        }
      }

      return backups;
    } catch (error) {
      console.error('[RelayBackupService] Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Restore settings from a backup
   * @param {string} dTag - D-tag of the backup to restore
   * @returns {Promise<Object>} Restore result
   */
  async restoreBackup(dTag) {
    try {
      console.log(`[RelayBackupService] Restoring backup: ${dTag}`);

      // Fetch the encrypted backup
      const backup = await relayStorage.fetch(dTag, true);

      if (!backup || !backup.backupData) {
        throw new Error('Backup not found or invalid');
      }

      console.log('[RelayBackupService] Backup data fetched, restoring...');

      // Restore each category (without publishing to avoid loops)
      const results = {
        success: true,
        restored: [],
        failed: []
      };

      // Extract settings and followList from backupData
      const settingsData = backup.backupData.settings || backup.backupData; // Handle both old and new format
      const followListData = backup.backupData.followList;

      // Zombie Classification
      if (settingsData.zombieClassification) {
        try {
          await zombieClassificationSettings.updateSettings(
            settingsData.zombieClassification,
            false // Don't publish during restore
          );
          results.restored.push('zombieClassification');
        } catch (error) {
          console.error('[RelayBackupService] Failed to restore zombie classification:', error);
          results.failed.push({ service: 'zombieClassification', error: error.message });
        }
      }

      // Scan Settings
      if (settingsData.scanSettings) {
        try {
          await scanSettings.updateSettings(
            settingsData.scanSettings,
            false
          );
          results.restored.push('scanSettings');
        } catch (error) {
          console.error('[RelayBackupService] Failed to restore scan settings:', error);
          results.failed.push({ service: 'scanSettings', error: error.message });
        }
      }

      // Batch Settings
      if (settingsData.batchSettings) {
        try {
          await batchSettings.updateSettings(
            settingsData.batchSettings,
            false
          );
          results.restored.push('batchSettings');
        } catch (error) {
          console.error('[RelayBackupService] Failed to restore batch settings:', error);
          results.failed.push({ service: 'batchSettings', error: error.message });
        }
      }

      // Relay Config
      if (settingsData.relayConfig) {
        try {
          await relayConfigSettings.updateSettings(
            settingsData.relayConfig,
            false
          );
          results.restored.push('relayConfig');
        } catch (error) {
          console.error('[RelayBackupService] Failed to restore relay config:', error);
          results.failed.push({ service: 'relayConfig', error: error.message });
        }
      }

      // Immunity List
      if (settingsData.immunityList && settingsData.immunityList.immunityRecords) {
        try {
          await immunityListSettings.clearAllImmunity(false);
          await immunityListSettings.importImmunityList(
            settingsData.immunityList.immunityRecords,
            false
          );
          results.restored.push('immunityList');
        } catch (error) {
          console.error('[RelayBackupService] Failed to restore immunity list:', error);
          results.failed.push({ service: 'immunityList', error: error.message });
        }
      }

      // Preferences
      if (settingsData.preferences) {
        try {
          await preferencesSettings.updateSettings(
            settingsData.preferences,
            false
          );
          results.restored.push('preferences');
        } catch (error) {
          console.error('[RelayBackupService] Failed to restore preferences:', error);
          results.failed.push({ service: 'preferences', error: error.message });
        }
      }

      // Follow List
      if (followListData) {
        try {
          console.log(`[RelayBackupService] Restoring follow list with ${followListData.followCount} follows...`);
          const restoreResult = await backupService.applyImportedFollowList(followListData);
          if (restoreResult.success) {
            results.restored.push('followList');
            results.followListRestored = true;
            results.followCount = followListData.followCount;
          } else {
            throw new Error(restoreResult.message);
          }
        } catch (error) {
          console.error('[RelayBackupService] Failed to restore follow list:', error);
          results.failed.push({ service: 'followList', error: error.message });
          results.followListRestored = false;
        }
      }

      console.log(`[RelayBackupService] Restore complete: ${results.restored.length} services restored, ${results.failed.length} failed`);

      // Save restored follow list as a local backup for the Backups tab
      if (followListData && results.followListRestored) {
        try {
          console.log('[RelayBackupService] Saving restored backup to local backups...');
          await backupService.storeBackup({
            ...followListData,
            id: followListData.id || `restored-${Date.now()}`,
            notes: `Restored from relay backup (${new Date(backup.timestamp * 1000).toLocaleString()})`,
            createdAt: followListData.timestamp || Date.now(),
            isRestored: true,
            restoredAt: Date.now()
          });
          console.log('[RelayBackupService] Saved to local backups');
        } catch (error) {
          console.warn('[RelayBackupService] Failed to save to local backups:', error);
        }
      }

      // After restore, publish all updated settings to relay
      console.log('[RelayBackupService] Publishing restored settings to relay...');
      await syncManager.syncAll(true);

      return results;
    } catch (error) {
      console.error('[RelayBackupService] Failed to restore backup:', error);
      return {
        success: false,
        error: error.message,
        restored: [],
        failed: []
      };
    }
  }

  /**
   * Delete a specific backup
   * @param {string} dTag - D-tag of the backup to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteBackup(dTag) {
    try {
      await relayStorage.delete(dTag);
      console.log(`[RelayBackupService] Deleted backup: ${dTag}`);
      return true;
    } catch (error) {
      console.error(`[RelayBackupService] Failed to delete backup ${dTag}:`, error);
      return false;
    }
  }

  /**
   * Clean up old backups, keeping only the N most recent
   * @param {number} keepCount - Number of backups to keep (default: 3)
   * @returns {Promise<number>} Number of backups deleted
   */
  async cleanupOldBackups(keepCount = this.maxBackups) {
    try {
      const backups = await this.listBackups();

      if (backups.length <= keepCount) {
        console.log(`[RelayBackupService] No cleanup needed (${backups.length} backups, keeping ${keepCount})`);
        return 0;
      }

      // Delete backups beyond the keep count
      const backupsToDelete = backups.slice(keepCount);
      let deletedCount = 0;

      for (const backup of backupsToDelete) {
        const deleted = await this.deleteBackup(backup.dTag);
        if (deleted) {
          deletedCount++;
        }
      }

      console.log(`[RelayBackupService] Cleaned up ${deletedCount} old backups`);
      return deletedCount;
    } catch (error) {
      console.error('[RelayBackupService] Failed to cleanup old backups:', error);
      return 0;
    }
  }

  /**
   * Get device information for backup metadata
   * @private
   * @returns {string} Device info
   */
  getDeviceInfo() {
    try {
      const ua = navigator.userAgent;
      const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
      const browser = browserMatch ? browserMatch[1] : 'Unknown';

      const osMatch = ua.match(/(Windows|Mac|Linux|Android|iOS)/);
      const os = osMatch ? osMatch[1] : 'Unknown';

      return `${browser}/${os}`;
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Get app version for backup metadata
   * @private
   * @returns {string} App version
   */
  getAppVersion() {
    try {
      // Try to get from package.json or a global variable
      return '0.5.0'; // TODO: Import from package.json or version file
    } catch (error) {
      return 'unknown';
    }
  }
}

// Export singleton instance
export default new RelayBackupService();
