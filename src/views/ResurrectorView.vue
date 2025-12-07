<template>
  <div class="max-w-4xl mx-auto">
    <!-- Header -->
    <div class="text-center mb-8">
      <div class="text-6xl mb-4 flex items-center justify-center gap-2">
        <span style="display: inline-block; transform: scaleX(-1);">⚡</span>
        <span>🧟‍♂️</span>
        <span>⚡</span>
      </div>
      <h1 class="text-4xl font-bold mb-2 text-zombie-green">The Resurrector</h1>
      <p class="text-gray-300">
        Bring your deleted Nostr profile back to life!
      </p>
    </div>

    <!-- Info Card -->
    <div class="card mb-6 bg-gray-800/50 border-yellow-500/30">
      <div class="flex items-start gap-3">
        <div class="text-2xl">💡</div>
        <div class="flex-1">
          <h3 class="text-lg font-medium text-yellow-400 mb-2">How It Works</h3>
          <p class="text-sm text-gray-300 mb-2">
            Nostr accounts are "deleted" by setting a <code class="bg-gray-900 px-1 rounded text-yellow-300">"deleted": true</code>
            flag in your profile metadata. The Resurrector:
          </p>
          <ol class="text-sm text-gray-300 list-decimal list-inside space-y-1">
            <li>Scans for profile events with the deleted flag</li>
            <li>Sends a deletion event (kind 5) to remove the deleted profile</li>
            <li>Publishes a clean version of your profile without the deleted flag</li>
          </ol>
        </div>
      </div>
    </div>

    <!-- Scan Section -->
    <div class="card mb-6">
      <h2 class="text-2xl font-bold mb-4">Step 1: Scan a Profile</h2>

      <!-- Scan Mode Selection -->
      <div class="space-y-3 mb-4">
        <label class="flex items-start gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-green-500 transition-colors">
          <input
            type="radio"
            v-model="scanMode"
            value="self"
            class="mt-1"
          />
          <div class="flex-1">
            <div class="font-medium text-green-400">Scan My Profile</div>
            <div class="text-sm text-gray-400">Check your own profile - can resurrect</div>
          </div>
        </label>

        <label class="flex items-start gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
          <input
            type="radio"
            v-model="scanMode"
            value="other"
            class="mt-1"
          />
          <div class="flex-1">
            <div class="font-medium text-blue-400">Check Another Profile (npub)</div>
            <div class="text-sm text-gray-400">Read-only scan - can't resurrect</div>
          </div>
        </label>
      </div>

      <!-- Npub Input (shown when "other" is selected) -->
      <div v-if="scanMode === 'other'" class="mb-4">
        <label class="block text-sm font-medium mb-2">Public Key (npub or hex)</label>
        <input
          type="text"
          v-model="npubInput"
          placeholder="npub1... or hex pubkey"
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-zombie-green"
        />
        <p class="text-xs text-blue-400 mt-1">ℹ️ Read-only mode - you can scan but not resurrect</p>
      </div>

      <div class="flex gap-3 flex-wrap">
        <button
          @click="scanProfile"
          :disabled="isScanning || (scanMode === 'other' && !npubInput)"
          class="btn-primary"
          :class="{'opacity-50 cursor-not-allowed': isScanning || (scanMode === 'other' && !npubInput)}"
        >
          <span v-if="isScanning">🔍 Scanning...</span>
          <span v-else>🔍 Scan Profile</span>
        </button>

        <button
          v-if="scanMode === 'self'"
          @click="forceResurrection"
          :disabled="isResurrecting"
          class="btn-primary bg-yellow-600 hover:bg-yellow-500"
          :class="{'opacity-50 cursor-not-allowed': isResurrecting}"
          title="Force publish a clean profile even if scan finds nothing"
        >
          <span v-if="isResurrecting">⚡ Force Resurrecting...</span>
          <span v-else>⚡ Force Resurrection</span>
        </button>

        <button
          v-if="logs.length > 0"
          @click="clearLogs"
          class="btn-secondary"
        >
          🗑️ Clear Logs
        </button>
      </div>

      <!-- Force Resurrection Info -->
      <div v-if="scanMode === 'self'" class="mt-4 bg-yellow-900/10 border border-yellow-600/20 p-3 rounded-lg">
        <p class="text-xs text-gray-400">
          💡 <strong class="text-yellow-400">Tip:</strong> If clients like Primal or Yakihonne still show your profile as deleted, use Force Resurrection. It will find and remove ALL deleted profile events across all relays and publish a fresh clean profile.
        </p>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="deletedProfiles.length > 0" class="card mb-6 border-red-500/50">
      <h2 class="text-2xl font-bold mb-4 text-red-400">⚠️ Deleted Profile Found!</h2>
      <p class="text-gray-300 mb-4">
        Found {{ deletedProfiles.length }} deleted profile(s).
      </p>

      <div v-if="scanMode === 'other'" class="bg-yellow-900/30 border border-yellow-600/50 p-3 rounded-lg mb-4">
        <p class="text-sm text-yellow-400">
          ⚠️ You're in read-only mode. To resurrect this profile, you need to be signed in as the profile owner and scan in "Scan My Profile" mode.
        </p>
      </div>

      <div class="space-y-4">
        <div
          v-for="(profile, index) in deletedProfiles"
          :key="profile.eventId"
          class="bg-gray-800 p-4 rounded-lg border border-gray-700"
        >
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="font-mono text-sm text-gray-400">
                Event ID: {{ formatEventId(profile.eventId) }}
              </div>
              <div class="text-xs text-gray-500">
                Created: {{ formatDate(profile.createdAt) }}
              </div>
            </div>
          </div>

          <div class="mb-3">
            <h4 class="text-sm font-medium text-gray-300 mb-1">Profile Data:</h4>
            <pre class="text-xs bg-gray-900 p-2 rounded overflow-x-auto text-gray-400">{{ JSON.stringify(profile.metadata, null, 2) }}</pre>
          </div>

          <div class="mb-3">
            <label class="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                v-model="keepProfileMode"
                class="w-4 h-4 text-zombie-green focus:ring-zombie-green rounded"
              />
              <span>Keep Profile Mode</span>
              <span class="text-xs text-gray-500">(Only delete the "deleted" event, don't republish profile)</span>
            </label>
          </div>

          <button
            v-if="scanMode === 'self'"
            @click="resurrectProfile(profile)"
            :disabled="isResurrecting"
            class="btn-primary w-full"
            :class="{'opacity-50 cursor-not-allowed': isResurrecting}"
          >
            <span v-if="isResurrecting">⚡ Resurrecting...</span>
            <span v-else>⚡ Resurrect This Profile</span>
          </button>
          <div
            v-else
            class="bg-gray-700 text-gray-400 w-full py-3 px-4 rounded text-center"
          >
            🔒 Sign in as this profile to resurrect
          </div>
        </div>
      </div>
    </div>

    <!-- No Deleted Profiles -->
    <div v-else-if="hasScanned && deletedProfiles.length === 0" class="card mb-6 border-green-500/50">
      <div class="flex items-center gap-3 mb-4">
        <div class="text-3xl">✅</div>
        <div class="flex-1">
          <h3 class="text-lg font-medium text-green-400">Your Profile Looks Healthy!</h3>
          <p class="text-sm text-gray-300">No deleted profiles found.</p>
        </div>
      </div>

      <!-- Force Resurrection Option -->
      <div v-if="scanMode === 'self'" class="bg-yellow-900/20 border border-yellow-600/30 p-4 rounded-lg">
        <h4 class="text-sm font-medium text-yellow-400 mb-2">⚡ Still showing as deleted on some clients?</h4>
        <p class="text-xs text-gray-300 mb-3">
          Sometimes deleted profiles exist on relays our scan doesn't check. Use Force Resurrection to publish a fresh clean profile that overrides any deleted versions.
        </p>
        <button
          @click="forceResurrection"
          :disabled="isResurrecting"
          class="btn-primary bg-yellow-600 hover:bg-yellow-500"
          :class="{'opacity-50 cursor-not-allowed': isResurrecting}"
        >
          <span v-if="isResurrecting">⚡ Force Resurrecting...</span>
          <span v-else>⚡ Force Resurrection</span>
        </button>
      </div>
    </div>

    <!-- Logs Section -->
    <div v-if="logs.length > 0" class="card bg-gray-900 mb-6">
      <h3 class="text-lg font-medium mb-3">Activity Log</h3>
      <div class="space-y-1 max-h-96 overflow-y-auto font-mono text-sm">
        <div
          v-for="(log, index) in logs"
          :key="index"
          class="flex gap-2 text-xs"
          :class="{
            'text-gray-400': log.type === 'info',
            'text-green-400': log.type === 'success',
            'text-red-400': log.type === 'error',
            'text-yellow-400': log.type === 'warning'
          }"
        >
          <span class="text-gray-500">{{ log.timestamp }}</span>
          <span>{{ log.message }}</span>
        </div>
      </div>
    </div>

    <!-- Standalone Version Link -->
    <div class="card bg-purple-900/20 border-purple-500/30">
      <div class="flex items-start gap-3">
        <div class="text-2xl">🔗</div>
        <div class="flex-1">
          <h3 class="text-lg font-medium text-purple-400 mb-2">Need nsec/hex key support?</h3>
          <p class="text-sm text-gray-300 mb-3">
            If your account is deleted and you don't have access to a browser extension, use our standalone version that supports nsec/hex private keys.
          </p>
          <a
            href="/resurrector.html"
            target="_blank"
            class="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <span>🚀</span>
            <span>Open Standalone Resurrector</span>
          </a>
          <p class="text-xs text-gray-400 mt-2">
            ⚠️ Your private key never leaves your browser window
          </p>
        </div>
      </div>
    </div>

    <!-- Help Section -->
    <div class="card mt-6 bg-gray-800/30">
      <h3 class="text-lg font-medium mb-3">Need Help?</h3>
      <div class="space-y-2 text-sm text-gray-300">
        <p>
          <strong class="text-yellow-400">Q: Why would my profile be deleted?</strong><br>
          Some Nostr clients allow you to "delete" your account by setting the <code class="bg-gray-900 px-1 rounded">deleted: true</code> flag in your profile.
        </p>
        <p>
          <strong class="text-yellow-400">Q: Is this safe?</strong><br>
          Yes! The Resurrector uses your browser extension to sign events securely. Your private key never leaves your extension.
        </p>
        <p>
          <strong class="text-yellow-400">Q: What's "Keep Profile Mode"?</strong><br>
          When enabled, it only deletes the "deleted" profile event without republishing a new one. Use this if you want more control over your profile update.
        </p>
        <p>
          <strong class="text-yellow-400">Q: What if I don't have a browser extension?</strong><br>
          Use the <a href="/resurrector.html" target="_blank" class="text-purple-400 hover:underline">standalone version</a> which supports nsec/hex private keys as a fallback.
        </p>
      </div>
    </div>
  </div>

  <!-- Lightning Animation Overlay -->
  <div v-if="showAnimation" ref="lightningContainer" class="lightning-container active">
    <svg ref="lightningSvg" class="lightning-svg"></svg>
  </div>
