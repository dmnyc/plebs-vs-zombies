<template>
  <div class="card">
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-xl font-semibold text-gray-100">
        Remote Signer <span class="text-gray-500 font-normal">· NIP-46</span>
      </h3>
      <span
        v-if="connectionStatus.connected"
        class="inline-flex items-center gap-1.5 text-[11px] font-medium text-green-300 bg-green-900/40 border border-green-500/30 px-2.5 py-1 rounded-full"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-zombie-green animate-pulse"></span>
        Connected
      </span>
    </div>

    <!-- Connection Status -->
    <div v-if="connectionStatus.connected" class="mb-2">
      <div class="rounded-xl border border-white/10 bg-black/20 divide-y divide-white/5">
        <div class="flex justify-between items-center px-4 py-3 gap-3">
          <span class="text-gray-400 text-sm shrink-0">Bunker</span>
          <span class="text-gray-100 font-mono text-sm truncate">{{ connectionStatus.bunkerPubkey?.substring(0, 12) }}…</span>
        </div>
        <div class="flex justify-between items-center px-4 py-3 gap-3">
          <span class="text-gray-400 text-sm shrink-0">Relay</span>
          <span class="text-gray-100 text-sm truncate">{{ connectionStatus.bunkerRelays?.[0] }}</span>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between gap-3">
        <p class="text-gray-500 text-sm">Your bunker handles all signing requests</p>
        <button
          @click="disconnect"
          :disabled="disconnecting"
          class="btn-danger btn-sm shrink-0"
        >
          {{ disconnecting ? 'Disconnecting…' : 'Disconnect' }}
        </button>
      </div>
    </div>

    <!-- Connection Form -->
    <div v-else class="space-y-4">
      <!-- Reconnect Saved Connection -->
      <div v-if="hasSavedConnection" class="rounded-xl border border-zombie-green/30 bg-zombie-green/10 p-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h4 class="text-zombie-green font-medium mb-0.5">Saved connection available</h4>
            <p class="text-sm text-gray-400">Reconnect your previously authorized bunker</p>
          </div>
          <div class="flex gap-2 shrink-0">
            <button
              @click="deleteSavedConnection"
              :disabled="reconnecting || deleting"
              class="btn-tertiary btn-sm inline-flex items-center justify-center gap-1.5"
            >
              <span>🗑️</span>
              <span>{{ deleting ? 'Deleting…' : 'Delete' }}</span>
            </button>
            <button
              @click="reconnectSavedConnection"
              :disabled="reconnecting || deleting"
              class="btn-primary btn-sm inline-flex items-center justify-center gap-1.5"
            >
              <span>🔄</span>
              <span>{{ reconnecting ? 'Reconnecting…' : 'Reconnect' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Separator -->
      <div v-if="hasSavedConnection" class="flex items-center justify-center text-gray-600 text-xs uppercase tracking-wide">
        <div class="border-t border-white/10 flex-grow"></div>
        <span class="px-3">or connect manually</span>
        <div class="border-t border-white/10 flex-grow"></div>
      </div>

      <div v-if="connecting" class="rounded-xl border border-white/10 bg-black/20 p-4 text-center">
        <div class="flex items-center justify-center gap-2.5">
          <span class="spinner-sm"></span>
          <span class="text-gray-200 text-sm font-medium">Connecting to bunker…</span>
        </div>
        <p class="text-xs text-gray-500 mt-1.5">This may take a few seconds</p>
      </div>

      <!-- Connection Method Selector -->
      <GlideTabs v-model="connectionMethod" :tabs="connectionTabs" label="Signer connection method" />

      <!-- Bunker URL Method -->
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
              class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
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
          {{ connecting ? 'Connecting…' : 'Connect to Bunker' }}
        </button>
      </div>

      <!-- Generate Connection String Method -->
      <div v-if="connectionMethod === 'generate-string'" class="space-y-3">
        <div class="text-center">
          <p class="text-xs text-gray-500 mb-3">
            Best for pairing with a different device. On this device?
            Use the <em>Bunker URL</em> tab instead.
          </p>

          <button
            v-if="!generatedConnectionString"
            @click="generateConnectionString"
            :disabled="generatingString"
            class="btn-primary"
          >
            {{ generatingString ? 'Generating…' : 'Generate Connection String' }}
          </button>

          <!-- Generated Connection String Display -->
          <div v-if="generatedConnectionString" class="space-y-4">
            <!-- QR Code Display -->
            <div class="flex justify-center">
              <div class="bg-white p-4 rounded-xl shadow-[0_0_0_1px_rgba(92,219,92,0.3),0_0_32px_rgba(92,219,92,0.15)]">
                <div
                  ref="qrCode"
                  class="w-56 h-56 flex items-center justify-center"
                >
                  <!-- QR code will be inserted here -->
                </div>
              </div>
            </div>

            <!-- Connection String -->
            <div class="bg-black/20 rounded-xl p-4 border border-white/10">
              <div class="flex items-center justify-between mb-2 gap-2">
                <p class="text-sm text-gray-400">Or copy connection string</p>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    @click="copyConnectionString"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    :class="connectionStringCopied
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-zombie-green hover:brightness-110 text-zombie-dark'"
                  >
                    {{ connectionStringCopied ? '✅ Copied' : '📋 Copy' }}
                  </button>
                  <button
                    @click="showFullConnectionString = !showFullConnectionString"
                    class="text-xs text-gray-500 hover:text-gray-300 px-1"
                  >
                    {{ showFullConnectionString ? 'Hide' : 'Show' }}
                  </button>
                </div>
              </div>

              <code v-if="showFullConnectionString" class="bg-black/30 px-2 py-1.5 rounded text-xs text-zombie-green block font-mono break-all">
                {{ generatedConnectionString }}
              </code>
              <code v-else class="text-xs text-gray-600 font-mono">
                nostrconnect://••••••••••••••••••
              </code>
            </div>

            <div class="flex items-center justify-center gap-2 text-xs text-gray-500">
              <span class="w-1.5 h-1.5 rounded-full bg-zombie-green animate-pulse"></span>
              Listening for your signer to connect…
            </div>
            <p class="text-xs text-gray-600 text-center">
              Scan the QR or paste the string into your signer app. Using Clave? Make sure notifications are allowed.
            </p>

            <button
              @click="resetConnectionString"
              class="btn-tertiary btn-sm w-full"
            >
              Generate New String
            </button>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
        <div class="flex items-start gap-2.5">
          <span class="text-red-400 mt-0.5">⚠️</span>
          <div class="flex-1 min-w-0">
            <p class="text-red-300 text-sm font-medium">Connection failed</p>
            <p class="text-red-300/80 text-xs mt-1">{{ error }}</p>
          </div>
          <button
            @click="error = null"
            class="text-red-400 hover:text-red-300 shrink-0"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Help Section -->
      <div class="rounded-xl border border-white/10 bg-black/20 p-4">
        <h4 class="text-sm font-medium text-gray-200 mb-1">
          Get a Bunker URL
        </h4>
        <p class="text-xs text-gray-500 mb-3">
          You need a remote signer (bunker) to provide the connection URL.
        </p>
        <div class="space-y-2">
          <a
            href="https://zapstore.dev/apps/naddr1qvzqqqr7pvpzqateqake4lc2fn77lflzq30jfpk8uhvtccalc66989er8cdmljceqqdkxmmd9enhyet9deshyaphvvejumn0wd68yumfvahx2usx8zmj2"
            target="_blank"
            class="flex items-center gap-2.5 text-sm px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:border-orange-400/50 hover:bg-orange-400/5 transition-all duration-200"
          >
            <span class="w-2 h-2 bg-orange-400 rounded-full shrink-0"></span>
            <span class="text-gray-300">Amber</span>
            <span class="text-gray-600 text-xs">Android</span>
            <span class="ml-auto text-gray-600">↗</span>
          </a>
          <a
            href="https://clave.casa/"
            target="_blank"
            class="flex items-center gap-2.5 text-sm px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:border-cyan-400/50 hover:bg-cyan-400/5 transition-all duration-200"
          >
            <span class="w-2 h-2 bg-cyan-400 rounded-full shrink-0"></span>
            <span class="text-gray-300">Clave</span>
            <span class="text-gray-600 text-xs">iOS</span>
            <span class="ml-auto text-gray-600">↗</span>
          </a>
          <a
            href="https://primal.net"
            target="_blank"
            class="flex items-center gap-2.5 text-sm px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:border-pleb-purple/50 hover:bg-pleb-purple/5 transition-all duration-200"
          >
            <span class="w-2 h-2 bg-pleb-purple rounded-full shrink-0"></span>
            <span class="text-gray-300">Primal</span>
            <span class="text-gray-600 text-xs">Mobile &amp; desktop</span>
            <span class="ml-auto text-gray-600">↗</span>
          </a>
        </div>
        <p class="text-xs text-gray-600 mt-3">
          Your private keys stay in the bunker app — Plebs vs Zombies only sends signing requests for approval.
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import nostrService from '../services/nostrService';
import qr from 'qrcode-generator';
import GlideTabs from './GlideTabs.vue';

export default {
  name: 'Nip46Connection',
  components: {
    GlideTabs
  },
  data() {
    return {
      bunkerUrl: '',
      connecting: false,
      disconnecting: false,
      error: null,
      connectionMethod: 'bunker-url',
      connectionTabs: [
        { id: 'bunker-url', label: 'Bunker URL' },
        { id: 'generate-string', label: 'Connection String' }
      ],
      generatedConnectionString: '',
      generatingString: false,
      connectionStringCopied: false,
      showFullConnectionString: false,
      pendingConnectionData: null,
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

        if (!result?.pubkey) {
          this.error = 'The signer accepted the connection but did not return your public key. Press Disconnect and try again.';
          return;
        }

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
        const connectionData = nostrService.nip46Service.generateConnectionString();
        this.generatedConnectionString = connectionData.connectionString;
        this.pendingConnectionData = connectionData;

        // Generate QR code
        this.generateQRCode(connectionData.connectionString);

        // Wait for remote signer to connect (BunkerSigner.fromURI handles the full handshake)
        this.waitForConnection(connectionData);
      } catch (error) {
        console.error('Failed to generate connection string:', error);
        this.error = 'Failed to generate connection string: ' + error.message;
      } finally {
        this.generatingString = false;
      }
    },

    async waitForConnection(connectionData) {
      try {
        const result = await nostrService.nip46Service.connectFromURI(connectionData, 120000);

        if (!result?.pubkey) {
          // Keep the user in the modal with a visible error — emitting now
          // would close it and swallow the failure
          this.error = 'The signer accepted the connection but did not return your public key. Press Disconnect and try again, or use the bunker URL flow.';
          this.generatedConnectionString = '';
          this.pendingConnectionData = null;
          return;
        }

        // Switch nostrService to NIP-46 mode
        nostrService.setSigningMethod('nip46');
        nostrService.pubkey = result.pubkey;

        this.updateConnectionStatus();
        this.generatedConnectionString = '';
        this.pendingConnectionData = null;

        this.$emit('connected', result);

        // Dispatch event for App.vue to pick up
        window.dispatchEvent(new CustomEvent('nip46-connected', {
          detail: { success: true, pubkey: result.pubkey, bunkerPubkey: result.bunkerPubkey, relay: result.relay }
        }));
      } catch (error) {
        if (error.message?.includes('timed out')) {
          this.error = 'No signer responded within 2 minutes. If you scanned with Amber, its nostrconnect flow often fails silently — try the bunker flow instead: create the connection inside Amber, copy the bunker:// URL it generates, and paste it in the Use Bunker URL tab.';
        } else if (error.message?.includes('subscription closed')) {
          this.error = 'The connection to the relay dropped before your signer responded. If you switched apps on the same device to approve (e.g. Clave on iPhone), the browser tab gets suspended mid-handshake — paste a bunker:// URL instead for same-device pairing.';
        } else if (error.nip46Actionable) {
          // Already a self-explanatory message — prefixing it buries the advice.
          this.error = error.message;
        } else {
          this.error = 'Connection failed: ' + error.message;
        }
        this.generatedConnectionString = '';
        this.pendingConnectionData = null;
      }
    },

    generateQRCode(text) {
      try {
        this.$nextTick(() => {
          if (!this.$refs.qrCode) {
            console.warn('QR code ref not available');
            return;
          }

          // Clear existing content
          this.$refs.qrCode.innerHTML = '';

          // Create QR code
          const qrCode = qr(0, 'M');
          qrCode.addData(text);
          qrCode.make();

          // Generate SVG
          const svg = qrCode.createSvgTag({
            cellSize: 4,
            margin: 0,
            scalable: true
          });

          // Insert into DOM
          this.$refs.qrCode.innerHTML = svg;

          console.log('✅ QR code generated successfully');
        });
      } catch (error) {
        console.error('❌ Failed to generate QR code:', error);
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
      this.pendingConnectionData = null;
      this.connectionStringCopied = false;
      this.showFullConnectionString = false;
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
