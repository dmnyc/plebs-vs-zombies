<template>
  <div>
    <h2 class="page-title">Backups & Restoration</h2>

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

    <!-- Tab Navigation -->
    <nav class="flex border-b border-gray-700 mb-6 overflow-x-auto" role="tablist" aria-label="Backup sections">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :id="`tab-${tab.id}`"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :aria-controls="`panel-${tab.id}`"
        :tabindex="activeTab === tab.id ? 0 : -1"
        @click="activeTab = tab.id"
        @keydown="handleTabKeydown($event, tab.id)"
        class="px-4 py-3 text-sm md:text-base font-medium whitespace-nowrap transition-colors border-b-2 -mb-px focus:outline-none focus:ring-2 focus:ring-zombie-green focus:ring-offset-2 focus:ring-offset-zombie-dark"
        :class="activeTab === tab.id
          ? 'border-zombie-green text-zombie-green'
          : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'"
      >
        <span class="mr-2">{{ tab.icon }}</span>{{ tab.label }}
      </button>
    </nav>

    <!-- Backups Tab -->
    <section
      v-show="activeTab === 'backups'"
      id="panel-backups"
      role="tabpanel"
      aria-labelledby="tab-backups"
    >
      <!-- Recovery discovery callout -->
      <div class="mb-6 bg-gradient-to-r from-blue-900/30 via-zombie-dark to-blue-900/30 border border-blue-700/50 rounded-lg p-5">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div class="flex items-start gap-4">
            <div class="text-4xl flex-shrink-0">🛟</div>
            <div>
              <h3 class="text-lg font-bold text-blue-200 mb-1">Follow list get eaten?</h3>
              <p class="text-sm text-blue-300">
                If another client wiped or shrank your follows, the Recovery tool can scan your relays for older versions and republish a prior one. No backup required.
              </p>
            </div>
          </div>
          <button
            @click="activeTab = 'recover'"
            class="btn-primary whitespace-nowrap inline-flex items-center justify-center gap-2"
          >
            <span>Go to Recovery</span>
            <span>→</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BackupControls
          @backup-created="handleBackupCreated"
          @backup-imported="handleBackupImported"
        />
        <BackupHistory ref="backupHistory" @backup-restored="handleBackupRestored" />
      </div>
    </section>

    <!-- Recover Tab -->
    <section
      v-show="activeTab === 'recover'"
      id="panel-recover"
      role="tabpanel"
      aria-labelledby="tab-recover"
    >
      <!-- Follow List Recovery (new feature) -->
      <FollowRecovery class="mb-6" />

      <!-- External + Encrypted Relay Backup cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- nostr.land Backup -->
        <div class="card">
          <h3 class="text-xl mb-4 flex items-center">
            nostr.land Backup
            <span class="ml-2 px-2 py-0.5 text-xs bg-blue-700 text-blue-100 rounded-full">Public</span>
          </h3>

          <div class="mb-6">
            <p class="text-gray-300 mb-4">
              Use <a href="https://nostr.land" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">nostr.land</a>'s backup and restoration service to keep a public follow-list snapshot on the hist.nostr.land relay.
            </p>

            <div class="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-4">
              <div class="flex items-start">
                <svg class="w-5 h-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                </svg>
                <div>
                  <p class="text-blue-200 text-sm font-medium mb-1">How hist.nostr.land backups work</p>
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
                  <p class="text-blue-300 text-sm mb-2">
                    3. Restore it anytime on <a href="https://nostr.land/restore" target="_blank" rel="noopener noreferrer" class="text-blue-200 hover:text-blue-100 underline">nostr.land/restore</a>
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
                <span class="text-gray-300 text-sm">Follow list only (NIP-02)</span>
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
                <span class="text-gray-300 text-sm">Separate from encrypted relay backups</span>
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
              <button
                @click="publishNip65Relay"
                class="btn-secondary w-full text-center inline-flex items-center justify-center"
                :disabled="nip65Publishing || nip65RelayAdded"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m7-7H5"></path>
                </svg>
                {{ nip65ButtonLabel }}
              </button>
              <p v-if="nip65Status" class="text-xs text-green-400">{{ nip65Status }}</p>
              <p v-else-if="nip65Error" class="text-xs text-red-400">{{ nip65Error }}</p>
              <p v-else class="text-xs text-gray-500">
                Publishes wss://hist.nostr.land to your announced relays (NIP-65).
              </p>
            </div>
          </div>
        </div>

        <!-- Encrypted Relay Backup -->
        <div class="card">
          <h3 class="text-xl mb-4 flex items-center">
            Encrypted Relay Backup
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
    </section>
  </div>
