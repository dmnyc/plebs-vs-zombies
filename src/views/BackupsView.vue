<template>
  <div>
    <h2 class="text-2xl mb-6">Backups & Restoration</h2>
    
    <div class="grid grid-cols-1 xl:grid-cols-3 lg:grid-cols-2 gap-6">
      <BackupManager title="Follow List Backups" />
      
      <div class="card">
        <h3 class="text-xl mb-4">Automatic Backups</h3>
        
        <div class="mb-6">
          <div class="flex justify-between items-center mb-2">
            <span class="text-gray-300">Automatic backups:</span>
            <span class="font-bold" :class="autoBackupsEnabled ? 'text-zombie-green' : 'text-gray-400'">
              {{ autoBackupsEnabled ? 'Enabled' : 'Disabled' }}
            </span>
          </div>
          
          <div class="mb-4">
            <label class="block text-gray-300 mb-2">Backup Frequency</label>
            <select 
              v-model="backupFrequency" 
              class="input w-full"
              :disabled="!autoBackupsEnabled"
            >
              <option value="1">Daily</option>
              <option value="7">Weekly</option>
              <option value="14">Bi-weekly</option>
              <option value="30">Monthly</option>
            </select>
          </div>
          
          <div class="flex gap-3">
            <button 
              v-if="!autoBackupsEnabled" 
              @click="enableAutoBackups" 
              class="btn-primary flex-grow"
            >
              Enable Auto-Backups
            </button>
            <button 
              v-else 
              @click="disableAutoBackups" 
              class="btn-danger flex-grow"
            >
              Disable Auto-Backups
            </button>
          </div>
        </div>
        
        <div class="border-t border-gray-700 pt-4">
          <h4 class="text-lg mb-3">Backup Information</h4>
          
          <div class="space-y-3">
            <p class="text-gray-300">
              Backups store your Nostr follows and public key information locally in your browser.
            </p>
            <p class="text-gray-300">
              We recommend exporting backups regularly and storing them securely.
            </p>
            <p class="text-gray-300 mt-4">
              <strong>What's included in backups:</strong>
            </p>
            <ul class="list-disc list-inside text-gray-400 ml-2">
              <li>Your public key (npub)</li>
              <li>Complete list of follows (pubkeys)</li>
              <li>Timestamp and metadata</li>
            </ul>
          </div>
        </div>
      </div>
      
      <!-- Remote Backup Section -->
      <div class="card">
        <h3 class="text-xl mb-4 flex items-center">
          Remote Backup 
          <span class="ml-2 px-2 py-0.5 text-xs bg-blue-700 text-blue-100 rounded-full">External</span>
        </h3>
        
        <div class="mb-6">
          <p class="text-gray-300 mb-4">
            Use <a href="https://nostr.land" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">nostr.land</a>'s free backup and restoration service for your Nostr social graph.
          </p>
          
          <div class="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-4">
            <div class="flex items-start">
              <svg class="w-5 h-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
              </svg>
              <div>
                <p class="text-blue-200 text-sm font-medium mb-1">How Remote Backups Work</p>
                <p class="text-blue-300 text-sm mb-2">
                  1. Add this relay to your client's write relays:
                </p>
                <div class="ml-4 mb-2">
                  <button @click="copyRelay" class="font-mono bg-gray-800 px-3 py-2 rounded text-sm hover:bg-gray-700 transition-colors border border-gray-600" :class="relayCopied ? 'text-green-400 border-green-600' : 'text-blue-200 border-gray-600'">
                    {{ relayCopied ? '✓ copied!' : 'wss://hist.nostr.land' }}
                  </button>
                </div>
                <p class="text-blue-300 text-sm mb-2">
                  2. Perform any follow action to save your backup
                </p>
                <p class="text-blue-300 text-sm">
                  Try following <a href="https://jumble.social/npub1pvz2c9z4pau26xdwfya24d0qhn6ne8zp9vwjuyxw629wkj9vh5lsrrsd4h" target="_blank" rel="noopener noreferrer" class="text-blue-200 hover:text-blue-100 underline">Plebs vs. Zombies</a> to test your backup
                </p>
              </div>
            </div>
          </div>
          
          <div class="space-y-3 mb-4">
            <div class="flex items-center">
              <svg class="w-4 h-4 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              <span class="text-gray-300 text-sm">Censorship-resistant</span>
            </div>
            <div class="flex items-center">
              <svg class="w-4 h-4 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              <span class="text-gray-300 text-sm">Accessible from any Nostr client</span>
            </div>
            <div class="flex items-center">
              <svg class="w-4 h-4 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              <span class="text-gray-300 text-sm">Professional restoration service</span>
            </div>
          </div>
          
          <div class="flex flex-col gap-3">
            <a 
              href="https://nostr.land/restore" 
              target="_blank" 
              rel="noopener noreferrer"
              class="btn-primary w-full text-center inline-flex items-center justify-center"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
              Restore from Nostr.land
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import BackupManager from '../components/BackupManager.vue';
import backupService from '../services/backupService';

export default {
  name: 'BackupsView',
  components: {
    BackupManager
  },
  data() {
    return {
      autoBackupsEnabled: false,
      backupFrequency: '7', // Weekly by default
      relayCopied: false
    };
  },
  methods: {
    enableAutoBackups() {
      const intervalDays = parseInt(this.backupFrequency, 10);
      backupService.setupAutomaticBackups(intervalDays);
      this.autoBackupsEnabled = true;
    },
    disableAutoBackups() {
      backupService.stopAutomaticBackups();
      this.autoBackupsEnabled = false;
    },
    loadSettings() {
      // Check if automatic backups are enabled
      const intervalDays = localStorage.getItem('automaticBackupIntervalDays');
      if (intervalDays) {
        this.autoBackupsEnabled = true;
        this.backupFrequency = intervalDays;
      }
    },
    async copyRelay() {
      try {
        await navigator.clipboard.writeText('wss://hist.nostr.land');
        this.relayCopied = true;
        setTimeout(() => {
          this.relayCopied = false;
        }, 2000);
      } catch (error) {
        console.error('Failed to copy relay URL:', error);
      }
    }
  },
  watch: {
    backupFrequency(newValue) {
      if (this.autoBackupsEnabled) {
        const intervalDays = parseInt(newValue, 10);
        backupService.setupAutomaticBackups(intervalDays);
      }
    }
  },
  mounted() {
    this.loadSettings();
  }
};
</script>