</template>

<style scoped>
/* Lightning Animation - from Primal Spark */
.lightning-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
  transition: background 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
  opacity: 0;
}

.lightning-container.active {
  opacity: 1;
}

.lightning-svg {
  position: absolute;
  top: 0;
  width: 100vw;
  height: 100vh;
  filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.7));
  left: 50%;
  transform: translateX(-50%);
  overflow: visible;
}

:deep(.rayo) {
  stroke-linecap: round;
  opacity: 0;
  animation: aparecer 0.2s ease-out, desvanecer 0.6s ease-in 0.2s;
  fill: none;
}

@keyframes aparecer {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes desvanecer {
  from { opacity: 1; }
  to { opacity: 0; }
}

:deep(.flash) {
  animation: flash 0.2s;
}

@keyframes flash {
  0% { background: rgba(255, 255, 255, 0.3); }
  100% { background: transparent; }
}
</style>

<script>
import resurrectorService from '../services/resurrectorService';
import nostrService from '../services/nostrService';
import { nip19 } from 'nostr-tools';

export default {
  name: 'ResurrectorView',
  data() {
    return {
      isScanning: false,
      isResurrecting: false,
      hasScanned: false,
      deletedProfiles: [],
      logs: [],
      keepProfileMode: false,
      scanMode: 'self', // 'self' or 'other'
      npubInput: '',
      showAnimation: false
    };
  },
  methods: {
    async scanProfile() {
      this.isScanning = true;
      this.hasScanned = false;
      this.deletedProfiles = [];

      try {
        let pubkey = null;

        // If scanning another profile, decode the npub
        if (this.scanMode === 'other') {
          const input = this.npubInput.trim();

          if (!input) {
            throw new Error('Please enter a public key (npub or hex)');
          }

          // Validate input - reject if it's an nsec
          if (input.startsWith('nsec')) {
            throw new Error('Invalid input: You entered a private key (nsec) but a public key (npub) is required for read-only scanning.');
          }

          if (input.startsWith('npub') || input.startsWith('nprofile')) {
            const decoded = nip19.decode(input);
            // nprofile returns an object with pubkey, npub returns the pubkey directly
            pubkey = decoded.data.pubkey || decoded.data;
          } else {
            pubkey = input; // Assume it's a hex pubkey
          }
        }

        const profiles = await resurrectorService.scanForDeletedProfiles(pubkey);
        this.deletedProfiles = profiles;
        this.hasScanned = true;
        this.updateLogs();
      } catch (error) {
        console.error('Scan failed:', error);
        alert(`Scan failed: ${error.message}`);
      } finally {
        this.isScanning = false;
      }
    },

    async resurrectProfile(profile) {
      if (!confirm('Are you sure you want to resurrect this profile? This will publish new events to your relays.')) {
        return;
      }

      this.isResurrecting = true;

      try {
        await resurrectorService.resurrectProfile(profile, this.keepProfileMode);
        this.updateLogs();

        // Play resurrection animation
        await this.playResurrectionAnimation();

        // Remove the resurrected profile from the list
        this.deletedProfiles = this.deletedProfiles.filter(p => p.eventId !== profile.eventId);

        // Optionally reload user profile
        if (!this.keepProfileMode) {
          setTimeout(async () => {
            await nostrService.loadUserProfile();
          }, 2000);
        }
      } catch (error) {
        console.error('Resurrection failed:', error);
        alert(`Resurrection failed: ${error.message}`);
      } finally {
        this.isResurrecting = false;
        this.updateLogs();
      }
    },

    async forceResurrection() {
      if (!confirm('Force Resurrection will:\n\n1. Find and delete ALL deleted profile events\n2. Publish a fresh clean profile\n3. Override any existing deleted versions\n\nThis is useful when clients still show your profile as deleted even though our scan found nothing.\n\nContinue?')) {
        return;
      }

      this.isResurrecting = true;

      try {
        await resurrectorService.forceResurrection();
        this.updateLogs();

        // Play resurrection animation
        await this.playResurrectionAnimation();

        // Reload user profile
        setTimeout(async () => {
          await nostrService.loadUserProfile();
        }, 2000);

        alert('Force resurrection complete! Check your profile on different clients to verify.');
      } catch (error) {
        console.error('Force resurrection failed:', error);
        alert(`Force resurrection failed: ${error.message}`);
      } finally {
        this.isResurrecting = false;
        this.updateLogs();
      }
    },

    generateLightning() {
      const svg = this.$refs.lightningSvg;
      const container = this.$refs.lightningContainer;

      if (!svg || !container) return;

      const ancho = container.clientWidth;
      const altura = container.clientHeight;

      // Calculate a safe starting position
      const safeWidthStart = ancho * 0.15;
      const safeWidthEnd = ancho * 0.85;
      const safeWidth = safeWidthEnd - safeWidthStart;

      const xInicio = safeWidthStart + Math.random() * safeWidth;
      let yActual = 0;
      let zigzag = `M${xInicio},${yActual}`;

      const grosor = Math.random() * 3 + 2;
      const color = Math.random() > 0.5 ? 'white' : 'yellow';

      // Create zigzag pattern
      const segments = Math.floor(Math.random() * 3 + 5);

      for (let i = 0; i < segments; i++) {
        const maxOffset = Math.min(100, safeWidth * 0.25);
        const xOffset = (Math.random() - 0.5) * maxOffset;

        let yOffset;
        if (i === segments - 1) {
          yOffset = altura - yActual;
        } else {
          yOffset = (altura / segments) * (1 + Math.random() * 0.5);
        }

        yActual += yOffset;

        let newX = xInicio + xOffset;
        const edgeBuffer = ancho * 0.08;
        if (newX < edgeBuffer) newX = edgeBuffer;
        if (newX > ancho - edgeBuffer) newX = ancho - edgeBuffer;

        zigzag += ` L${newX},${yActual}`;

        // Add random branches
        if (Math.random() > 0.7) {
          const branchOffsetMax = maxOffset * 0.8;
          const branchOffset = (Math.random() - 0.5) * branchOffsetMax;
          let branchX = newX + branchOffset;

          const edgeBuffer = ancho * 0.05;
          if (branchX < edgeBuffer) branchX = edgeBuffer;
          if (branchX > ancho - edgeBuffer) branchX = ancho - edgeBuffer;

          const branchY = yActual + Math.random() * 30;
          zigzag += ` M${newX},${yActual} L${branchX},${branchY} M${newX},${yActual}`;
        }
      }

      // Create SVG path
      const linea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      linea.setAttribute('d', zigzag);
      linea.setAttribute('class', 'rayo');
      linea.setAttribute('stroke', color);
      linea.setAttribute('stroke-width', grosor.toString());
      linea.setAttribute('fill', 'none');
      svg.appendChild(linea);

      // Add flash effect
      container.classList.add('flash');
      setTimeout(() => {
        container.classList.remove('flash');
      }, 200);

      // Clean up lightning after animation
      setTimeout(() => {
        if (svg.contains(linea)) {
          svg.removeChild(linea);
        }
      }, 800);
    },

    async playResurrectionAnimation() {
      this.showAnimation = true;

      await this.$nextTick();

      // Generate multiple lightning bolts
      this.generateLightning();
      setTimeout(() => this.generateLightning(), 150);
      setTimeout(() => this.generateLightning(), 300);

      // Wait for animations to complete
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Hide animation
      this.showAnimation = false;
    },

    updateLogs() {
      this.logs = resurrectorService.getLogs();
    },

    clearLogs() {
      resurrectorService.clearLogs();
      this.logs = [];
    },

    formatEventId(eventId) {
      return eventId.substring(0, 8) + '...' + eventId.substring(eventId.length - 8);
    },

    formatDate(timestamp) {
      return new Date(timestamp * 1000).toLocaleString();
    }
  }
};
</script>
