<template>
  <div>
    <h2 class="text-2xl mb-6">Settings</h2>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card">
        <h3 class="text-xl mb-4">Nostr Settings</h3>
        
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
              v-if="!isConnected" 
              @click="connectNostr" 
              class="btn-primary flex-grow"
            >
              Connect to Nostr
            </button>
            <button 
              v-else 
              @click="disconnectNostr" 
              class="btn-danger flex-grow"
            >
              Disconnect
            </button>
          </div>
        </div>
        
        <div class="border-t border-gray-700 pt-4">
          <h4 class="text-lg mb-3">Relay Configuration</h4>
          
          <div class="mb-4">
            <div class="text-gray-300 mb-2">Active relays:</div>
            <div class="space-y-2 max-h-60 overflow-y-auto pr-2">
              <div 
                v-for="(relay, index) in relays" 
                :key="index" 
                class="flex items-center p-2 border border-gray-700 rounded-lg"
              >
                <span class="font-mono text-sm truncate flex-grow">{{ relay }}</span>
                <button 
                  @click="removeRelay(index)" 
                  class="text-red-500 hover:text-red-400 ml-2"
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
        
        <div class="border-t border-gray-700 pt-4">
          <h4 class="text-lg mb-3">Batch Settings</h4>
          
          <div>
            <label class="block text-gray-300 mb-2">Default batch size for zombie purging</label>
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
              Recommended: 30 zombies per batch
            </p>
          </div>
        </div>
        
        <div class="mt-6">
          <button @click="saveSettings" class="btn-primary w-full">
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
        <div class="mb-4 flex justify-between items-center">
          <p class="text-gray-300">
            Manage accounts that have zombie immunity (whitelist).
          </p>
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
            <button 
              @click="clearAllImmunity" 
              class="btn-danger text-sm w-full"
            >
              Clear All Immunity (Use with caution!)
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="mt-6 card">
      <h3 class="text-xl mb-4">App Information</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 class="text-lg mb-3">About Plebs vs. Zombies</h4>
          <p class="text-gray-300 mb-2">
            Version: 0.1.0
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

export default {
  name: 'SettingsView',
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
      loading: false,
      immunityRecords: []
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
    }
  },
  methods: {
    async connectNostr() {
      try {
        const pubkey = await nostrService.getPublicKey();
        this.pubkey = pubkey;
        this.npub = nostrService.hexToNpub(pubkey);
        this.isConnected = true;
        
        // Load relays
        this.relays = [...nostrService.relays];
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
      
      // Load relays
      this.relays = [...nostrService.relays];
      
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
    }
  },
  async mounted() {
    this.loadSettings();
    await this.loadImmunityRecords();
  }
};
</script>