<template>
  <div class="min-h-screen flex flex-col bg-gray-900">
    <header class="bg-zombie-dark border-b border-gray-700 shadow-lg" :key="forceUpdateKey">
      <div class="container mx-auto px-4 py-4">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3" :class="isScoutMode ? '' : 'cursor-pointer'" @click="!isScoutMode && setActiveView('dashboard')">
            <img src="/logo.svg" alt="Plebs vs Zombies" class="w-12 h-12" />
            <div class="flex flex-col">
              <h1 class="text-2xl sm:text-3xl transition-colors" :class="isScoutMode ? '' : 'hover:text-zombie-green'">
                Plebs vs. Zombies
              </h1>
            </div>
          </div>
          
          <div class="flex items-center">
            <!-- Desktop Navigation -->
            <nav v-if="isConnected" class="hidden lg:block">
              <ul class="flex gap-6">
                <li>
                  <a 
                    href="#" 
                    @click.prevent="setActiveView('dashboard')" 
                    :class="{'text-zombie-green': activeView === 'dashboard' && !isScoutMode, 'hover:text-zombie-green transition-colors': activeView !== 'dashboard' || isScoutMode}"
                  >
                    Dashboard
                  </a>
                </li>
                <li>
                  <a 
                    href="#" 
                    @click.prevent="setActiveView('hunting')" 
                    :class="{'text-zombie-green': activeView === 'hunting', 'hover:text-zombie-green transition-colors': activeView !== 'hunting'}"
                  >
                    Hunt Zombies
                  </a>
                </li>
                <li>
                  <a 
                    href="#" 
                    @click.prevent="setActiveView('follows')" 
                    :class="{'text-zombie-green': activeView === 'follows', 'hover:text-zombie-green transition-colors': activeView !== 'follows'}"
                  >
                    Follows
                  </a>
                </li>
                <li>
                  <a 
                    href="#" 
                    @click.prevent="setActiveView('backups')" 
                    :class="{'text-zombie-green': activeView === 'backups', 'hover:text-zombie-green transition-colors': activeView !== 'backups'}"
                  >
                    Backups
                  </a>
                </li>
                <li>
                  <a 
                    href="#" 
                    @click.prevent="setActiveView('settings')" 
                    :class="{'text-zombie-green': activeView === 'settings', 'hover:text-zombie-green transition-colors': activeView !== 'settings'}"
                  >
                    Settings
                  </a>
                </li>
                <li>
                  <a 
                    href="#" 
                    @click.prevent="showScoutModeMenu" 
                    :class="{'text-zombie-green': isScoutMode, 'hover:text-zombie-green transition-colors': !isScoutMode}"
                  >
                    Scout Mode
                  </a>
                </li>
              </ul>
            </nav>
            
            <!-- User Avatar and Mobile Menu Container -->
            <div class="flex items-center ml-auto">
              <!-- User Avatar and Dropdown -->  
              <div v-if="isConnected && userProfile" class="relative">
                <button 
                  @click="userDropdownOpen = !userDropdownOpen"
                  class="hover:bg-gray-800 rounded-lg transition-colors lg:ml-4"
                >
                  <img 
                    :src="userProfile?.picture || '/default-avatar.svg'" 
                    :alt="userProfile?.name || userProfile?.display_name || 'User'"
                    class="w-8 h-8 rounded-full object-cover bg-gray-700"
                    @error="handleAvatarError"
                  />
                </button>
              
              <!-- Dropdown Menu -->
              <div 
                v-if="userDropdownOpen" 
                class="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50"
              >
                <div class="p-3 border-b border-gray-700">
                  <div class="font-medium text-white">{{ userProfile?.display_name || userProfile?.name || 'Anonymous' }}</div>
                  <div class="text-sm text-gray-400 flex items-center">
                    <span class="truncate">{{ formatNpub(userProfile?.pubkey) }}</span>
                    <CopyButton :pubkey="userProfile?.pubkey" />
                  </div>
                </div>
                <div class="p-1">
                  <button 
                    @click="logout"
                    class="w-full text-left px-3 py-2 text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
              </div>
              
              <!-- Mobile/Tablet Hamburger Button -->
              <button 
                v-if="isConnected"
                @click="mobileMenuOpen = !mobileMenuOpen"
                class="lg:hidden flex flex-col justify-center items-center w-8 h-8 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors ml-2"
                :class="{'bg-gray-800': mobileMenuOpen}"
              >
                <span class="w-5 h-0.5 bg-white transition-all" :class="mobileMenuOpen ? 'rotate-45 translate-y-1' : ''"></span>
                <span class="w-5 h-0.5 bg-white mt-1 transition-all" :class="mobileMenuOpen ? 'opacity-0' : ''"></span>
                <span class="w-5 h-0.5 bg-white mt-1 transition-all" :class="mobileMenuOpen ? '-rotate-45 -translate-y-1' : ''"></span>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Mobile/Tablet Navigation Menu -->
        <nav v-if="isConnected && mobileMenuOpen" class="lg:hidden mt-4 pt-4 border-t border-gray-700">
          <!-- User Info Section (Mobile) -->
          <div v-if="isConnected && userProfile" class="mb-4 p-3 bg-gray-800 rounded-lg">
            <div class="flex items-center gap-3 mb-3">
              <img 
                :src="userProfile?.picture || '/default-avatar.svg'" 
                :alt="userProfile?.name || userProfile?.display_name || 'User'"
                class="w-10 h-10 rounded-full object-cover bg-gray-700"
                @error="handleAvatarError"
              />
              <div class="flex-1 min-w-0">
                <div class="font-medium text-white truncate">{{ userProfile?.display_name || userProfile?.name || 'Anonymous' }}</div>
                <div class="text-sm text-gray-400 flex items-center">
                  <span class="truncate">{{ formatNpub(userProfile?.pubkey) }}</span>
                  <CopyButton :pubkey="userProfile?.pubkey" />
                </div>
              </div>
            </div>
            <button 
              @click="logout"
              class="w-full px-3 py-2 text-red-400 hover:bg-gray-700 rounded-lg transition-colors text-left"
            >
              Logout
            </button>
          </div>
          
          <ul class="space-y-2">
            <li>
              <a 
                href="#" 
                @click.prevent="setActiveView('dashboard'); mobileMenuOpen = false" 
                :class="{'text-zombie-green bg-gray-800': activeView === 'dashboard' && !isScoutMode}"
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Dashboard
              </a>
            </li>
            <li>
              <a 
                href="#" 
                @click.prevent="setActiveView('hunting'); mobileMenuOpen = false" 
                :class="{'text-zombie-green bg-gray-800': activeView === 'hunting'}"
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Hunt Zombies
              </a>
            </li>
            <li>
              <a 
                href="#" 
                @click.prevent="setActiveView('follows'); mobileMenuOpen = false" 
                :class="{'text-zombie-green bg-gray-800': activeView === 'follows'}"
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Follows
              </a>
            </li>
            <li>
              <a 
                href="#" 
                @click.prevent="setActiveView('backups'); mobileMenuOpen = false" 
                :class="{'text-zombie-green bg-gray-800': activeView === 'backups'}"
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Backups
              </a>
            </li>
            <li>
              <a 
                href="#" 
                @click.prevent="setActiveView('settings'); mobileMenuOpen = false" 
                :class="{'text-zombie-green bg-gray-800': activeView === 'settings'}"
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Settings
              </a>
            </li>
            <li>
              <a 
                href="#" 
                @click.prevent="showScoutModeMenu(); mobileMenuOpen = false" 
                :class="{'text-zombie-green bg-gray-800': isScoutMode}"
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Scout Mode
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>

    <main class="container mx-auto px-4 py-8 flex-grow">
      <!-- Scout Mode View -->
      <div v-if="isScoutMode">
        <ScoutModeView 
          :scout-target="scoutTarget" 
          :is-logged-in="isConnected"
          @update-target="updateScoutTarget"
          @exit-scout="exitScoutMode"
        />
      </div>
      
      <!-- Login Screen -->
      <div v-else-if="!isConnected" class="card max-w-2xl mx-auto my-12">
        <div class="text-center mb-8">
          <div class="text-6xl mb-6">🧟‍♂️</div>
          <h2 class="text-3xl mb-4">Connect to start hunting zombies!</h2>
          <p class="text-gray-300">Connect with your browser extension to manage your dormant follows.</p>
        </div>
        
        <!-- Connection Info -->
        <div class="mb-8">
          <div class="flex items-start gap-4 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
            <div class="text-2xl">🔌</div>
            <div class="flex-grow">
              <span class="text-lg font-medium text-gray-200">Browser Extension (NIP-07)</span>
              <p class="text-sm text-gray-400 mt-1">Use Alby, nos2x, or other browser extensions</p>
              <div class="flex flex-wrap gap-2 mt-2">
                <span class="text-xs bg-green-900 text-green-300 px-2 py-1 rounded">✅ Easy setup</span>
                <span class="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded">⚡ Fast signing</span>
              </div>
            </div>
          </div>
        </div>

        <div class="text-center">
          <button @click="connectNostr" class="btn-primary text-lg px-8 py-3">
            Connect with Browser Extension
          </button>
        </div>
        
        <!-- Scout Mode Section -->
        <div class="mt-8 pt-6 border-t border-gray-700">
          <div class="text-center mb-6">
            <div class="text-4xl mb-3">👁️🔍</div>
            <h3 class="text-xl mb-2 text-yellow-400">Scout Mode</h3>
            <p class="text-gray-400 text-sm">
              Analyze any Nostr user's zombie follows without signing in
            </p>
          </div>
          
          <div class="space-y-4">
            <div>
              <label for="scout-npub" class="block text-sm font-medium text-gray-300 mb-2">
                Enter an npub to scout:
              </label>
              <input
                id="scout-npub"
                v-model="scoutNpub"
                type="text"
                placeholder="npub1..."
                class="input w-full text-center"
                :class="{'border-red-500': scoutNpubError, 'border-green-500': scoutNpubValid}"
              />
              <div v-if="scoutNpubError" class="text-red-400 text-xs mt-1">
                {{ scoutNpubError }}
              </div>
              <div v-if="scoutNpubValid" class="text-green-400 text-xs mt-1">
                ✅ Valid npub format
              </div>
            </div>
            
            <button 
              @click="startScoutMode" 
              :disabled="!scoutNpubValid || scoutModeLoading"
              class="btn-secondary w-full flex items-center justify-center gap-2"
              :class="{'opacity-50 cursor-not-allowed': !scoutNpubValid || scoutModeLoading}"
            >
              <span v-if="scoutModeLoading">🔍</span>
              <span v-else>🏹</span>
              {{ scoutModeLoading ? 'Starting Scout Mode...' : 'Start Scouting' }}
            </button>
          </div>
          
          <div class="mt-4 p-3 bg-gray-800 rounded-lg">
            <div class="flex items-start gap-2">
              <span class="text-yellow-400 text-sm">⚠️</span>
              <div class="text-xs text-gray-400">
                <strong class="text-yellow-400">Scout Mode features:</strong><br>
                • Read-only analysis of any user's follows<br>
                • Zombie count and score calculation<br>
                • Social sharing capabilities<br>
                • No account creation or purging abilities
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main App Views -->
      <div v-else>
        <component :is="currentView" ref="currentViewComponent" @logout="logout"></component>
      </div>
    </main>

    <footer class="mt-auto py-6 bg-zombie-dark border-t border-gray-700">
      <div class="container mx-auto px-4">
        <div class="flex flex-col lg:flex-row items-center justify-between gap-4">
          <p class="text-gray-400 text-center lg:text-left">
            <span class="block sm:inline">Plebs vs. Zombies &copy; 2025</span>
            <span class="hidden sm:inline"> | </span>
            <span class="block sm:inline">Made with 🧠 for the Nostr community</span>
          </p>
          <div class="flex flex-wrap gap-2">
            <a 
              href="https://jumble.social/users/npub1pvz2c9z4pau26xdwfya24d0qhn6ne8zp9vwjuyxw629wkj9vh5lsrrsd4h" 
              target="_blank"
              class="text-xs px-3 py-1 rounded-full transition-colors inline-flex items-center gap-1"
              style="background-color: #8e30eb; color: white;"
              onmouseover="this.style.backgroundColor='#7a2bc7'"
              onmouseout="this.style.backgroundColor='#8e30eb'"
            >
              Follow on Nostr 🟣
            </a>
            <button 
              @click="showZapModal"
              class="text-xs px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-black rounded-full transition-colors inline-flex items-center gap-1"
            >
              ⚡ Zap Creator
            </button>
            <a 
              href="https://github.com/dmnyc/plebs-vs-zombies" 
              target="_blank"
              class="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded-full transition-colors inline-flex items-center gap-1"
            >
              View on GitHub 🤓
            </a>
          </div>
        </div>
      </div>
    </footer>

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

  <!-- Client Authorization Modal -->
  <ClientAuthorizationModal
    :show="authorizationModal.show"
    :appInfo="authorizationModal.appInfo"
    @allow="handleAuthorizationAllow"
    @deny="handleAuthorizationDeny"
  />

  <!-- Scout Mode Modal for Signed-in Users -->
  <div 
    v-if="showScoutModal" 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
    @click="closeScoutModal"
  >
    <div class="bg-zombie-dark border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4" @click.stop>
      <h3 class="text-lg font-medium text-yellow-400 mb-4">👁️🔍 Start Scout Mode</h3>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Enter npub to scout:
          </label>
          <input
            v-model="scoutNpub"
            type="text"
            placeholder="npub1..."
            class="input w-full text-center"
            :class="{'border-red-500': scoutNpubError, 'border-green-500': scoutNpubValid}"
            @keyup.enter="startScoutFromModal"
            autofocus
          />
          <div v-if="scoutNpubError" class="text-red-400 text-xs mt-1">
            {{ scoutNpubError }}
          </div>
        </div>
        
        <div class="flex gap-2">
          <button 
            @click="closeScoutModal" 
            class="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button 
            @click="startScoutFromModal" 
            :disabled="!scoutNpubValid"
            class="btn-scout flex-1"
            :class="{'opacity-50 cursor-not-allowed': !scoutNpubValid}"
          >
            Start Scouting
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { markRaw } from 'vue';
import DashboardView from './views/DashboardView.vue';
import ZombieHuntingView from './views/ZombieHuntingView.vue';
import BackupsView from './views/BackupsView.vue';
import SettingsView from './views/SettingsView.vue';
import FollowsManagerView from './views/FollowsManagerView.vue';
import ScoutModeView from './views/ScoutModeView.vue';
import CopyButton from './components/CopyButton.vue';
import ClientAuthorizationModal from './components/ClientAuthorizationModal.vue';
import nostrService from './services/nostrService';
import backupService from './services/backupService';
import immunityService from './services/immunityService';
import { nip19 } from 'nostr-tools';

