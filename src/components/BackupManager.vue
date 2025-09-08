<template>
  <div class="card">
    <h3 class="text-xl mb-4">{{ title }}</h3>
    
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
      
      <div class="border-t border-gray-700 pt-4">
        <h4 class="text-lg mb-3">Backup History</h4>
        
        <div v-if="backups.length === 0" class="text-center py-4">
          <p class="text-gray-400">No backups found</p>
        </div>
        
        <div v-else class="space-y-3 max-h-60 overflow-y-auto pr-2">
          <div 
            v-for="backup in sortedBackups" 
            :key="backup.id" 
            class="p-3 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <div class="flex justify-between items-center">
              <span class="font-bold">{{ formatDate(backup.createdAt) }}</span>
              <div class="flex gap-2">
                <button 
                  @click="exportBackup(backup)" 
                  class="text-sm px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                  title="Export backup"
                >
                  Export
                </button>
                <button 
                  @click="deleteBackup(backup.id)" 
                  class="text-sm px-2 py-1 bg-red-900 hover:bg-red-800 rounded"
                  title="Delete backup"
                >
                  Delete
                </button>
              </div>
            </div>
            <div class="text-sm text-gray-400 mt-1">
              Follows: {{ backup.followCount }}
            </div>
            <div v-if="backup.notes" class="text-sm text-gray-400 mt-1">
              Notes: {{ backup.notes }}
            </div>
          </div>
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
  </div>
</template>

<script>
import { format } from 'date-fns';
import backupService from '../services/backupService';

export default {
  name: 'BackupManager',
  props: {
    title: {
      type: String,
      default: 'Backup Manager'
    }
  },
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
      // Sort backups by creation date, newest first
      return [...this.backups].sort((a, b) => b.createdAt - a.createdAt);
    }
  },
  methods: {
    formatDate(timestamp) {
      if (!timestamp) return 'Unknown';
      return format(new Date(timestamp), 'MMM d, yyyy, HH:mm');
    },
    async loadBackups() {
      this.loading = true;
      this.loadingMessage = 'Loading backups...';
      
      try {
        this.backups = await backupService.getBackups();
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
          await this.loadBackups();
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
    async deleteBackup(id) {
      if (!confirm('Are you sure you want to delete this backup?')) {
        return;
      }
      
      this.loading = true;
      this.loadingMessage = 'Deleting backup...';
      
      try {
        await backupService.deleteBackup(id);
        await this.loadBackups();
      } catch (error) {
        console.error('Failed to delete backup:', error);
        alert('Failed to delete backup. See console for details.');
      } finally {
        this.loading = false;
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
              await this.loadBackups();
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
      
      // Reset the file input
      event.target.value = '';
    }
  },
  mounted() {
    this.loadBackups();
  }
};
</script>