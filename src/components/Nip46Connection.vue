<template>
  <div class="card">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xl font-semibold text-gray-100">Remote Signer (NIP-46)</h3>
      <div v-if="connectionStatus.connected" class="flex items-center gap-2">
        <span class="w-2 h-2 bg-zombie-green rounded-full"></span>
        <span class="text-sm text-zombie-green">Connected</span>
      </div>
    </div>

    <!-- Connection Status -->
    <div v-if="connectionStatus.connected" class="mb-6">
      <div class="bg-gray-900 rounded-lg p-4 space-y-2">
        <div class="flex justify-between items-center">
          <span class="text-gray-300">Status:</span>
          <span class="text-zombie-green font-medium">✅ Connected to bunker</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-300">Bunker:</span>
          <span class="text-gray-100 font-mono text-sm">
            {{ connectionStatus.bunkerPubkey?.substring(0, 8) }}...
          </span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-300">Relay:</span>
          <span class="text-gray-100 text-sm">
            {{ connectionStatus.bunkerRelays?.[0] }}
          </span>
        </div>
      </div>
      
      <div class="mt-4 flex justify-between items-center">
        <p class="text-gray-400 text-sm">
          Your bunker will handle all signing requests
        </p>
        <button 
          @click="disconnect"
          :disabled="disconnecting"
          class="btn-secondary text-sm"
        >
          {{ disconnecting ? 'Disconnecting...' : 'Disconnect' }}
        </button>
      </div>
    </div>

    <!-- Connection Form -->
    <div v-else class="space-y-4">
      <!-- Reconnect Saved Connection -->
      <div v-if="hasSavedConnection" class="bg-green-900 border border-green-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-green-400 font-medium mb-1">Saved Connection Available</h4>
            <p class="text-sm text-green-300">You have a previously authorized bunker connection</p>
          </div>
          <div class="flex gap-2">
            <button 
              @click="deleteSavedConnection"
              :disabled="reconnecting || deleting"
              class="btn-secondary text-sm"
            >
              {{ deleting ? 'Deleting...' : '🗑️ Delete' }}
            </button>
            <button 
              @click="reconnectSavedConnection"
              :disabled="reconnecting || deleting"
              class="btn-primary"
            >
              {{ reconnecting ? 'Reconnecting...' : '🔄 Reconnect' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Separator -->
      <div v-if="hasSavedConnection" class="flex items-center justify-center text-gray-500 text-sm">
        <div class="border-t border-gray-600 flex-grow"></div>
        <span class="px-3 bg-zombie-dark">or connect manually</span>
        <div class="border-t border-gray-600 flex-grow"></div>
      </div>

      <div v-if="connecting" class="bg-blue-900 rounded-lg p-4 text-center">
        <div class="flex items-center justify-center gap-2">
          <div class="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
          <span class="text-blue-400">Connecting to bunker...</span>
        </div>
        <p class="text-sm text-gray-300 mt-2">This may take a few seconds</p>
      </div>

      <!-- Connection Method Selector -->
      <div class="flex border border-gray-600 rounded-lg p-1 mb-4">
        <button
          @click="connectionMethod = 'bunker-url'"
          :class="connectionMethod === 'bunker-url' 
            ? 'bg-gray-700 text-gray-100' 
            : 'text-gray-400 hover:text-gray-200'"
          class="flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Use Bunker URL
        </button>
        <button
          @click="connectionMethod = 'generate-string'"
          :class="connectionMethod === 'generate-string' 
            ? 'bg-gray-700 text-gray-100' 
            : 'text-gray-400 hover:text-gray-200'"
          class="flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Generate Connection String
        </button>
      </div>

      <!-- Bunker URL Method (existing) -->
      <div v-if="connectionMethod === 'bunker-url'" class="space-y-3">
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-300">
            Bunker URL
          </label>
          <div class="relative">
            <input 
              v-model="bunkerUrl" 
              type="text"
              placeholder="bunker://..."
              class="input w-full pr-10"
              @paste="handleUrlPaste"
              :disabled="connecting"
            />
            <button
              v-if="bunkerUrl"
              @click="bunkerUrl = ''"
              class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <p class="text-xs text-gray-500">
            Copy a bunker URL from your remote signer app
          </p>
        </div>

        <button 
          @click="connect"
          :disabled="connecting || !bunkerUrl.trim()"
          class="btn-primary w-full"
        >
          {{ connecting ? 'Connecting...' : 'Connect to Bunker' }}
        </button>
      </div>

      <!-- Generate Connection String Method -->
      <div v-if="connectionMethod === 'generate-string'" class="space-y-3">
        <div class="text-center">
          <p class="text-sm text-gray-300 mb-3">
            Generate a connection string to paste into your signer app
          </p>
          
          <button 
            v-if="!generatedConnectionString"
            @click="generateConnectionString"
            :disabled="generatingString"
            class="btn-primary"
          >
            {{ generatingString ? 'Generating...' : 'Generate Connection String' }}
          </button>
          
          <!-- Generated Connection String Display -->
          <div v-if="generatedConnectionString" class="space-y-3">
            <div class="bg-gray-800 rounded-lg p-4 border border-gray-600">
              <p class="text-sm text-gray-300 mb-2">Copy this connection string:</p>
              <div class="flex items-center gap-2">
                <code class="bg-gray-900 px-2 py-1 rounded text-xs text-green-400 flex-1 text-left font-mono break-all">
                  {{ generatedConnectionString }}
                </code>
                <button 
                  @click="copyConnectionString"
                  class="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs"
                  :class="connectionStringCopied ? 'text-green-400' : 'text-gray-300'"
                >
                  {{ connectionStringCopied ? '✅' : '📋' }}
                </button>
              </div>
            </div>
            
            <div class="text-xs text-gray-400">
              <p>📱 Paste this string into your signer app (nsec.app, etc.)</p>
              <p>🔄 Your signer will connect back to complete the setup</p>
              <p class="text-blue-400 mt-2">👂 App is now listening for your signer to connect...</p>
            </div>
            
            <button 
              @click="resetConnectionString"
              class="btn-secondary text-sm"
            >
              Generate New String
            </button>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="bg-red-900 border border-red-700 rounded-lg p-3">
        <div class="flex items-start gap-2">
          <span class="text-red-400 mt-0.5">⚠️</span>
          <div class="flex-1">
            <p class="text-red-400 text-sm font-medium">Connection Failed</p>
            <p class="text-red-300 text-xs mt-1">{{ error }}</p>
          </div>
          <button 
            @click="error = null"
            class="text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Help Section -->
      <div class="bg-gray-900 rounded-lg p-4">
        <h4 class="text-sm font-medium text-gray-200 mb-2">
          🔗 Get a Bunker URL
        </h4>
        <p class="text-xs text-gray-400 mb-3">
          You need a remote signer (bunker) to provide the connection URL. Popular options:
        </p>
        <div class="space-y-2">
          <a 
            href="https://nsec.app" 
            target="_blank"
            class="flex items-center gap-2 text-xs px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            <span class="w-2 h-2 bg-blue-400 rounded-full"></span>
            nsec.app - Web-based bunker service
            <span class="ml-auto">↗</span>
          </a>
          <a 
            href="https://nsecbunker.com" 
            target="_blank"
            class="flex items-center gap-2 text-xs px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            <span class="w-2 h-2 bg-green-400 rounded-full"></span>
            nsecBunker - Self-hosted option
            <span class="ml-auto">↗</span>
          </a>
        </div>
        <div class="mt-3 p-2 bg-gray-800 rounded text-xs">
          <p class="text-gray-400">
            <strong class="text-gray-300">How it works:</strong> Your private keys stay in the bunker app. 
            When Plebs vs Zombies needs to sign events, it sends requests to your bunker for approval.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import nostrService from '../services/nostrService';

export default {
  name: 'Nip46Connection',
  data() {
    return {
      bunkerUrl: '',
      connecting: false,
      disconnecting: false,
      error: null,
      connectionMethod: 'bunker-url',
      generatedConnectionString: '',
      generatingString: false,
      connectionStringCopied: false,
      reconnecting: false,
      deleting: false,
      connectionStatus: {
        connected: false,
        connecting: false,
        bunkerPubkey: null,
        bunkerRelays: [],
        hasLocalKey: false
      }
    };
  },
  mounted() {
    this.updateConnectionStatus();
  },
  computed: {
    hasSavedConnection() {
      return !this.connectionStatus.connected && nostrService.nip46Service.hasSavedConnection();
    }
  },
  methods: {
    updateConnectionStatus() {
      this.connectionStatus = nostrService.nip46Service.getConnectionStatus();
    },

    async connect() {
      if (!this.bunkerUrl.trim()) {
        this.error = 'Please enter a bunker URL';
        return;
      }

      this.connecting = true;
      this.error = null;

      try {
        console.log('🔌 Attempting to connect to bunker...');
        const result = await nostrService.nip46Service.connectWithBunkerUrl(this.bunkerUrl.trim());
        
        console.log('✅ Bunker connection successful:', result);
        
        // Switch nostrService to NIP-46 mode
        nostrService.setSigningMethod('nip46');
        
        // Set the pubkey in nostrService
        nostrService.pubkey = result.pubkey;
        console.log('✅ Set nostrService.pubkey:', result.pubkey.substring(0, 8) + '...');
        
        // Update connection status
        this.updateConnectionStatus();
        
        // Clear the URL input
        this.bunkerUrl = '';
        
        this.$emit('connected', result);
        
      } catch (error) {
        console.error('❌ Bunker connection failed:', error);
        this.error = error.message;
      } finally {
        this.connecting = false;
      }
    },

    async disconnect() {
      this.disconnecting = true;
      
      try {
        // When user explicitly disconnects in settings, clear the saved connection
        await nostrService.nip46Service.disconnect(true);
        
        // Switch back to NIP-07 mode
        nostrService.setSigningMethod('nip07');
        
        // Update connection status
        this.updateConnectionStatus();
        
        this.$emit('disconnected');
        
      } catch (error) {
        console.error('❌ Disconnect failed:', error);
        this.error = 'Failed to disconnect: ' + error.message;
      } finally {
        this.disconnecting = false;
      }
    },

    async generateConnectionString() {
      this.generatingString = true;
      this.error = null;

      try {
        console.log('🔗 Generating connection string...');
        const result = await nostrService.nip46Service.generateConnectionString();
        this.generatedConnectionString = result.connectionString;
        console.log('✅ Connection string generated:', result.connectionString);
        
        // Start listening for bunker connection
        console.log('👂 Starting to listen for bunker connection...');
        await nostrService.nip46Service.startListeningForConnection(result);
        console.log('✅ Now listening for bunker connection');
        
      } catch (error) {
        console.error('❌ Failed to generate connection string:', error);
        this.error = 'Failed to generate connection string: ' + error.message;
      } finally {
        this.generatingString = false;
      }
    },

    async copyConnectionString() {
      try {
        await navigator.clipboard.writeText(this.generatedConnectionString);
        this.connectionStringCopied = true;
        setTimeout(() => {
          this.connectionStringCopied = false;
        }, 2000);
      } catch (error) {
        console.error('❌ Failed to copy to clipboard:', error);
        this.error = 'Failed to copy to clipboard';
      }
    },

    resetConnectionString() {
      this.generatedConnectionString = '';
      this.connectionStringCopied = false;
    },

    async reconnectSavedConnection() {
      this.reconnecting = true;
      this.error = null;

      try {
        console.log('🔄 Attempting to reconnect with saved connection...');
        const result = await nostrService.nip46Service.restoreConnection();
        
        if (result) {
          console.log('✅ Reconnected successfully');
          
          // Switch nostrService to NIP-46 mode
          nostrService.setSigningMethod('nip46');
          
          // Set the pubkey in nostrService
          nostrService.pubkey = await nostrService.nip46Service.getPublicKey();
          
          // Update connection status
          this.updateConnectionStatus();
          
          this.$emit('connected', { pubkey: nostrService.pubkey });
        } else {
          throw new Error('Failed to restore saved connection');
        }
        
      } catch (error) {
        console.error('❌ Reconnect failed:', error);
        this.error = error.message;
      } finally {
        this.reconnecting = false;
      }
    },

    async deleteSavedConnection() {
      this.deleting = true;
      this.error = null;

      try {
        console.log('🗑️ Deleting saved connection...');
        nostrService.nip46Service.clearSavedConnection();
        console.log('✅ Saved connection deleted');
        
        // Update the connection status to reflect the change
        this.updateConnectionStatus();
      } catch (error) {
        console.error('❌ Failed to delete saved connection:', error);
        this.error = 'Failed to delete saved connection: ' + error.message;
      } finally {
        this.deleting = false;
      }
    },

    handleUrlPaste(event) {
      // Handle paste event - could add validation here
      setTimeout(() => {
        if (this.bunkerUrl && !this.bunkerUrl.startsWith('bunker://')) {
          this.error = 'Invalid bunker URL format. Must start with bunker://';
        } else {
          this.error = null;
        }
      }, 100);
    }
  }
};
</script>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>