export default {
  name: 'App',
  components: {
    DashboardView,
    ZombieHuntingView,
    BackupsView,
    SettingsView,
    FollowsManagerView,
    ScoutModeView,
    CopyButton,
    ClientAuthorizationModal
  },
  data() {
    return {
      isConnected: false,
      activeView: 'dashboard',
      mobileMenuOpen: false,
      userDropdownOpen: false,
      userProfile: null,
      forceUpdateKey: 0,
      zapModal: {
        show: false,
        lightningAddress: 'plebsvszombies@rizful.com',
        qrCode: ''
      },
      authorizationModal: {
        show: false,
        appInfo: {
          name: 'Plebs vs Zombies',
          pubkey: '',
          logo: '/logo.svg',
          url: window.location.origin
        },
        pendingConnection: null
      },
      views: {
        dashboard: markRaw(DashboardView),
        hunting: markRaw(ZombieHuntingView),
        backups: markRaw(BackupsView),
        settings: markRaw(SettingsView),
        follows: markRaw(FollowsManagerView),
        scout: markRaw(ScoutModeView)
      },
      // Scout Mode state
      isScoutMode: false,
      scoutNpub: '',
      scoutNpubError: '',
      scoutModeLoading: false,
      scoutTarget: null,
      showScoutModal: false
    }
  },
  computed: {
    currentView() {
      return this.views[this.activeView];
    },
    scoutNpubValid() {
      if (!this.scoutNpub.trim()) {
        this.scoutNpubError = '';
        return false;
      }
      
      try {
        // Validate npub format
        if (!this.scoutNpub.startsWith('npub1')) {
          this.scoutNpubError = 'Must start with "npub1"';
          return false;
        }
        
        if (this.scoutNpub.length !== 63) {
          this.scoutNpubError = 'Invalid npub length';
          return false;
        }
        
        // Try to decode the npub
        nip19.decode(this.scoutNpub.trim());
        this.scoutNpubError = '';
        return true;
      } catch (error) {
        this.scoutNpubError = 'Invalid npub format';
        return false;
      }
    }
  },
  methods: {
    setActiveView(view) {
      if (this.views[view]) {
        this.activeView = view;
        this.mobileMenuOpen = false; // Close mobile menu when view changes
      }
    },
    showScoutModeMenu() {
      // For signed-in users, show Scout Mode modal
      this.showScoutModal = true;
      this.scoutNpub = '';
      this.scoutNpubError = '';
    },
    closeScoutModal() {
      this.showScoutModal = false;
      this.scoutNpub = '';
      this.scoutNpubError = '';
    },
    startScoutFromModal() {
      if (this.scoutNpubValid) {
        this.showScoutModal = false;
        this.startScoutMode();
      }
    },
    async startScoutMode() {
      if (!this.scoutNpubValid) {
        console.log('❌ Npub not valid, returning');
        return;
      }
      
      this.scoutModeLoading = true;
      
      try {
        // Decode the npub to get the pubkey
        const decoded = nip19.decode(this.scoutNpub.trim());
        const targetPubkey = decoded.data;
        
        // Fetch user profile to get name/display_name
        try {
          const profileData = await nostrService.getProfileMetadata([targetPubkey]);
          const profile = profileData.get(targetPubkey);
          
          // Store scout target info with profile data
          this.scoutTarget = {
            npub: this.scoutNpub.trim(),
            pubkey: targetPubkey,
            name: profile?.name,
            display_name: profile?.display_name,
            picture: profile?.picture
          };
        } catch (error) {
          console.warn('Could not fetch profile data:', error);
          // Fallback without profile data
          this.scoutTarget = {
            npub: this.scoutNpub.trim(),
            pubkey: targetPubkey
          };
        }
        
        // Switch to scout mode
        this.isScoutMode = true;
        
        } catch (error) {
        console.error('Failed to start Scout Mode:', error);
        this.scoutNpubError = 'Failed to process npub';
      } finally {
        this.scoutModeLoading = false;
      }
    },
    exitScoutMode() {
      this.isScoutMode = false;
      this.scoutTarget = null;
      this.scoutNpub = '';
      this.scoutNpubError = '';
      this.activeView = 'dashboard';
    },
    updateScoutTarget(newTarget) {
      this.scoutTarget = newTarget;
      },
    async connectNostr() {
      try {
        // Use NIP-07 connection flow
        const connectionResult = await nostrService.connectExtension();
        console.log('✅ Extension connected successfully:', connectionResult);
        
        this.isConnected = true;
        this.userProfile = nostrService.userProfile;
        
        // Initialize other services (NDK is already initialized by connectExtension)
        backupService.init();
        await immunityService.init();
        
        console.log('🎉 Successfully connected to Nostr with', connectionResult.extensionType);
        
      } catch (error) {
        console.error('❌ Failed to connect to Nostr:', error);
        
        // Provide more specific error messages for different scenarios
        let userMessage = error.message;
        if (error.message.includes('timeout')) {
          userMessage = 'Extension connection timed out. Please make sure your Alby extension is unlocked and responding, then try again.';
        } else if (error.message.includes('denied') || error.message.includes('rejected')) {
          userMessage = 'Connection was denied. Please approve the connection request in your Nostr extension.';
        } else if (error.message.includes('No Nostr extension found')) {
          userMessage = 'No Nostr extension found. Please install Alby, nos2x, or another NIP-07 compatible extension, then refresh the page.';
        }
        
        alert(`Failed to connect to Nostr:\n\n${userMessage}\n\nIf you continue having issues, try disconnecting and reconnecting this site in your Nostr extension settings.`);
      }
    },

    logout() {
      nostrService.logout();
      this.isConnected = false;
      this.userProfile = null;
      this.userDropdownOpen = false;
      this.mobileMenuOpen = false;
      // Reset to sign-in state
      this.activeView = 'dashboard'; // Reset view state
      },
    
    formatNpub(pubkey) {
      if (!pubkey) return '';
      try {
        const npub = nip19.npubEncode(pubkey);
        return npub.substring(0, 12) + '...' + npub.substring(npub.length - 8);
      } catch (error) {
        console.error('Failed to encode npub:', error);
        return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8);
      }
    },
    
    handleAvatarError(event) {
      event.target.src = '/default-avatar.svg';
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
      window.open(`https://jumble.social/users/${creatorNpub}`, '_blank');
    },
    
    onUserProfileLoaded(event) {
      console.log('📡 Received user-profile-loaded event:', event.detail);
      
      if (event.detail && this.isConnected) {
        // Update the user profile with the loaded data
        this.userProfile = {
          ...this.userProfile,
          ...event.detail,
          // Ensure we have a default picture if none provided
          picture: event.detail.picture || '/default-avatar.svg'
        };
        
        console.log('✅ Updated userProfile with loaded data:', this.userProfile);
        
        // Force Vue reactivity update
        this.forceUpdateKey += 1;
      }
    },

    handleAuthorizationAllow(options) {
      console.log('✅ User allowed NIP-46 connection', options);
      this.authorizationModal.show = false;
      
      // TODO: Store permission preferences if remember is true
      if (options.remember) {
        // Could store app permissions in localStorage
      }
      
      // Complete the pending connection
      if (this.authorizationModal.pendingConnection) {
        this.completePendingConnection();
      }
    },

    handleAuthorizationDeny(options) {
      console.log('❌ User denied NIP-46 connection', options);
      this.authorizationModal.show = false;
      
      // TODO: Store permission preferences if remember is true
      if (options.remember) {
        // Could store app permissions in localStorage to auto-deny
      }
      
      // Cancel the pending connection
      this.authorizationModal.pendingConnection = null;
    },

    completePendingConnection() {
      if (this.authorizationModal.pendingConnection) {
        // Handle the connection completion based on the pending connection data
        // The connection logic would continue here
        this.authorizationModal.pendingConnection = null;
      }
    },

    showClientAuthorizationModal(appInfo, pendingConnection = null) {
      console.log('🔐 Showing client authorization modal for:', appInfo.name);
      this.authorizationModal.appInfo = {
        name: appInfo.name || 'Unknown App',
        pubkey: appInfo.pubkey ? (appInfo.pubkey.substring(0, 8) + '...' + appInfo.pubkey.substring(-4)) : '',
        logo: appInfo.logo || '/logo.svg',
        url: appInfo.url || ''
      };
      this.authorizationModal.pendingConnection = pendingConnection;
      this.authorizationModal.show = true;
    }
  },
  async mounted() {
    // Try to restore session from localStorage
    const sessionRestored = await nostrService.restoreSession();
    if (sessionRestored && nostrService.isExtensionReady()) {
      this.isConnected = true;
      this.userProfile = nostrService.userProfile;
      
      console.log('📋 Final userProfile:', this.userProfile);
    } else if (sessionRestored) {
      // Session data exists but extension not ready - clear it
      console.log('⚠️ Session data found but extension not ready - clearing session');
      nostrService.logout();
    }
    
    // Initialize services
    backupService.init();
    immunityService.init();

    // Listen for user profile loaded events
    window.addEventListener('user-profile-loaded', this.onUserProfileLoaded);
    
    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
      if (this.mobileMenuOpen && !e.target.closest('header')) {
        this.mobileMenuOpen = false;
      }
      if (this.userDropdownOpen && !e.target.closest('.relative')) {
        this.userDropdownOpen = false;
      }
    });
  },
  
  beforeUnmount() {
    window.removeEventListener('user-profile-loaded', this.onUserProfileLoaded);
  }
}
</script>