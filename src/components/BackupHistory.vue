<template>
  <div class="card">
    <h3 class="text-xl mb-4">Backup History</h3>
    
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
          class="p-4 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
        >
        <div class="flex justify-between items-start mb-2">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-bold text-white">{{ formatDate(backup.createdAt) }}</span>
              <span v-if="isRecentBackup(backup)" class="px-2 py-0.5 text-xs bg-green-900 text-green-200 rounded-full">
                Recent
              </span>
            </div>
            <div class="text-sm text-gray-400">
              <div>Follows: {{ backup.followCount }}</div>
              <div v-if="backup.notes" class="mt-1">Notes: {{ backup.notes }}</div>
            </div>
          </div>
          
          <div class="flex gap-2">
            <button 
              @click="exportBackup(backup)" 
              class="text-sm px-3 py-1 bg-blue-900 hover:bg-blue-800 rounded transition-colors"
              title="Export backup"
            >
              📤 Export
            </button>
            <button 
              @click="deleteBackup(backup.id)" 
              class="text-sm px-3 py-1 bg-red-900 hover:bg-red-800 rounded transition-colors"
              title="Delete backup"
            >
              🗑️ Delete
            </button>
          </div>
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

export default {
  name: 'BackupHistory',
  data() {
    return {
      backups: [],
      loading: true,
      currentPage: 1,
      itemsPerPage: 10
    };
  },
  computed: {
    latestBackup() {
      if (this.backups.length === 0) return null;
      return this.sortedBackups[0];
    },
    sortedBackups() {
      return [...this.backups].sort((a, b) => b.createdAt - a.createdAt);
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
    exportBackup(backup) {
      try {
        backupService.exportBackupToJson(backup);
      } catch (error) {
        console.error('Failed to export backup:', error);
        alert('Failed to export backup. See console for details.');
      }
    },
    async deleteBackup(id) {
      if (!confirm('Are you sure you want to delete this backup?')) {
        return;
      }
      
      try {
        await backupService.deleteBackup(id);
        await this.loadBackups(true);
      } catch (error) {
        console.error('Failed to delete backup:', error);
        alert('Failed to delete backup. See console for details.');
      }
    },
    goToPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
      }
    },
    async loadBackups(forceReload = false) {
      this.loading = true;
      
      try {
        this.backups = await backupService.getBackups(forceReload);
        
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