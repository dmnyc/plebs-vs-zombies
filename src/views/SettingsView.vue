<template>
  <div>
    <h2 class="text-2xl mb-6">Settings</h2>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card">
        <h3 class="text-xl mb-4">Nostr Settings</h3>
        
        <!-- Signing Method Selection -->
        <div class="mb-6">
          <h4 class="text-lg mb-3">Signing Method</h4>
          <div class="space-y-3">
            <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
              <input 
                type="radio" 
                value="nip07" 
                v-model="signingMethod" 
                class="w-4 h-4 text-zombie-green focus:ring-zombie-green"
                @change="onSigningMethodChange"
              />
              <div class="flex-grow">
                <span class="text-gray-200 font-medium">Browser Extension (NIP-07)</span>
                <p class="text-sm text-gray-400">Use Alby, nos2x, or other browser extensions</p>
              </div>
              <div v-if="signingMethod === 'nip07' && isConnected" class="text-zombie-green">
                <span class="w-2 h-2 bg-zombie-green rounded-full inline-block"></span>
              </div>
            </label>
            
            <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
              <input 
                type="radio" 
                value="nip46" 
                v-model="signingMethod" 
                class="w-4 h-4 text-zombie-green focus:ring-zombie-green"
                @change="onSigningMethodChange"
              />
              <div class="flex-grow">
                <span class="text-gray-200 font-medium">Remote Signer (NIP-46)</span>
                <p class="text-sm text-gray-400">Connect to nsec.app, nsecBunker, or other remote signers</p>
              </div>
              <div v-if="signingMethod === 'nip46' && isBunkerConnected" class="text-zombie-green">
                <span class="w-2 h-2 bg-zombie-green rounded-full inline-block"></span>
              </div>
            </label>
          </div>
        </div>
        
        <!-- Connection Status -->
        <div class="mb-6">
          <div class="flex justify-between items-center mb-2">
            <span class="text-gray-300">Connection status:</span>
            <span class="font-bold" :class="isConnected ? 'text-zombie-green' : 'text-red-500'">
              {{ isConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
          
          <div v-if="isConnected" class="mb-4">
            <div class="text-gray-300 mb-1">Your public key:</div>
            <div class="flex items-center">
              <span class="font-mono text-sm bg-gray-800 p-2 rounded-l border border-gray-700 truncate flex-grow">
                {{ npub }}
              </span>
              <button 
                @click="copyToClipboard(npub)" 
                class="bg-gray-700 border border-l-0 border-gray-700 p-2 rounded-r hover:bg-gray-600"
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
          </div>
          
          <div class="flex gap-3">
            <button 
              v-if="!isConnected && signingMethod === 'nip07'" 
              @click="connectNostr" 
              class="btn-primary"
            >
              Connect Extension
            </button>
            <button 
              v-else-if="isConnected" 
              @click="disconnectNostr" 
              class="btn-danger"
            >
              Disconnect
            </button>
          </div>
        </div>
        
        <!-- NIP-46 Connection Component -->
        <div v-if="signingMethod === 'nip46'" class="mb-6">
          <Nip46Connection 
            @connected="onBunkerConnected"
            @disconnected="onBunkerDisconnected"
          />
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
          
          <div class="space-y-2 max-h-96 overflow-y-auto pr-2">
            <div 
              v-for="record in immunityRecords" 
              :key="record.pubkey"
              class="flex items-center justify-between p-3 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <div class="flex items-center flex-grow">
                <div class="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center text-white text-xs mr-3">
                  🛡️
                </div>
                <div>
                  <div class="font-mono text-sm">
                    {{ formatPubkey(record.pubkey) }}
                  </div>
                  <div class="text-xs text-gray-400">
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
              👨‍💻 View on GitHub
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
      userRelayList: null,
      signingMethod: 'nip07', // Track current signing method
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
    onSigningMethodChange() {
      console.log('Signing method changed to:', this.signingMethod);
      nostrService.setSigningMethod(this.signingMethod);
      
      // Save the signing method preference
      localStorage.setItem('signingMethod', this.signingMethod);
      
      this.updateConnectionStatus();
    },

    onBunkerConnected(result) {
      console.log('Bunker connected:', result);
      this.isBunkerConnected = true;
      this.pubkey = result.pubkey;
      this.npub = nostrService.hexToNpub(result.pubkey);
      this.isConnected = true;
      
      // Emit event to notify App.vue about successful connection
      window.dispatchEvent(new CustomEvent('nip46-connected', {
        detail: result
      }));
    },

    onBunkerDisconnected() {
      console.log('Bunker disconnected');
      this.isBunkerConnected = false;
      this.pubkey = null;
      this.npub = null;
      this.isConnected = false;
    },

    updateConnectionStatus() {
      if (this.signingMethod === 'nip07') {
        this.isConnected = nostrService.isExtensionReady();
        this.isBunkerConnected = false;
      } else if (this.signingMethod === 'nip46') {
        this.isBunkerConnected = nostrService.isBunkerReady();
        this.isConnected = this.isBunkerConnected;
      }
    },

    async connectNostr() {
      try {
        const pubkey = await nostrService.getPublicKey();
        this.pubkey = pubkey;
        this.npub = nostrService.hexToNpub(pubkey);
        this.isConnected = true;
        
        // Load relays
        this.relays = [...nostrService.relays];
        
        // Load user's NIP-65 relay list
        this.userRelayList = nostrService.userRelayList;
      } catch (error) {
        console.error('Failed to connect to Nostr:', error);
        alert('Failed to connect to Nostr. Please check your extension is installed and working.');
      }
    },
    disconnectNostr() {
      this.isConnected = false;
      this.pubkey = null;
      this.npub = null;
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
      } catch (error) {
        console.error('Failed to load immunity records:', error);
      } finally {
        this.loading = false;
      }
    },
    formatPubkey(pubkey) {
      if (!pubkey) return '';
      return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8);
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
    
    // Initialize signing method from localStorage
    const savedSigningMethod = localStorage.getItem('signingMethod');
    if (savedSigningMethod && ['nip07', 'nip46'].includes(savedSigningMethod)) {
      this.signingMethod = savedSigningMethod;
      nostrService.setSigningMethod(this.signingMethod);
    }
    
    // Update connection status for current signing method
    this.updateConnectionStatus();
    
    // If NIP-46 was previously selected, try to restore connection
    if (this.signingMethod === 'nip46') {
      try {
        const restored = await nostrService.nip46Service.restoreConnection();
        if (restored) {
          console.log('✅ NIP-46 connection restored from previous session');
          this.updateConnectionStatus();
          if (this.isBunkerConnected) {
            const pubkey = await nostrService.nip46Service.getPublicKey();
            this.pubkey = pubkey;
            this.npub = nostrService.hexToNpub(pubkey);
            this.isConnected = true;
          }
        }
      } catch (error) {
        console.warn('Failed to restore NIP-46 connection:', error.message);
      }
    }
  }
};
</script>