</template>

<script>
import BackupControls from '../components/BackupControls.vue';
import BackupHistory from '../components/BackupHistory.vue';
import FollowRecovery from '../components/FollowRecovery.vue';
import nostrService from '../services/nostrService';

export default {
  name: 'BackupsView',
  components: {
    BackupControls,
    BackupHistory,
    FollowRecovery
  },
  data() {
    return {
      activeTab: 'backups',
      tabs: [
        { id: 'backups', label: 'Backups', icon: '💾' },
        { id: 'recover', label: 'Recover', icon: '🛟' }
      ],
      relayCopied: false,
      showHuntCTA: false,
      userRelayList: null,
      nip65Publishing: false,
      nip65Status: null,
      nip65Error: null
    };
  },
  computed: {
    nip65RelayAdded() {
      return this.isRelayInNip65('wss://hist.nostr.land');
    },
    nip65ButtonLabel() {
      if (this.nip65Publishing) {
        return 'Publishing NIP-65 relays...';
      }
      if (this.nip65RelayAdded) {
        return 'Already in NIP-65 relay list';
      }
      return 'Add to NIP-65 relay list';
    }
  },
  methods: {
    handleTabKeydown(event, tabId) {
      const idx = this.tabs.findIndex((t) => t.id === tabId);
      if (idx === -1) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const next = this.tabs[(idx + 1) % this.tabs.length];
        this.activeTab = next.id;
        this.$nextTick(() => document.getElementById(`tab-${next.id}`)?.focus());
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const prev = this.tabs[(idx - 1 + this.tabs.length) % this.tabs.length];
        this.activeTab = prev.id;
        this.$nextTick(() => document.getElementById(`tab-${prev.id}`)?.focus());
      }
    },
    normalizeRelayUrl(relayUrl) {
      return relayUrl.trim().replace(/\/$/, '');
    },
    isRelayInNip65(relayUrl) {
      if (!this.userRelayList) return false;
      const normalizedRelay = this.normalizeRelayUrl(relayUrl);
      const relays = [
        ...this.userRelayList.bothRelays,
        ...this.userRelayList.readRelays,
        ...this.userRelayList.writeRelays
      ].map((relay) => this.normalizeRelayUrl(relay));
      return relays.includes(normalizedRelay);
    },
    goToZombieHunting() {
      this.$router.push('/hunt');
    },
    goToRelayBackups() {
      this.$router.push('/settings');
      this.$nextTick(() => {
        const element = document.getElementById('relay-backup');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
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
    async publishNip65Relay() {
      this.nip65Publishing = true;
      this.nip65Status = null;
      this.nip65Error = null;

      try {
        const result = await nostrService.addRelayToNip65('wss://hist.nostr.land', {
          read: true,
          write: true
        });
        this.userRelayList = result.relayList;
        const relayCount = result.publishedToRelays;
        this.nip65Status = `Published to ${relayCount} relay${relayCount !== 1 ? 's' : ''}.`;
      } catch (error) {
        this.nip65Error = error?.message || 'Failed to publish relay list.';
      } finally {
        this.nip65Publishing = false;
      }
    },
    handleBackupCreated(backup) {
      if (this.$refs.backupHistory) {
        this.$refs.backupHistory.loadBackups(true);
      }
      this.showHuntCTA = true;
    },
    handleBackupImported(result) {
      console.log('📢 BackupsView received backup-imported event:', result);
      if (this.$refs.backupHistory) {
        console.log('🔄 Refreshing BackupHistory component');
        this.$refs.backupHistory.loadBackups(true);
      } else {
        console.warn('⚠️ BackupHistory ref not found');
      }
    },
    handleBackupRestored(result) {
      console.log('📢 Backup restored in parent:', result);
    }
  },
  mounted() {
    this.userRelayList = nostrService.userRelayList;
    // Tab selection priority: ?tab=foo query > route meta defaultTab > 'backups'
    const tabFromQuery = this.$route?.query?.tab;
    const tabFromMeta = this.$route?.meta?.defaultTab;
    const requested = tabFromQuery || tabFromMeta;
    if (requested && this.tabs.some((t) => t.id === requested)) {
      this.activeTab = requested;
    }
  }
};
</script>
