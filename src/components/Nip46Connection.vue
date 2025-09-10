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
      <div v-if="connecting" class="bg-blue-900 rounded-lg p-4 text-center">
        <div class="flex items-center justify-center gap-2">
          <div class="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
          <span class="text-blue-400">Connecting to bunker...</span>
        </div>
        <p class="text-sm text-gray-300 mt-2">This may take a few seconds</p>
      </div>

      <div class="space-y-3">
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
        await nostrService.nip46Service.disconnect();
        
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