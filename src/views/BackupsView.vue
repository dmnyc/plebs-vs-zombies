<template>
  <div>
    <h2 class="text-2xl mb-6">Backups & Restoration</h2>

    <!-- Hunt Zombies CTA - Persistent at top after backup -->
    <div v-if="showHuntCTA" class="mb-6 bg-gradient-to-r from-green-900/30 via-zombie-dark to-green-900/30 p-6 rounded-lg border-2 border-zombie-green shadow-2xl">
      <div class="flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="text-center md:text-left">
          <div class="flex items-center justify-center md:justify-start gap-2 mb-2">
            <span class="text-3xl">✅</span>
            <h3 class="text-xl md:text-2xl font-bold text-green-400">Backup Created!</h3>
          </div>
          <p class="text-gray-300 text-sm md:text-base">
            Now that your follows are protected, it's time to start hunting zombies!
          </p>
        </div>
        <button
          @click="goToZombieHunting"
          class="btn-hunt whitespace-nowrap"
        >
          🎯 Hunt Zombies Safely
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 lg:grid-cols-2 gap-6">
      <!-- Backup Controls with Information -->
      <BackupControls 
        @backup-created="handleBackupCreated"
        @backup-imported="handleBackupImported"
      />
      
      <!-- Backup History -->
      <BackupHistory ref="backupHistory" @backup-restored="handleBackupRestored" />

      <!-- Remote Backup Section - HIDDEN (we now have relay backups) -->
      <!--
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
      -->

      <!-- Relay Backup Section -->
      <div class="card">
        <h3 class="text-xl mb-4 flex items-center">
          Relay Backup
          <span class="ml-2 px-2 py-0.5 text-xs bg-purple-700 text-purple-100 rounded-full">Encrypted</span>
        </h3>

        <div class="mb-6">
          <p class="text-gray-300 mb-4">
            Your settings, immunity list, and follow lists are automatically encrypted and synced to Nostr relays for multi-device access.
          </p>

          <div class="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4 mb-4">
            <div class="flex items-start">
              <svg class="w-5 h-5 text-purple-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
              </svg>
              <div>
                <p class="text-purple-200 text-sm font-medium mb-1">How Relay Backups Work</p>
                <p class="text-purple-300 text-sm">
                  Your data is encrypted with NIP-04 and stored on your Nostr relays. The app automatically syncs changes and keeps your 3 most recent backups.
                </p>
              </div>
            </div>
          </div>

          <div class="space-y-3 mb-4">
            <div class="flex items-center">
              <svg class="w-4 h-4 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              <span class="text-gray-300 text-sm">End-to-end encrypted (NIP-04)</span>
            </div>
            <div class="flex items-center">
              <svg class="w-4 h-4 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              <span class="text-gray-300 text-sm">Automatic multi-device sync</span>
            </div>
            <div class="flex items-center">
              <svg class="w-4 h-4 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              <span class="text-gray-300 text-sm">3 most recent backups kept</span>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <button
              @click="goToRelayBackups"
              class="btn-primary w-full text-center inline-flex items-center justify-center"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              Manage Relay Backups
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import BackupControls from '../components/BackupControls.vue';
import BackupHistory from '../components/BackupHistory.vue';

export default {
  name: 'BackupsView',
  components: {
    BackupControls,
    BackupHistory
  },
  data() {
    return {
      relayCopied: false,
      showHuntCTA: false
    };
  },
  methods: {
    goToZombieHunting() {
      this.$emit('navigate', 'hunting');
      // If the parent App doesn't handle navigate event, use router or direct method
      if (this.$parent && this.$parent.setActiveView) {
        this.$parent.setActiveView('hunting');
      }
    },
    goToRelayBackups() {
      this.$emit('navigate', 'settings');
      // If the parent App doesn't handle navigate event, use router or direct method
      if (this.$parent && this.$parent.setActiveView) {
        this.$parent.setActiveView('settings');
        // Scroll to relay backup section after navigation
        this.$nextTick(() => {
          const element = document.getElementById('relay-backup');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
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
    },
    handleBackupCreated(backup) {
      // Refresh the backup history
      if (this.$refs.backupHistory) {
        this.$refs.backupHistory.loadBackups(true);
      }

      // Show Hunt CTA after successful backup (persists until user navigates away)
      this.showHuntCTA = true;
    },
    handleBackupImported(result) {
      console.log('📢 BackupsView received backup-imported event:', result);
      // Refresh the backup history
      if (this.$refs.backupHistory) {
        console.log('🔄 Refreshing BackupHistory component');
        this.$refs.backupHistory.loadBackups(true);
      } else {
        console.warn('⚠️ BackupHistory ref not found');
      }
    },
    handleBackupRestored(result) {
      console.log('📢 Backup restored in parent:', result);
      // The BackupHistory component already shows detailed success feedback
      // Could potentially refresh other components here if needed
    }
  }
};
</script>