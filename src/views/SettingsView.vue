<template>
  <div>
    <h2 class="text-2xl mb-6">Settings</h2>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card">
        <h3 class="text-xl mb-4">Nostr Settings</h3>
        
        <!-- Account Status -->
        <div class="mb-6">
          <h4 class="text-lg mb-3">Account</h4>
          
          <div v-if="isConnected" class="space-y-4">
            <!-- Current Connection Status -->
            <div class="p-4 bg-gray-800 border border-gray-600 rounded-lg">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                  <div class="text-zombie-green">
                    <span class="w-3 h-3 bg-zombie-green rounded-full inline-block"></span>
                  </div>
                  <span class="text-gray-100 font-medium">Connected</span>
                </div>
                <span class="text-sm text-gray-400">
                  {{ signingMethod === 'nip07' ? 'Browser Extension' : 'Remote Signer' }}
                </span>
              </div>
              
              <!-- Public Key -->
              <div class="text-gray-300 mb-2">Your public key:</div>
              <div class="flex items-center">
                <span class="font-mono text-sm bg-gray-900 p-3 rounded-l border border-gray-700 truncate flex-grow">
                  {{ npub }}
                </span>
                <button 
                  @click="copyToClipboard(npub)" 
                  class="bg-gray-700 border border-l-0 border-gray-700 p-3 rounded-r hover:bg-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
            </div>
            
            <!-- Hunt Zombies Quick Access -->
            <div class="mt-4 p-4 bg-gradient-to-br from-zombie-dark/50 to-gray-800/50 border border-zombie-green/30 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-2xl">🧟</span>
                <span class="font-semibold text-zombie-green">Ready to clean up your follows?</span>
              </div>
              <button
                @click="goToZombieHunting"
                class="btn-hunt w-full text-base py-2"
              >
                🎯 Hunt Zombies
              </button>
            </div>

            <!-- Logout Button -->
            <button
              @click="logout"
              class="btn-danger w-full mt-4"
            >
              Logout
            </button>
          </div>

          <!-- Not Connected State -->
          <div v-else class="p-4 bg-gray-800 border border-gray-600 rounded-lg text-center">
            <div class="text-gray-400 mb-2">Not connected</div>
            <p class="text-sm text-gray-500">You need to be logged in to access settings</p>
          </div>
        </div>
        
        
        <div class="border-t border-gray-700 pt-4">
          <h4 class="text-lg mb-3">Relay Configuration</h4>
          
          <!-- User's NIP-65 Relay List -->
          <div v-if="userRelayList" class="mb-6 p-3 bg-gray-800 rounded-lg">
            <div class="text-green-400 mb-2 flex items-center">
              <span class="mr-2">📡</span>
              Your Announced Relays (NIP-65)
            </div>
            <div class="text-xs text-gray-400 mb-3">
              Last updated: {{ new Date(userRelayList.lastUpdated * 1000).toLocaleString() }}
            </div>
            
            <div v-if="userRelayList.bothRelays.length > 0" class="mb-2">
              <div class="text-sm text-gray-300 mb-1">Read & Write:</div>
              <div class="space-y-1">
                <div 
                  v-for="relay in userRelayList.bothRelays" 
                  :key="relay"
                  class="text-xs font-mono text-gray-200 bg-gray-700 px-2 py-1 rounded"
                >
                  {{ relay }}
                </div>
              </div>
            </div>
            
            <div v-if="userRelayList.writeRelays.length > 0" class="mb-2">
              <div class="text-sm text-gray-300 mb-1">Write Only:</div>
              <div class="space-y-1">
                <div 
                  v-for="relay in userRelayList.writeRelays" 
                  :key="relay"
                  class="text-xs font-mono text-gray-200 bg-gray-700 px-2 py-1 rounded"
                >
                  {{ relay }}
                </div>
              </div>
            </div>
            
            <div v-if="userRelayList.readRelays.length > 0" class="mb-2">
              <div class="text-sm text-gray-300 mb-1">Read Only:</div>
              <div class="space-y-1">
                <div 
                  v-for="relay in userRelayList.readRelays" 
                  :key="relay"
                  class="text-xs font-mono text-gray-200 bg-gray-700 px-2 py-1 rounded"
                >
                  {{ relay }}
                </div>
              </div>
            </div>
            
            <div class="text-xs text-gray-500 mt-2">
              These are your announced relay preferences. The app will use these for publishing when available.
            </div>
          </div>
          
          <div v-else-if="isConnected" class="mb-6 p-3 bg-yellow-900 border border-yellow-600 rounded-lg">
            <div class="text-yellow-200 text-sm">
              ℹ️ No NIP-65 relay list found. You can publish your relay preferences using other Nostr clients to optimize your experience.
            </div>
          </div>
          
          <!-- Manual Relay Configuration -->
          <div class="mb-4 p-3 bg-gray-800 rounded-lg">
            <div class="text-gray-300 mb-3">Manual relay configuration:</div>
            <div class="space-y-1 max-h-60 overflow-y-auto pr-2">
              <div 
                v-for="(relay, index) in relays" 
                :key="index" 
                class="flex items-center justify-between"
              >
                <span class="text-xs font-mono text-gray-200 bg-gray-700 px-2 py-1 rounded flex-grow mr-2 truncate">{{ relay }}</span>
                <button 
                  @click="removeRelay(index)" 
                  class="text-red-500 hover:text-red-400 text-sm"
                  title="Remove relay"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
          
          <div class="flex items-center gap-2 mt-4">
            <input 
              v-model="newRelay" 
              placeholder="wss://relay.example.com" 
              class="input flex-grow"
            />
            <button 
              @click="addRelay" 
              class="btn-secondary whitespace-nowrap"
              :disabled="!isValidRelay"
            >
              Add Relay
            </button>
          </div>
        </div>
      </div>
      
      <div class="card">
        <h3 class="text-xl mb-4">Zombie Settings</h3>
        
        <div class="mb-6">
          <h4 class="text-lg mb-3">Zombie Classification</h4>
          
          <div class="space-y-4">
            <div>
              <label class="block text-gray-300 mb-2">
                Fresh Zombies (days inactive)
              </label>
              <input 
                type="number" 
                v-model.number="thresholds.fresh" 
                min="1" 
                max="365" 
                class="input w-full"
              />
            </div>
            
            <div>
              <label class="block text-gray-300 mb-2">
                Rotting Zombies (days inactive)
              </label>
              <input 
                type="number" 
                v-model.number="thresholds.rotting" 
                min="1" 
                max="365" 
                class="input w-full"
              />
            </div>
            
            <div>
              <label class="block text-gray-300 mb-2">
                Ancient Zombies (days inactive)
              </label>
              <input 
                type="number" 
                v-model.number="thresholds.ancient" 
                min="1" 
                max="1000" 
                class="input w-full"
              />
            </div>
          </div>
        </div>
        
        <div class="border-t border-gray-700 pt-4 mb-6">
          <h4 class="text-lg mb-3">Scan Settings</h4>
          
          <div class="mb-4">
            <label class="flex items-center gap-3">
              <input 
                type="checkbox" 
                v-model="autoBackupOnScan"
                class="h-5 w-5 rounded text-zombie-green focus:ring-zombie-green"
              />
              <span class="text-gray-300">Create backup before scanning</span>
            </label>
            <div class="text-xs text-gray-500 mt-1 ml-8">
              Automatically creates a safety backup of your follow list before each scan
            </div>
          </div>

          <!-- Enhanced scanning disabled due to poor results -->
          <!--
          <div class="mb-4">
            <label class="flex items-center gap-3">
              <input 
                type="checkbox" 
                v-model="useEnhancedScanning"
                class="h-5 w-5 rounded text-zombie-green focus:ring-zombie-green"
              />
              <span class="text-gray-300">Enhanced zombie detection (Recommended)</span>
            </label>
            <div class="text-xs text-gray-500 mt-1 ml-8">
              Uses parallel outbox/inbox relay scanning to reduce false positives and improve accuracy
            </div>
          </div>
          -->
        </div>

        <div class="border-t border-gray-700 pt-4">
          <h4 class="text-lg mb-3">Batch Settings</h4>
          
          <div>
            <label class="block text-gray-300 mb-2">Unfollow batch size</label>
            <div class="flex items-center">
              <input 
                type="range" 
                v-model.number="batchSize" 
                min="5" 
                max="100" 
                step="5" 
                class="w-full mr-3"
              />
              <span class="text-zombie-green font-bold min-w-8 text-center">{{ batchSize }}</span>
            </div>
            <p class="text-sm text-gray-400 mt-1">
              How many zombies to unfollow at once during purging (recommended: 30)
            </p>
          </div>
        </div>
        
        <div class="mt-6">
          <button @click="saveSettings" class="btn-primary">
            Save Settings
          </button>
        </div>
      </div>
    </div>
    
    <div class="mt-6 card">
      <h3 class="text-xl mb-4">🛡️ Zombie Immunity List</h3>
      
      <div v-if="loading" class="text-center py-4">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zombie-green"></div>
        <p class="mt-2 text-gray-400">Loading immunity records...</p>
      </div>
      
      <div v-else>
        <div class="mb-4">
          <p class="text-gray-300 mb-3">
            Manage accounts that have zombie immunity (whitelist).
          </p>
        </div>
        
        <div v-if="immunityRecords.length === 0" class="text-center py-8">
          <div class="text-4xl mb-4">🛡️</div>
          <p class="text-gray-400">No immunity records yet.</p>
          <p class="text-gray-500 text-sm mt-1">
            Use "Grant Immunity" in the zombie hunting interface to add accounts.
          </p>
        </div>
        
        <div v-else>
          <div class="mb-4 text-sm text-gray-400">
            {{ immunityRecords.length }} account{{ immunityRecords.length !== 1 ? 's' : '' }} with immunity
          </div>
          
          <!-- Profile Loading Progress -->
          <div v-if="profilesLoading" class="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-300">Loading profile data...</span>
              <span class="text-xs text-gray-400">{{ immunityRecords.length }} profiles</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2">
              <div class="bg-zombie-green h-2 rounded-full transition-all duration-300 w-1/3"></div>
            </div>
            <div class="text-xs text-gray-500 mt-1">
              Fetching names and avatars...
            </div>
          </div>
          
          <div class="space-y-2 max-h-96 overflow-y-auto pr-2">
            <div 
              v-for="record in immunityRecords" 
              :key="record.pubkey"
              class="flex items-center justify-between p-3 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <div class="flex items-center flex-grow">
                <div class="relative mr-3">
                  <img 
                    :src="getProfilePicture(record.pubkey)" 
                    :alt="getDisplayName(record.pubkey)"
                    class="w-10 h-10 rounded-full object-cover bg-gray-700"
                    @error="handleAvatarError"
                  />
                  <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-700 flex items-center justify-center text-white text-xs border-2 border-gray-900">
                    🛡️
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-gray-200 truncate">
                    {{ getDisplayName(record.pubkey) }}
                  </div>
                  <div class="text-xs text-gray-400 font-mono">
                    {{ formatPubkey(record.pubkey) }}
                  </div>
                  <div class="text-xs text-gray-400 mt-1">
                    {{ record.reason }}
                  </div>
                  <div v-if="record.timestamp" class="text-xs text-gray-500">
                    {{ formatDate(record.timestamp) }}
                  </div>
                </div>
              </div>
              <div class="flex gap-2">
                <button 
                  @click="viewImmuneProfile(record.pubkey)" 
                  class="text-xs px-2 py-1 bg-pleb-blue hover:bg-blue-600 rounded transition-colors"
                  title="View profile"
                >
                  View
                </button>
                <button 
                  @click="revokeImmunity(record.pubkey)" 
                  class="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 rounded transition-colors"
                  title="Revoke immunity"
                >
                  Revoke
                </button>
              </div>
            </div>
          </div>
          
          <div class="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
            <div class="flex flex-wrap gap-2 justify-between items-center">
              <div class="flex gap-2">
                <button @click="exportImmunityList" class="btn-secondary text-sm">
                  Export List
                </button>
                <input 
                  type="file" 
                  ref="immunityFileInput" 
                  accept=".json" 
                  class="hidden" 
                  @change="importImmunityList"
                />
                <button @click="$refs.immunityFileInput.click()" class="btn-secondary text-sm">
                  Import List
                </button>
              </div>
              <button 
                @click="clearAllImmunity" 
                class="btn-danger text-sm"
              >
                Clear All Immunity
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="mt-6 card">
      <h3 class="text-xl mb-4">App Information</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <h4 class="text-lg mb-3">About Plebs vs. Zombies</h4>
          <p class="text-gray-300 mb-2">
            Version: {{ appVersion }}
          </p>
          <p class="text-gray-300 mb-2">
            A utility for Nostr users to manage their follow lists by identifying and removing dormant accounts.
          </p>
          <p class="text-gray-400">
            Made with 🧠 for the Nostr community
          </p>
        </div>
        
        <div>
          <h4 class="text-lg mb-3">Privacy & Data</h4>
          <p class="text-gray-300 mb-2">
            All data is stored locally in your browser.
          </p>
          <p class="text-gray-300 mb-2">
            No data is sent to any servers beyond standard Nostr relay communication.
          </p>
          <p class="text-gray-300">
            Your keys remain secure in your Nostr extension.
          </p>
        </div>
        
        <div>
          <h4 class="text-lg mb-3">Support the Creator</h4>
          <p class="text-gray-300 mb-3">
            Like this app? Show your support!
          </p>
          <div class="space-y-2">
            <a 
              href="https://jumble.social/users/npub1pvz2c9z4pau26xdwfya24d0qhn6ne8zp9vwjuyxw629wkj9vh5lsrrsd4h" 
              target="_blank"
              class="flex items-center gap-2 text-sm px-3 py-2 bg-purple-700 hover:bg-purple-600 rounded transition-colors"
            >
              🟣 Follow on Nostr
            </a>
            <button 
              @click="showZapModal"
              class="flex items-center gap-2 text-sm px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-black rounded transition-colors w-full"
            >
              ⚡ Zap the Creator
            </button>
            <a 
              href="https://github.com/dmnyc/plebs-vs-zombies" 
              target="_blank"
              class="flex items-center gap-2 text-sm px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              🤓 View on GitHub
            </a>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            Contribute code, report issues, or just say thanks!
          </p>
        </div>
      </div>
    </div>

    <!-- Zap Modal -->
    <div 
      v-if="zapModal.show" 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
      @click="closeZapModal"
    >
      <div class="bg-zombie-dark border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4" @click.stop>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-yellow-400 flex items-center gap-2">
            ⚡ Zap the Creator
          </h3>
          <button 
            @click="closeZapModal"
            class="text-gray-400 hover:text-gray-200 text-xl"
          >
            ×
          </button>
        </div>
        
        <div class="text-center space-y-4">
          <div class="text-gray-300">
            Show your appreciation for Plebs vs Zombies!
          </div>
          
          <!-- QR Code -->
          <div class="flex justify-center">
            <div class="bg-white p-4 rounded-lg">
              <img 
                :src="zapModal.qrCode" 
                alt="Lightning Address QR Code"
                class="w-48 h-48"
              />
            </div>
          </div>
          
          <!-- Lightning Address -->
          <div class="space-y-2">
            <div class="text-sm text-gray-400">Lightning Address:</div>
            <div class="flex items-center gap-2">
              <code class="bg-gray-800 px-3 py-2 rounded text-yellow-400 text-sm flex-grow text-center">
                {{ zapModal.lightningAddress }}
              </code>
              <button 
                @click="copyLightningAddress"
                class="bg-gray-700 hover:bg-gray-600 px-2 py-2 rounded"
                title="Copy Lightning Address"
              >
                📋
              </button>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="flex gap-3 mt-6">
            <button 
              @click="zapOnNostr"
              class="flex-1 bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded transition-colors"
            >
              Zap on Nostr
            </button>
            <button 
              @click="closeZapModal"
              class="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import nostrService from '../services/nostrService';
