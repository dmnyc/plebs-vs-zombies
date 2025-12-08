/**
 * Sync Manager Service
 *
 * Coordinates synchronization of all app data with Nostr relays.
 * Provides unified API for sync operations and status tracking.
 */

import relayStorage from './relayStorage';
import nostrService from './nostrService';

class SyncManager {
  constructor() {
    this.syncStatus = {
      isOnline: false,
      lastSync: null,
      isSyncing: false,
      syncedServices: [],
      errors: []
    };

    this.listeners = new Set();
    this.services = new Map(); // Will be populated by individual services
  }

  /**
   * Register a service for syncing
   * @param {string} name - Service name (e.g., 'zombieClassification')
   * @param {Object} service - Service instance with sync methods
   */
  registerService(name, service) {
    this.services.set(name, service);
    console.log(`[SyncManager] Registered service: ${name}`);
  }

  /**
   * Sync all registered services
   * @param {boolean} force - Force sync even if recently synced
   * @returns {Promise<Object>} Sync results
   */
  async syncAll(force = false) {
    if (this.syncStatus.isSyncing) {
      console.log('[SyncManager] Sync already in progress');
      return { success: false, message: 'Sync already in progress' };
    }

    try {
      this._updateStatus({ isSyncing: true, errors: [] });

      // Check if we're connected
      if (!nostrService.pubkey) {
        throw new Error('Not connected to Nostr');
      }

      this._updateStatus({ isOnline: true });

      const results = {
        success: true,
        synced: [],
        failed: [],
        timestamp: new Date().toISOString()
      };

      // Sync each service
      for (const [name, service] of this.services) {
        try {
          console.log(`[SyncManager] Syncing ${name}...`);

          if (typeof service.syncWithRelay === 'function') {
            await service.syncWithRelay();
            results.synced.push(name);
          } else {
            console.warn(`[SyncManager] Service ${name} does not have syncWithRelay method`);
          }
        } catch (error) {
          console.error(`[SyncManager] Failed to sync ${name}:`, error);
          results.failed.push({ name, error: error.message });
          this._addError(`${name}: ${error.message}`);
        }
      }

      this._updateStatus({
        lastSync: Date.now(),
        syncedServices: results.synced
      });

      console.log('[SyncManager] Sync complete', results);
      return results;

    } catch (error) {
      console.error('[SyncManager] Sync failed:', error);
      this._addError(error.message);
      return { success: false, error: error.message };
    } finally {
      this._updateStatus({ isSyncing: false });
    }
  }

  /**
   * Sync a specific service
   * @param {string} serviceName - Name of the service to sync
   * @returns {Promise<boolean>} Success status
   */
  async syncService(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    try {
      console.log(`[SyncManager] Syncing ${serviceName}...`);

      if (typeof service.syncWithRelay === 'function') {
        await service.syncWithRelay();
        this._updateSyncedService(serviceName, true);
        return true;
      } else {
        throw new Error(`Service ${serviceName} does not have syncWithRelay method`);
      }
    } catch (error) {
      console.error(`[SyncManager] Failed to sync ${serviceName}:`, error);
      this._addError(`${serviceName}: ${error.message}`);
      this._updateSyncedService(serviceName, false);
      return false;
    }
  }

  /**
   * Publish data for a specific service
   * @param {string} serviceName - Name of the service
   * @returns {Promise<boolean>} Success status
   */
  async publishService(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    try {
      console.log(`[SyncManager] Publishing ${serviceName}...`);

      if (typeof service.publishToRelay === 'function') {
        await service.publishToRelay();
        return true;
      } else {
        throw new Error(`Service ${serviceName} does not have publishToRelay method`);
      }
    } catch (error) {
      console.error(`[SyncManager] Failed to publish ${serviceName}:`, error);
      this._addError(`${serviceName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get current sync status
   * @returns {Object} Current status
   */
  getStatus() {
    return { ...this.syncStatus };
  }

  /**
   * Subscribe to status changes
   * @param {Function} callback - Called when status changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Clear all errors
   */
  clearErrors() {
    this._updateStatus({ errors: [] });
  }

  /**
   * Delete all relay data
   * @returns {Promise<Object>} Deletion results
   */
  async deleteAllData() {
    try {
      const results = {
        success: true,
        deleted: [],
        failed: []
      };

      // Delete data for each service
      for (const [name, service] of this.services) {
        try {
          console.log(`[SyncManager] Deleting ${name} from relays...`);

          if (typeof service.deleteFromRelay === 'function') {
            await service.deleteFromRelay();
            results.deleted.push(name);
          } else if (service.dTag) {
            // Fallback: use relayStorage directly if service has a dTag
            await relayStorage.delete(service.dTag);
            results.deleted.push(name);
          }
        } catch (error) {
          console.error(`[SyncManager] Failed to delete ${name}:`, error);
          results.failed.push({ name, error: error.message });
        }
      }

      console.log('[SyncManager] Delete complete', results);
      return results;

    } catch (error) {
      console.error('[SyncManager] Delete failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List all data types stored on relays
   * @returns {Promise<string[]>} List of d-tags
   */
  async listStoredData() {
    try {
      return await relayStorage.listDataTypes();
    } catch (error) {
      console.error('[SyncManager] Failed to list stored data:', error);
      throw error;
    }
  }

  /**
   * Update sync status and notify listeners
   * @private
   */
  _updateStatus(updates) {
    this.syncStatus = { ...this.syncStatus, ...updates };
    this._notifyListeners();
  }

  /**
   * Add an error to the status
   * @private
   */
  _addError(message) {
    const errors = [...this.syncStatus.errors, {
      message,
      timestamp: Date.now()
    }];
    this._updateStatus({ errors });
  }

  /**
   * Update synced service status
   * @private
   */
  _updateSyncedService(serviceName, success) {
    if (success) {
      const syncedServices = [...this.syncStatus.syncedServices];
      if (!syncedServices.includes(serviceName)) {
        syncedServices.push(serviceName);
      }
      this._updateStatus({ syncedServices });
    }
  }

  /**
   * Notify all listeners of status changes
   * @private
   */
  _notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.syncStatus);
      } catch (error) {
        console.error('[SyncManager] Listener error:', error);
      }
    });
  }

  /**
   * Check if user is online and can sync
   * @returns {boolean}
   */
  canSync() {
    return !!(nostrService.pubkey && nostrService.ndk);
  }
}

// Export singleton instance
export default new SyncManager();
