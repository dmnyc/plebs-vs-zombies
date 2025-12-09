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
          <p class="text-sm text-gray-300 mb-3">
            Nostr accounts are "deleted" by setting a <code class="bg-gray-900 px-1 rounded text-yellow-300">"deleted": true</code>
            flag in your profile metadata. The Resurrector:
          </p>
          <div class="space-y-2">
            <div class="flex items-start gap-3">
              <span class="flex-shrink-0 w-6 h-6 rounded-full bg-zombie-green text-gray-900 font-bold text-sm flex items-center justify-center">1</span>
              <span class="text-sm text-gray-300">Scans for profile events with the deleted flag</span>
            </div>
            <div class="flex items-start gap-3">
              <span class="flex-shrink-0 w-6 h-6 rounded-full bg-zombie-green text-gray-900 font-bold text-sm flex items-center justify-center">2</span>
              <span class="text-sm text-gray-300">Sends a deletion event (kind 5) to remove the deleted profile</span>
            </div>
            <div class="flex items-start gap-3">
              <span class="flex-shrink-0 w-6 h-6 rounded-full bg-zombie-green text-gray-900 font-bold text-sm flex items-center justify-center">3</span>
              <span class="text-sm text-gray-300">Publishes a clean version of your profile without the deleted flag</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scan Section -->
    <div class="card mb-6">
      <h2 class="text-2xl font-bold mb-4">Step 1: Choose Profile</h2>

      <!-- Scan Mode Selection -->
      <div class="space-y-3 mb-4">
        <label class="flex items-start gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-zombie-green transition-colors">
          <input
            type="radio"
            v-model="scanMode"
            value="self"
            class="mt-1"
          />
          <div class="flex-1">
            <div class="font-medium text-green-400">My Profile</div>
            <div class="text-sm text-gray-400">Check and resurrect your own profile</div>
          </div>
        </label>

        <label class="flex items-start gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:border-zombie-green transition-colors">
          <input
            type="radio"
            v-model="scanMode"
            value="other"
            class="mt-1"
          />
          <div class="flex-1">
            <div class="font-medium text-blue-400">Another Profile (npub)</div>
            <div class="text-sm text-gray-400">Read-only check - can't resurrect</div>
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
        <p class="text-xs text-blue-400 mt-1">ℹ️ Read-only mode - you can check but not resurrect</p>
      </div>
    </div>

    <!-- Action Section -->
    <div class="card mb-6">
      <h2 class="text-2xl font-bold mb-4">Step 2: {{ scanMode === 'other' ? 'Check Profile' : 'Check or Resurrect Profile' }}</h2>

      <div class="bg-yellow-900/10 border border-yellow-600/20 p-3 rounded-lg mb-4">
        <p class="text-sm text-gray-400">
          💡 <strong class="text-yellow-400">How it works:</strong>
          <span v-if="scanMode === 'other'"> Check scans for deleted profiles without making changes.</span>
          <span v-else> Check scans for issues. Resurrect removes deleted flags and publishes a clean profile across all relays.</span>
        </p>
      </div>

      <div class="flex gap-3 flex-wrap">
        <button
          @click="scanProfile"
          :disabled="isScanning || (scanMode === 'other' && !npubInput)"
          class="btn-primary text-lg px-8 py-4"
          :class="{'opacity-50 cursor-not-allowed': isScanning || (scanMode === 'other' && !npubInput)}"
          style="background: #5cdb5c"
        >
          <span v-if="isScanning">🔍 Checking...</span>
          <span v-else>🔍 Check Profile</span>
        </button>

        <button
          v-if="scanMode === 'self'"
          @click="forceResurrection"
          :disabled="isResurrecting"
          class="btn-primary text-lg px-8 py-4"
          :class="{'opacity-50 cursor-not-allowed': isResurrecting}"
          style="background: #d97706"
        >
          <span v-if="isResurrecting">⚡ Resurrecting...</span>
          <span v-else>⚡ Resurrect Profile</span>
        </button>

        <button
          v-if="logs.length > 0"
          @click="clearLogs"
          class="btn-secondary"
        >
          🗑️ Clear Logs
        </button>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="deletedProfiles.length > 0" class="card mb-6 border-red-500/50">
      <h2 class="text-2xl font-bold mb-4 text-red-400">⚠️ Deleted Profile Found!</h2>

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
      <div class="flex items-center gap-3">
        <div class="text-3xl">✅</div>
        <div class="flex-1">
          <h3 class="text-lg font-medium text-green-400">{{ scanMode === 'other' ? 'This Profile Looks Healthy!' : 'Your Profile Looks Healthy!' }}</h3>
          <p class="text-sm text-gray-300">No deleted profiles found.</p>
        </div>
      </div>
    </div>

    <!-- Advanced Tools (Collapsible) -->
    <div v-if="scanMode === 'self'" class="card bg-gray-800/30 mb-6">
      <details>
        <summary class="text-lg font-medium cursor-pointer hover:text-zombie-green transition-colors">
          🔧 Advanced Diagnostic Tools
        </summary>

        <div class="mt-4 space-y-3">
          <p class="text-xs text-gray-400 mb-3">
            These tools help diagnose specific issues. Most users won't need these.
          </p>

          <!-- Advanced Tool Buttons -->
          <div class="flex gap-3 flex-wrap mb-3">
            <button
              @click="scanProfile"
              :disabled="isScanning || isResurrecting || isRunningAdvancedTool"
              class="btn-secondary"
            >
              {{ isScanning ? '🔍 Scanning...' : '🔍 Basic Scan' }}
            </button>

            <button
              @click="runDeepScan"
              :disabled="isScanning || isResurrecting || isRunningAdvancedTool"
              class="btn-secondary"
            >
              {{ isDeepScanning ? '🔬 Deep Scanning...' : '🔬 Deep Scan' }}
            </button>

            <button
              @click="publishToMissingRelays"
              :disabled="isScanning || isResurrecting || isRunningAdvancedTool"
              class="btn-secondary"
            >
              {{ isPublishingToMissing ? '📡 Publishing...' : '📡 Publish to Missing Relays' }}
            </button>

            <button
              @click="toggleKeepProfile"
              class="btn-secondary"
            >
              Keep Profile: {{ keepProfileMode ? 'ON' : 'OFF' }}
            </button>

            <button
              @click="exportProfile"
              :disabled="isScanning || isResurrecting || isRunningAdvancedTool"
              class="btn-secondary"
            >
              💾 Export Profile JSON
            </button>
          </div>

          <!-- Tool Descriptions -->
          <div class="text-xs text-gray-400 bg-gray-900/50 p-3 rounded">
            <p class="mb-2"><strong>Basic Scan:</strong> Quick check for deleted profiles</p>
            <p class="mb-2"><strong>Deep Scan:</strong> Comprehensive check across all relays and event types</p>
            <p class="mb-2"><strong>Publish to Missing Relays:</strong> Send your profile to specific relays that don't have it</p>
            <p><strong>Keep Profile:</strong> When OFF (recommended), publishes a new profile. When ON, only removes deleted events.</p>
          </div>
        </div>
      </details>
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

    <!-- Help & Disclaimer Section -->
    <div class="card mt-6 bg-gray-800/30">
      <h3 class="text-lg font-medium mb-4">Need Help?</h3>
      <div class="space-y-3 text-sm text-gray-300 mb-6">
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
      </div>

      <!-- Important Disclaimer -->
      <div class="bg-orange-900/20 border border-orange-500/40 p-4 rounded-lg">
        <div class="flex items-start gap-3">
          <div class="text-2xl">⚠️</div>
          <div class="flex-1">
            <h3 class="text-lg font-medium text-orange-400 mb-2">Important: Client Compatibility Disclaimer</h3>
            <p class="text-sm text-gray-300 mb-3">
              The Resurrector is a <strong>best effort</strong> service. While it works in the majority of cases we've tested,
              there is <strong>no guarantee that all Nostr clients will behave the same way</strong>.
            </p>

            <div class="mb-3">
              <p class="text-sm text-orange-200 font-medium mb-2">Known Client-Specific Issues:</p>
              <ul class="text-sm text-gray-300 space-y-2 list-disc list-inside">
                <li>
                  <strong class="text-orange-300">Yakihonne:</strong> May require clearing the app cache or completely
                  uninstalling and reinstalling the app before it will recognize your nsec as not deleted.
                </li>
                <li>
                  <strong class="text-orange-300">Primal:</strong> Some users may still experience errors logging in if
                  delete flags are present in remote cache services (a known issue on their end).
                </li>
                <li>
                  <strong class="text-orange-300">Other clients:</strong> Each client handles profile metadata differently.
                  Some may cache deleted status or have different relay configurations.
                </li>
              </ul>
            </div>

            <p class="text-sm text-gray-300 mb-2">
              <strong class="text-orange-400">What We Offer:</strong> We publish the necessary events to clear the deleted flag
              from your profile across relays. In most cases tested, this successfully restores profile usability.
            </p>

            <p class="text-sm text-gray-400 italic">
              We provide this service with no assurances that every client will accept your nsec after resurrection.
              Results may vary depending on the client's implementation and caching behavior.
            </p>
          </div>
        </div>
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
      showAnimation: false,
      isDeepScanning: false,
      isPublishingToMissing: false,
      isExporting: false
    };
  },
  computed: {
    isRunningAdvancedTool() {
      return this.isDeepScanning || this.isPublishingToMissing || this.isExporting;
    }
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
    },

    async runDeepScan() {
      this.isDeepScanning = true;

      try {
        await resurrectorService.deepScan();
        this.updateLogs();
        alert('Deep scan complete! Check the activity log for detailed results.');
      } catch (error) {
        console.error('Deep scan failed:', error);
        alert(`Deep scan failed: ${error.message}`);
      } finally {
        this.isDeepScanning = false;
        this.updateLogs();
      }
    },

    async publishToMissingRelays() {
      if (!confirm('This will publish your profile to relays that are missing it.\n\nContinue?')) {
        return;
      }

      this.isPublishingToMissing = true;

      try {
        const result = await resurrectorService.publishToMissingRelays();
        this.updateLogs();

        if (result.missingCount === 0) {
          alert(result.message);
        } else {
          alert(`Published to ${result.successCount}/${result.missingCount} relay(s).\n\nCheck the activity log for details.`);
        }
      } catch (error) {
        console.error('Publish to missing relays failed:', error);
        alert(`Publish to missing relays failed: ${error.message}`);
      } finally {
        this.isPublishingToMissing = false;
        this.updateLogs();
      }
    },

    async exportProfile() {
      this.isExporting = true;

      try {
        const result = await resurrectorService.exportProfileData();
        this.updateLogs();
        alert(`Profile data exported!\n\nFound ${result.fieldCount} fields: ${result.fields.join(', ')}`);
      } catch (error) {
        console.error('Export failed:', error);
        alert(`Export failed: ${error.message}`);
      } finally {
        this.isExporting = false;
        this.updateLogs();
      }
    },

    toggleKeepProfile() {
      this.keepProfileMode = !this.keepProfileMode;
    }
  }
};
</script>