import zombieService from '../services/zombieService';
import immunityService from '../services/immunityService';
import { format } from 'date-fns';
import { nip19 } from 'nostr-tools';
import { getVersionSync } from '../utils/version';
import Nip46Connection from '../components/Nip46Connection.vue';

export default {
  name: 'SettingsView',
  components: {
    Nip46Connection
  },
  data() {
    return {
      isConnected: false,
      pubkey: null,
      npub: null,
      relays: [],
      newRelay: '',
      thresholds: {
        fresh: 180,
        rotting: 365,
        ancient: 730
      },
      batchSize: 30,
      autoBackupOnScan: true,
      useEnhancedScanning: false,
      loading: false,
      immunityRecords: [],
      profilesLoading: false,
      profileData: new Map(),
      userRelayList: null,
      signingMethod: nostrService.getSigningMethod() || 'nip07', // Track current signing method
      isBunkerConnected: false, // Track NIP-46 connection status
      zapModal: {
        show: false,
        lightningAddress: 'plebsvszombies@rizful.com',
        qrCode: ''
      }
    };
  },
  computed: {
    isValidRelay() {
      if (!this.newRelay) return false;
      
      try {
        const url = new URL(this.newRelay);
        return url.protocol === 'wss:' || url.protocol === 'ws:';
      } catch (error) {
        return false;
      }
    },
    appVersion() {
      return getVersionSync();
    }
  },
  methods: {
    goToZombieHunting() {
      this.$emit('navigate', 'hunting');
      // If the parent App doesn't handle navigate event, use router or direct method
      if (this.$parent && this.$parent.setActiveView) {
        this.$parent.setActiveView('hunting');
      }
    },

    updateConnectionStatus() {
      // Get the current signing method from nostrService (source of truth)
      this.signingMethod = nostrService.getSigningMethod();
      
      console.log('🔍 Settings updateConnectionStatus:', {
        signingMethod: this.signingMethod,
        hasPubkey: !!nostrService.pubkey,
        extensionConnected: nostrService.extensionConnected,
        nip46Connected: nostrService.nip46Service?.isConnected()
      });
      
      // Get connection status from nostrService
      this.isConnected = !!(nostrService.pubkey && 
        ((nostrService.getSigningMethod() === 'nip07' && nostrService.extensionConnected) ||
         (nostrService.getSigningMethod() === 'nip46' && nostrService.nip46Service.isConnected())));
      
      console.log('✅ Settings connection status result:', this.isConnected);
      
      // Get pubkey and npub from nostrService if connected
      if (this.isConnected && nostrService.pubkey) {
        this.pubkey = nostrService.pubkey;
        this.npub = nostrService.hexToNpub(this.pubkey);
      } else {
        this.pubkey = null;
        this.npub = null;
      }
      
      // Update bunker connection status
      if (this.signingMethod === 'nip07') {
        this.isBunkerConnected = false;
      } else if (this.signingMethod === 'nip46') {
        this.isBunkerConnected = nostrService.isBunkerReady();
      }
      
      console.log('🔄 Settings connection status updated:', {
        signingMethod: this.signingMethod,
        isConnected: this.isConnected,
        hasPubkey: !!this.pubkey
      });
    },

    logout() {
      // Call the proper logout function from nostrService
      nostrService.logout();
      
      // Update local state
      this.isConnected = false;
      this.pubkey = null;
      this.npub = null;
      this.isBunkerConnected = false;
      
      // Update connection status to reflect logout
      this.updateConnectionStatus();
      
      // Emit logout event to parent App component to handle navigation
      this.$emit('logout');
      
      console.log('✅ Logged out completely from Settings');
    },
    copyToClipboard(text) {
      navigator.clipboard.writeText(text)
        .then(() => {
          alert('Copied to clipboard!');
        })
        .catch(err => {
          console.error('Failed to copy text:', err);
        });
    },
    addRelay() {
      if (!this.isValidRelay) return;
      
      if (!this.relays.includes(this.newRelay)) {
        this.relays.push(this.newRelay);
        this.newRelay = '';
      }
    },
    removeRelay(index) {
      this.relays.splice(index, 1);
    },
    formatDate(timestamp) {
      if (!timestamp) return 'Unknown';
      
      try {
        // Nostr timestamps are Unix timestamps in seconds
        // Convert to milliseconds for JavaScript Date
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
      } catch (error) {
        console.warn('Failed to format timestamp:', timestamp, error);
        return 'Invalid date';
      }
    },
    async saveSettings() {
      try {
        // Save zombie thresholds
        zombieService.setThresholds(
          this.thresholds.fresh,
          this.thresholds.rotting,
          this.thresholds.ancient
        );
        
        // Save batch size
        zombieService.setBatchSize(this.batchSize);
        
        // Save auto backup setting
        localStorage.setItem('autoBackupOnScan', JSON.stringify(this.autoBackupOnScan));
        
        // Save enhanced scanning setting
        localStorage.setItem('useEnhancedScanning', JSON.stringify(this.useEnhancedScanning));
        
        // Save relays
        nostrService.relays = [...this.relays];
        
        alert('Settings saved successfully!');
      } catch (error) {
        console.error('Failed to save settings:', error);
        alert('Failed to save settings. See console for details.');
      }
    },
    loadSettings() {
      // Load zombie thresholds
      this.thresholds = {
        fresh: zombieService.zombieThresholds.fresh,
        rotting: zombieService.zombieThresholds.rotting,
        ancient: zombieService.zombieThresholds.ancient
      };
      
      // Load batch size
      this.batchSize = zombieService.batchSize;
      
      // Load auto backup setting
      const autoBackupSetting = localStorage.getItem('autoBackupOnScan');
      this.autoBackupOnScan = autoBackupSetting !== null ? JSON.parse(autoBackupSetting) : true;
      
      // Load enhanced scanning setting
      const enhancedScanningSetting = localStorage.getItem('useEnhancedScanning');
      this.useEnhancedScanning = enhancedScanningSetting !== null ? JSON.parse(enhancedScanningSetting) : false;
      
      // Load relays
      this.relays = [...nostrService.relays];
      
      // Load user's NIP-65 relay list
      this.userRelayList = nostrService.userRelayList;
      
      // Check if connected
      this.isConnected = !!nostrService.pubkey;
      if (this.isConnected) {
        this.pubkey = nostrService.pubkey;
        this.npub = nostrService.hexToNpub(this.pubkey);
      }
    },
    async loadImmunityRecords() {
      this.loading = true;
      try {
        await immunityService.init();
        this.immunityRecords = await immunityService.getAllImmunityRecords();
        
        // Fetch profile data for immunity records
        if (this.immunityRecords.length > 0) {
          this.fetchImmunityProfiles();
        }
      } catch (error) {
        console.error('Failed to load immunity records:', error);
      } finally {
        this.loading = false;
      }
    },
    
    async fetchImmunityProfiles() {
      if (this.immunityRecords.length === 0) return;
      
      this.profilesLoading = true;
      try {
        const pubkeys = this.immunityRecords.map(record => record.pubkey);
        console.log(`Fetching profiles for ${pubkeys.length} immunity records...`);
        
        this.profileData = await nostrService.getProfileMetadata(pubkeys, (progress) => {
          // Optional: could add progress callback here
          console.log('Profile loading progress:', progress);
        });
        
        console.log(`Loaded ${this.profileData.size} profiles for immunity records`);
      } catch (error) {
        console.error('Failed to fetch immunity profiles:', error);
      } finally {
        this.profilesLoading = false;
      }
    },
    formatPubkey(pubkey) {
      if (!pubkey) return '';
      return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8);
    },
    
    getProfileForPubkey(pubkey) {
      return this.profileData.get(pubkey) || null;
    },
    
    getDisplayName(pubkey) {
      const profile = this.getProfileForPubkey(pubkey);
      if (profile && (profile.display_name || profile.name)) {
        return profile.display_name || profile.name;
      }
      return this.formatPubkey(pubkey);
    },
    
    getProfilePicture(pubkey) {
      const profile = this.getProfileForPubkey(pubkey);
      return profile?.picture || '/default-avatar.svg';
    },
    
    handleAvatarError(event) {
      event.target.src = '/default-avatar.svg';
    },
    formatDate(timestamp) {
      if (!timestamp) return '';
      return format(new Date(timestamp), 'MMM d, yyyy');
    },
    viewImmuneProfile(pubkey) {
      try {
        const npub = nip19.npubEncode(pubkey);
        const profileUrl = `https://primal.net/profile/${npub}`;
        window.open(profileUrl, '_blank');
      } catch (error) {
        console.error('Failed to generate profile URL:', error);
        navigator.clipboard.writeText(pubkey).then(() => {
          alert('Pubkey copied to clipboard');
        });
      }
    },
    async revokeImmunity(pubkey) {
      const record = this.immunityRecords.find(r => r.pubkey === pubkey);
      const displayPubkey = this.formatPubkey(pubkey);
      
      if (!confirm(`Revoke immunity for ${displayPubkey}?\n\nReason: ${record?.reason || 'Unknown'}\n\nThis account will appear in future zombie scans.`)) {
        return;
      }
      
      try {
        await immunityService.revokeImmunity(pubkey);
        await this.loadImmunityRecords();
        alert('Immunity revoked successfully!');
      } catch (error) {
        console.error('Failed to revoke immunity:', error);
        alert('Failed to revoke immunity. See console for details.');
      }
    },
    async clearAllImmunity() {
      if (!confirm(`Clear ALL immunity records?\n\nThis will remove immunity for ${this.immunityRecords.length} accounts.\n\nThis action cannot be undone!`)) {
        return;
      }
      
      if (!confirm('Are you absolutely sure? This will remove all whitelist entries.')) {
        return;
      }
      
      try {
        await immunityService.clearAllImmunity();
        await this.loadImmunityRecords();
        alert('All immunity records cleared!');
      } catch (error) {
        console.error('Failed to clear immunity records:', error);
        alert('Failed to clear immunity records. See console for details.');
      }
    },
    async exportImmunityList() {
      try {
        const result = await immunityService.exportImmunityList();
        if (result.success) {
          alert(`Immunity list exported as ${result.filename}`);
        } else {
          alert(`Failed to export: ${result.error}`);
        }
      } catch (error) {
        console.error('Failed to export immunity list:', error);
        alert('Failed to export immunity list. See console for details.');
      }
    },
    async importImmunityList(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const result = await immunityService.importImmunityList(e.target.result);
            if (result.success) {
              await this.loadImmunityRecords();
              alert(`Successfully imported ${result.imported} immunity records!`);
            } else {
              alert(`Failed to import: ${result.error}`);
            }
          } catch (error) {
            console.error('Failed to import immunity list:', error);
            alert('Failed to import immunity list. See console for details.');
          }
        };
        reader.readAsText(file);
      } catch (error) {
        console.error('Failed to read file:', error);
        alert('Failed to read file. See console for details.');
      }
      
      // Reset file input
      event.target.value = '';
    },
    showZapModal() {
      // Generate QR code for the Lightning address
      this.generateQRCode();
      this.zapModal.show = true;
    },
    closeZapModal() {
      this.zapModal.show = false;
    },
    generateQRCode() {
      // Generate QR code URL using a QR service
      const lightningAddress = this.zapModal.lightningAddress;
      this.zapModal.qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('lightning:' + lightningAddress)}`;
    },
    copyLightningAddress() {
      navigator.clipboard.writeText(this.zapModal.lightningAddress)
        .then(() => {
          // Show brief success feedback
          const button = event.target;
          const originalText = button.innerHTML;
          button.innerHTML = '✅';
          setTimeout(() => {
            button.innerHTML = originalText;
          }, 1500);
        })
        .catch(err => {
          console.error('Failed to copy Lightning address:', err);
        });
    },
    zapOnNostr() {
      const creatorNpub = 'npub1pvz2c9z4pau26xdwfya24d0qhn6ne8zp9vwjuyxw629wkj9vh5lsrrsd4h';
      const nostrUrl = `https://jumble.social/users/${creatorNpub}`;
      window.open(nostrUrl, '_blank');
    }
  },
  async mounted() {
    this.loadSettings();
    await this.loadImmunityRecords();
    
    // Update connection status from nostrService (single source of truth)
    this.updateConnectionStatus();
    
    // Load additional data if connected
    if (this.isConnected) {
      try {
        // Load relays
        this.relays = [...nostrService.relays];
        
        // Load user's NIP-65 relay list if available
        this.userRelayList = nostrService.userRelayList;
        console.log('📋 Initial userRelayList from nostrService:', !!this.userRelayList);
        
        // If we don't have relay list yet, try to fetch it
        if (!this.userRelayList && nostrService.pubkey) {
          try {
            console.log('🔄 Settings: Fetching user relay list for pubkey:', nostrService.pubkey.substring(0, 8) + '...');
            console.log('📋 Settings: Before fetch - userRelayList:', !!this.userRelayList);
            await nostrService.fetchUserRelayList();
            this.userRelayList = nostrService.userRelayList;
            console.log('✅ Settings: After fetch - userRelayList:', !!this.userRelayList);
            if (this.userRelayList) {
              console.log('📋 Relay list details:', {
                readRelays: Object.keys(this.userRelayList).filter(url => this.userRelayList[url].read).length,
                writeRelays: Object.keys(this.userRelayList).filter(url => this.userRelayList[url].write).length
              });
            }
          } catch (relayError) {
            console.warn('⚠️ Could not load user relay list:', relayError);
          }
        } else if (!nostrService.pubkey) {
          console.warn('⚠️ Cannot fetch relay list - nostrService.pubkey not available');
        }
      } catch (error) {
        console.warn('Could not load settings data:', error);
      }
    }
  }
};
</script>