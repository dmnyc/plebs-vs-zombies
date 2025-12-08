<template>
  <div class="card">
    <h3 class="text-xl mb-4">Backup History</h3>
    
    <!-- Success Modal -->
    <ConfirmModal
      :show="showSuccessModal"
      :title="successModal.title"
      :message="successModal.message"
      type="success"
      confirm-text="OK"
      :cancel-text="null"
      @confirm="showSuccessModal = false"
      @cancel="showSuccessModal = false"
    />
    
    <!-- Error Modal -->
    <ConfirmModal
      :show="showErrorModal"
      :title="errorModal.title"
      :message="errorModal.message"
      type="error"
      confirm-text="OK"
      :cancel-text="null"
      @confirm="showErrorModal = false"
      @cancel="showErrorModal = false"
    />
    
    <!-- Confirmation Modal -->
    <ConfirmModal
      :show="showConfirmModal"
      :title="confirmModal.title"
      :message="confirmModal.message"
      :type="confirmModal.type"
      :confirm-text="confirmModal.confirmText"
      cancel-text="Cancel"
      @confirm="handleConfirmAction"
      @cancel="showConfirmModal = false"
    />
    
    <div v-if="loading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zombie-green"></div>
      <p class="mt-2 text-gray-400">Loading backups...</p>
    </div>
    
    <div v-else-if="backups.length === 0" class="text-center py-8">
      <div class="text-6xl mb-4">💾</div>
      <p class="text-gray-400 mb-2">No backups found</p>
      <p class="text-gray-500 text-sm">Create your first backup to get started</p>
    </div>
    
    <div v-else class="space-y-4">
      <div class="space-y-3">
        <div
          v-for="backup in paginatedBackups"
          :key="backup.id"
          class="p-4 border rounded-lg transition-all"
          :class="restoring === backup.id
            ? 'border-zombie-green bg-green-900/20 shadow-lg shadow-zombie-green/20'
            : 'border-gray-700 hover:bg-gray-800'"
        >
        <!-- Restoring Indicator -->
        <div v-if="restoring === backup.id" class="mb-3 p-3 bg-zombie-green/10 border border-zombie-green/30 rounded-lg">
          <div class="flex items-center gap-3">
            <div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-zombie-green"></div>
            <div>
              <div class="text-zombie-green font-semibold">Restoring Backup...</div>
              <div class="text-xs text-gray-400 mt-1">This may take a moment. Please wait.</div>
            </div>
          </div>
        </div>

        <!-- Backup Info Section -->
        <div class="mb-3">
          <div class="flex items-center gap-2 mb-2">
            <span class="font-bold text-white">{{ formatDate(backup.createdAt) }}</span>
            <span v-if="backup.isImported" class="px-2 py-0.5 text-xs bg-blue-900 text-blue-200 rounded-full">
              Imported
            </span>
            <span v-else-if="isRecentBackup(backup)" class="px-2 py-0.5 text-xs bg-green-900 text-green-200 rounded-full">
              Recent
            </span>
          </div>
          <div class="text-sm text-gray-400">
            <div>Follows: {{ backup.followCount }}</div>
            <div v-if="backup.notes" class="mt-1">Notes: {{ backup.notes }}</div>
          </div>
        </div>

        <!-- Action Buttons Section -->
        <div class="flex flex-wrap gap-2 mb-2">
          <button
            @click="restoreBackup(backup)"
            class="text-sm px-3 py-1.5 rounded transition-colors flex items-center gap-1"
            :class="restoring === backup.id
              ? 'bg-zombie-green/20 text-zombie-green border border-zombie-green/50 cursor-wait'
              : restoring
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-green-900 hover:bg-green-800'"
            title="Restore this backup"
            :disabled="restoring"
          >
            <span>{{ restoring === backup.id ? '⏳' : '🔄' }}</span>
            <span>{{ restoring === backup.id ? 'Restoring...' : 'Restore' }}</span>
          </button>
          <button 
            @click="exportBackup(backup)" 
            class="text-sm px-3 py-1.5 bg-blue-900 hover:bg-blue-800 rounded transition-colors flex items-center gap-1"
            title="Export backup"
          >
            <span>📤</span>
            <span>Export</span>
          </button>
          <button 
            @click="deleteBackup(backup.id)" 
            class="text-sm px-3 py-1.5 bg-red-900 hover:bg-red-800 rounded transition-colors flex items-center gap-1"
            title="Delete backup"
          >
            <span>🗑️</span>
            <span>Delete</span>
          </button>
        </div>
        
        <!-- Age indicator -->
        <div class="mt-2 pt-2 border-t border-gray-800">
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-500">{{ getBackupAge(backup.createdAt) }}</span>
            <div class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full" :class="getBackupStatusColor(backup)"></span>
              <span class="text-xs" :class="getBackupStatusTextColor(backup)">
                {{ getBackupStatus(backup) }}
              </span>
            </div>
          </div>
        </div>
        </div>
      </div>
      
      <!-- Pagination -->
      <div v-if="showPagination" class="flex items-center justify-between pt-4 border-t border-gray-700">
        <div class="text-sm text-gray-400">
          Showing {{ (currentPage - 1) * itemsPerPage + 1 }}-{{ Math.min(currentPage * itemsPerPage, backups.length) }} of {{ backups.length }}
        </div>
        
        <div class="flex items-center gap-2">
          <button 
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="px-3 py-1 text-sm rounded transition-colors"
            :class="currentPage === 1 ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'"
          >
            ← Prev
          </button>
          
          <div class="flex items-center gap-1">
            <button
              v-for="page in visiblePages"
              :key="page"
              @click="goToPage(page)"
              class="px-3 py-1 text-sm rounded transition-colors"
              :class="page === currentPage ? 'bg-zombie-green text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'"
            >
              {{ page }}
            </button>
          </div>
          
          <button 
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="px-3 py-1 text-sm rounded transition-colors"
            :class="currentPage === totalPages ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'"
          >
            Next →
          </button>
        </div>
      </div>
      
      <!-- Summary -->
      <div class="pt-4 border-t border-gray-700">
        <div class="flex justify-between text-sm text-gray-400">
          <span>Total backups: {{ backups.length }}</span>
          <span v-if="latestBackup">Last: {{ formatRelativeDate(latestBackup.createdAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { format, formatDistanceToNow } from 'date-fns';
import backupService from '../services/backupService';
import ConfirmModal from './ConfirmModal.vue';

export default {
  name: 'BackupHistory',
  components: {
    ConfirmModal
  },
  emits: ['backup-restored'],
  data() {
    return {
      backups: [],
      loading: true,
      currentPage: 1,
      itemsPerPage: 10,
      restoring: null,
      showSuccessModal: false,
      successModal: {
        title: '',
        message: ''
      },
      showErrorModal: false,
      errorModal: {
        title: '',
        message: ''
      },
      showConfirmModal: false,
      confirmModal: {
        title: '',
        message: '',
        type: 'warning',
        confirmText: 'Confirm',
        action: null,
        actionData: null
      }
    };
  },
  computed: {
    latestBackup() {
      if (this.backups.length === 0) return null;
      return this.sortedBackups[0];
    },
    sortedBackups() {
      return [...this.backups].sort((a, b) => {
        // Imported backups first, then by creation date
        if (a.isImported && !b.isImported) return -1;
        if (!a.isImported && b.isImported) return 1;
        
        // If both are imported, sort by import date (most recent first)
        if (a.isImported && b.isImported) {
          return (b.importedAt || b.createdAt) - (a.importedAt || a.createdAt);
        }
        
        // Otherwise sort by creation date (most recent first)
        return b.createdAt - a.createdAt;
      });
    },
    paginatedBackups() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.sortedBackups.slice(start, end);
    },
    totalPages() {
      return Math.ceil(this.backups.length / this.itemsPerPage);
    },
    showPagination() {
      return this.backups.length > this.itemsPerPage;
    },
    visiblePages() {
      const pages = [];
      const maxVisible = 5;
      const halfVisible = Math.floor(maxVisible / 2);
      
      let startPage = Math.max(1, this.currentPage - halfVisible);
      let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);
      
      // Adjust start if we're near the end
      if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      return pages;
    }
  },
  methods: {
    formatDate(timestamp) {
      if (!timestamp) return 'Unknown';
      return format(new Date(timestamp), 'MMM d, yyyy, HH:mm');
    },
    formatRelativeDate(timestamp) {
      if (!timestamp) return 'Unknown';
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    },
    getBackupAge(timestamp) {
      if (!timestamp) return 'Unknown age';
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    },
    isRecentBackup(backup) {
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      return backup.createdAt > oneWeekAgo;
    },
    getBackupStatus(backup) {
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      if (backup.createdAt > oneWeekAgo) return 'Fresh';
      if (backup.createdAt > oneMonthAgo) return 'Good';
      return 'Old';
    },
    getBackupStatusColor(backup) {
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      if (backup.createdAt > oneWeekAgo) return 'bg-green-400';
      if (backup.createdAt > oneMonthAgo) return 'bg-yellow-400';
      return 'bg-red-400';
    },
    getBackupStatusTextColor(backup) {
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      if (backup.createdAt > oneWeekAgo) return 'text-green-400';
      if (backup.createdAt > oneMonthAgo) return 'text-yellow-400';
      return 'text-red-400';
    },
    showSuccess(title, message) {
      this.successModal = { title, message };
      this.showSuccessModal = true;
    },
    showError(title, message) {
      this.errorModal = { title, message };
      this.showErrorModal = true;
    },
    showConfirm(title, message, type, confirmText, action, actionData) {
      this.confirmModal = {
        title,
        message,
        type,
        confirmText,
        action,
        actionData
      };
      this.showConfirmModal = true;
    },
    handleConfirmAction() {
      this.showConfirmModal = false;
      if (this.confirmModal.action === 'restore') {
        this.performRestore(this.confirmModal.actionData);
      } else if (this.confirmModal.action === 'delete') {
        this.performDelete(this.confirmModal.actionData);
      }
    },
    exportBackup(backup) {
      try {
        backupService.exportBackupToJson(backup);
      } catch (error) {
        console.error('Failed to export backup:', error);
        this.showError('Export Failed', 'Failed to export backup. See console for details.');
      }
    },
    restoreBackup(backup) {
      const confirmMsg = `Are you sure you want to restore this backup?\n\nThis will replace your current follow list with ${backup.followCount} follows from ${this.formatDate(backup.createdAt)}.\n\nThis action cannot be undone.`;
      
      this.showConfirm(
        'Restore Backup?',
        confirmMsg,
        'warning',
        'Restore',
        'restore',
        backup
      );
    },
    async performRestore(backup) {
      this.restoring = backup.id;
      
      try {
        console.log('🔄 Starting backup restoration...');
        const result = await backupService.applyImportedFollowList(backup);
        
        if (result.success) {
          const verificationInfo = result.verifiedFollowCount !== undefined 
            ? `\n\nVerification: Follow list now contains ${result.verifiedFollowCount} follows.`
            : '';
          
          const relayInfo = result.publishResults 
            ? `\nPublished to ${result.publishResults.successful}/${result.publishResults.total} relays.`
            : '';
          
          this.showSuccess(
            'Backup Restored Successfully!',
            `Your follow list has been updated with ${result.followCount} follows.${relayInfo}${verificationInfo}\n\nChanges should now be visible across your Nostr clients.`
          );
          console.log('✅ Backup restoration completed:', result);
          
          // Emit event to parent components to refresh data
          this.$emit('backup-restored', result);
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        console.error('❌ Failed to restore backup:', error);
        this.showError('Restore Failed', `Failed to restore backup: ${error.message}\n\nSee console for details.`);
      } finally {
        this.restoring = null;
      }
    },
    deleteBackup(id) {
      this.showConfirm(
        'Delete Backup?',
        'Are you sure you want to delete this backup?\n\nThis action cannot be undone.',
        'warning',
        'Delete',
        'delete',
        id
      );
    },
    async performDelete(id) {
      try {
        await backupService.deleteBackup(id);
        await this.loadBackups(true);
      } catch (error) {
        console.error('Failed to delete backup:', error);
        this.showError('Delete Failed', 'Failed to delete backup. See console for details.');
      }
    },
    goToPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
      }
    },
    async loadBackups(forceReload = false) {
      console.log(`🔄 BackupHistory.loadBackups called with forceReload=${forceReload}`);
      this.loading = true;
      
      try {
        this.backups = await backupService.getBackups(forceReload);
        console.log(`📋 BackupHistory loaded ${this.backups.length} backups`);
        
        
        // Reset to first page if current page is out of bounds
        if (this.currentPage > this.totalPages && this.totalPages > 0) {
          this.currentPage = 1;
        }
      } catch (error) {
        console.error('Failed to load backups:', error);
      } finally {
        this.loading = false;
      }
    }
  },
  mounted() {
    this.loadBackups();
  }
};
</script>