/**
 * Vue Composable: useRelaySync
 *
 * Provides reactive relay sync functionality for Vue components.
 * Auto-publishes changes after modifications and tracks sync status.
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import syncManager from '../services/syncManager';

export function useRelaySync() {
  // Reactive state
  const syncStatus = ref({
    isOnline: false,
    lastSync: null,
    isSyncing: false,
    syncedServices: [],
    errors: []
  });

  const unsubscribe = ref(null);

  // Computed properties
  const isOnline = computed(() => syncStatus.value.isOnline);
  const isSyncing = computed(() => syncStatus.value.isSyncing);
  const lastSyncTime = computed(() => {
    if (!syncStatus.value.lastSync) return null;
    return new Date(syncStatus.value.lastSync);
  });
  const hasErrors = computed(() => syncStatus.value.errors.length > 0);
  const canSync = computed(() => syncManager.canSync());

  // Format last sync time for display
  const lastSyncFormatted = computed(() => {
    if (!lastSyncTime.value) return 'Never';

    const now = Date.now();
    const diff = now - lastSyncTime.value.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  });

  /**
   * Sync all registered services
   * @param {boolean} force - Force sync even if recently synced
   * @returns {Promise<Object>} Sync results
   */
  const syncAll = async (force = false) => {
    try {
      const result = await syncManager.syncAll(force);
      return result;
    } catch (error) {
      console.error('[useRelaySync] syncAll failed:', error);
      throw error;
    }
  };

  /**
   * Sync a specific service
   * @param {string} serviceName - Name of the service to sync
   * @returns {Promise<boolean>} Success status
   */
  const syncService = async (serviceName) => {
    try {
      return await syncManager.syncService(serviceName);
    } catch (error) {
      console.error(`[useRelaySync] syncService(${serviceName}) failed:`, error);
      throw error;
    }
  };

  /**
   * Publish a specific service's data
   * @param {string} serviceName - Name of the service to publish
   * @returns {Promise<boolean>} Success status
   */
  const publishService = async (serviceName) => {
    try {
      return await syncManager.publishService(serviceName);
    } catch (error) {
      console.error(`[useRelaySync] publishService(${serviceName}) failed:`, error);
      throw error;
    }
  };

  /**
   * Delete all relay data
   * @returns {Promise<Object>} Deletion results
   */
  const deleteAllData = async () => {
    try {
      return await syncManager.deleteAllData();
    } catch (error) {
      console.error('[useRelaySync] deleteAllData failed:', error);
      throw error;
    }
  };

  /**
   * List all data types stored on relays
   * @returns {Promise<string[]>} List of d-tags
   */
  const listStoredData = async () => {
    try {
      return await syncManager.listStoredData();
    } catch (error) {
      console.error('[useRelaySync] listStoredData failed:', error);
      throw error;
    }
  };

  /**
   * Clear all errors
   */
  const clearErrors = () => {
    syncManager.clearErrors();
  };

  /**
   * Register a service for syncing
   * @param {string} name - Service name
   * @param {Object} service - Service instance with sync methods
   */
  const registerService = (name, service) => {
    syncManager.registerService(name, service);
  };

  /**
   * Update local status from sync manager
   */
  const updateStatus = (newStatus) => {
    syncStatus.value = { ...newStatus };
  };

  // Lifecycle hooks
  onMounted(() => {
    // Subscribe to sync manager status updates
    unsubscribe.value = syncManager.subscribe(updateStatus);

    // Initialize status
    syncStatus.value = syncManager.getStatus();

    console.log('[useRelaySync] Composable mounted, subscribed to sync status');
  });

  onUnmounted(() => {
    // Cleanup subscription
    if (unsubscribe.value) {
      unsubscribe.value();
      console.log('[useRelaySync] Composable unmounted, unsubscribed from sync status');
    }
  });

  // Return reactive state and methods
  return {
    // Reactive state
    syncStatus,
    isOnline,
    isSyncing,
    lastSyncTime,
    lastSyncFormatted,
    hasErrors,
    canSync,

    // Methods
    syncAll,
    syncService,
    publishService,
    deleteAllData,
    listStoredData,
    clearErrors,
    registerService
  };
}
