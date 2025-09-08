<template>
  <div class="card">
    <h3 class="text-xl mb-4">Follow List Backups</h3>
    
    <div v-if="loading" class="text-center py-4">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zombie-green"></div>
      <p class="mt-2 text-gray-400">{{ loadingMessage }}</p>
    </div>
    
    <div v-else>
      <div class="mb-6">
        <div class="flex justify-between items-center mb-2">
          <span class="text-gray-300">Last backup:</span>
          <span v-if="latestBackup" class="font-bold">{{ formatDate(latestBackup.createdAt) }}</span>
          <span v-else class="text-gray-400">Never</span>
        </div>
        
        <div v-if="latestBackup" class="text-sm text-gray-400 mb-4">
          <div>Follows saved: {{ latestBackup.followCount }}</div>
          <div v-if="latestBackup.notes" class="mt-1">Notes: {{ latestBackup.notes }}</div>
        </div>
        
        <div class="flex gap-3">
          <button @click="createBackup" class="btn-primary flex-grow" :disabled="loading">
            Create New Backup
          </button>
          <button v-if="latestBackup" @click="exportBackup(latestBackup)" class="btn-secondary">
            Export
          </button>
        </div>
      </div>
      
      <div class="border-t border-gray-700 pt-4 mt-6">
        <h4 class="text-lg mb-3">Import Backup</h4>
        <input 
          type="file" 
          ref="fileInput" 
          accept=".json" 
          class="hidden" 
          @change="handleFileUpload"
        />
        <button @click="$refs.fileInput.click()" class="btn-secondary w-full">
          Select Backup File
        </button>
      </div>
    </div>
    
    <!-- Backup Information -->
    <div class="border-t border-gray-700 pt-6 mt-6">
      <h4 class="text-lg mb-4">Backup Information</h4>
      
      <div class="space-y-4">
        <p class="text-gray-300 text-sm">
          Backups store your Nostr follows and public key information locally in your browser.
        </p>
        <p class="text-gray-300 text-sm">
          We recommend creating backups before purging zombies and exporting them regularly for safekeeping.
        </p>
        
        <div class="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
          <div class="flex items-start">
            <svg class="w-4 h-4 text-blue-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
            </svg>
            <div>
              <p class="text-blue-200 text-xs font-medium mb-1">What's included in backups</p>
              <ul class="list-disc list-inside text-blue-300 text-xs ml-2 space-y-0.5">
                <li>Your public key (npub)</li>
                <li>Complete list of follows (pubkeys)</li>
                <li>Timestamp and metadata</li>
                <li>Backup notes (if added)</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div class="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
          <div class="flex items-start">
            <svg class="w-4 h-4 text-amber-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            <div>
              <p class="text-amber-200 text-xs font-medium mb-1">Important Tips</p>
              <ul class="list-disc list-inside text-amber-300 text-xs ml-2 space-y-0.5">
                <li>Create a backup before major changes</li>
                <li>Export and save backups outside your browser</li>
                <li>Test restoration with small backups first</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { format } from 'date-fns';
import backupService from '../services/backupService';

export default {
  name: 'BackupControls',
  emits: ['backup-created', 'backup-imported'],
  data() {
    return {
      backups: [],
      loading: false,
      loadingMessage: 'Loading backups...'
    };
  },
  computed: {
    latestBackup() {
      if (this.backups.length === 0) return null;
      return this.sortedBackups[0];
    },
    sortedBackups() {
      return [...this.backups].sort((a, b) => b.createdAt - a.createdAt);
    }
  },
  methods: {
    formatDate(timestamp) {
      if (!timestamp) return 'Unknown';
      return format(new Date(timestamp), 'MMM d, yyyy, HH:mm');
    },
    async loadBackups(forceReload = false) {
      this.loading = true;
      this.loadingMessage = 'Loading backups...';
      
      try {
        this.backups = await backupService.getBackups(forceReload);
      } catch (error) {
        console.error('Failed to load backups:', error);
      } finally {
        this.loading = false;
      }
    },
    async createBackup() {
      this.loading = true;
      this.loadingMessage = 'Creating backup...';
      
      try {
        const result = await backupService.createBackup();
        
        if (result.success) {
          await this.loadBackups(true);
          this.$emit('backup-created', result.backup);
        } else {
          alert(`Failed to create backup: ${result.message}`);
        }
      } catch (error) {
        console.error('Failed to create backup:', error);
        alert('Failed to create backup. See console for details.');
      } finally {
        this.loading = false;
      }
    },
    exportBackup(backup) {
      try {
        backupService.exportBackupToJson(backup);
      } catch (error) {
        console.error('Failed to export backup:', error);
        alert('Failed to export backup. See console for details.');
      }
    },
    async handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      this.loading = true;
      this.loadingMessage = 'Importing backup...';
      
      try {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
          try {
            const content = e.target.result;
            const result = await backupService.importBackupFromJson(content);
            
            if (result.success) {
              await this.loadBackups(true);
              this.$emit('backup-imported', result);
              alert('Backup imported successfully!');
            } else {
              alert(`Failed to import backup: ${result.message}`);
            }
          } catch (error) {
            console.error('Failed to import backup:', error);
            alert('Failed to import backup. See console for details.');
          } finally {
            this.loading = false;
          }
        };
        
        reader.readAsText(file);
      } catch (error) {
        console.error('Failed to read file:', error);
        alert('Failed to read file. See console for details.');
        this.loading = false;
      }
      
      event.target.value = '';
    }
  },
  mounted() {
    this.loadBackups();
  }
};
</script>