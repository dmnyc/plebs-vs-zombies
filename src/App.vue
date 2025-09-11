<template>
  <div class="min-h-screen flex flex-col bg-gray-900">
    <header class="bg-zombie-dark border-b border-gray-700 shadow-lg">
      <div class="container mx-auto px-4 py-4">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3 cursor-pointer" @click="setActiveView('dashboard')">
            <img src="/logo.svg" alt="Plebs vs Zombies" class="w-12 h-12" />
            <h1 class="text-2xl sm:text-3xl hover:text-zombie-green transition-colors">Plebs vs. Zombies</h1>
          </div>
          
          <div class="flex items-center gap-4">
            <!-- Desktop Navigation -->
            <nav v-if="isConnected" class="hidden lg:block">
              <ul class="flex gap-6">
                <li>
                  <a 
                    href="#" 
                    @click.prevent="setActiveView('dashboard')" 
                    :class="{'text-zombie-green': activeView === 'dashboard', 'hover:text-zombie-green transition-colors': activeView !== 'dashboard'}"
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
              </ul>
            </nav>
            
            <!-- User Avatar and Dropdown (Desktop) -->
            <div v-if="isConnected && userProfile" class="relative hidden lg:block">
              <button 
                @click="userDropdownOpen = !userDropdownOpen"
                class="flex items-center gap-2 hover:bg-gray-800 rounded-lg p-2 transition-colors"
              >
                <img 
                  :src="userProfile.picture || '/default-avatar.svg'" 
                  :alt="userProfile.name || userProfile.display_name || 'User'"
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
                  <div class="font-medium text-white">{{ userProfile.display_name || userProfile.name || 'Anonymous' }}</div>
                  <div class="text-sm text-gray-400 flex items-center">
                    <span class="truncate">{{ formatNpub(userProfile.pubkey) }}</span>
                    <CopyButton :pubkey="userProfile.pubkey" />
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
          </div>
          
          <!-- Mobile/Tablet Hamburger Button -->
          <button 
            v-if="isConnected"
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="lg:hidden flex flex-col justify-center items-center w-8 h-8 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
            :class="{'bg-gray-800': mobileMenuOpen}"
          >
            <span class="w-5 h-0.5 bg-white transition-all" :class="mobileMenuOpen ? 'rotate-45 translate-y-1' : ''"></span>
            <span class="w-5 h-0.5 bg-white mt-1 transition-all" :class="mobileMenuOpen ? 'opacity-0' : ''"></span>
            <span class="w-5 h-0.5 bg-white mt-1 transition-all" :class="mobileMenuOpen ? '-rotate-45 -translate-y-1' : ''"></span>
          </button>
        </div>
        
        <!-- Mobile/Tablet Navigation Menu -->
        <nav v-if="isConnected && mobileMenuOpen" class="lg:hidden mt-4 pt-4 border-t border-gray-700">
          <!-- User Info Section (Mobile) -->
          <div v-if="isConnected && userProfile" class="mb-4 p-3 bg-gray-800 rounded-lg">
            <div class="flex items-center gap-3 mb-3">
              <img 
                :src="userProfile.picture || '/default-avatar.svg'" 
                :alt="userProfile.name || userProfile.display_name || 'User'"
                class="w-10 h-10 rounded-full object-cover bg-gray-700"
                @error="handleAvatarError"
              />
              <div class="flex-1 min-w-0">
                <div class="font-medium text-white truncate">{{ userProfile.display_name || userProfile.name || 'Anonymous' }}</div>
                <div class="text-sm text-gray-400 flex items-center">
                  <span class="truncate">{{ formatNpub(userProfile.pubkey) }}</span>
                  <CopyButton :pubkey="userProfile.pubkey" />
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
                :class="{'text-zombie-green bg-gray-800': activeView === 'dashboard'}"
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
          </ul>
        </nav>
      </div>
    </header>

    <main class="container mx-auto px-4 py-8 flex-grow">
      <div v-if="!isConnected" class="card max-w-2xl mx-auto my-12">
        <div class="text-center mb-8">
          <div class="text-6xl mb-6">🧟‍♂️</div>
          <h2 class="text-3xl mb-4">Connect to start hunting zombies!</h2>
          <p class="text-gray-300">Choose your signing method to connect and manage your dormant follows.</p>
        </div>
        
        <!-- Signing Method Selection -->
        <div class="space-y-4 mb-8">
          <h3 class="text-lg text-gray-300 mb-4 text-center">How would you like to connect?</h3>
          
          <label class="flex items-start gap-4 p-4 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
            <input 
              type="radio" 
              value="nip07" 
              v-model="loginSigningMethod" 
              class="w-5 h-5 text-zombie-green focus:ring-zombie-green mt-0.5"
            />
            <div class="flex-grow">
              <span class="text-lg font-medium text-gray-200">Browser Extension (NIP-07)</span>
              <p class="text-sm text-gray-400 mt-1">Use Alby, nos2x, or other browser extensions</p>
              <div class="flex flex-wrap gap-2 mt-2">
                <span class="text-xs bg-green-900 text-green-300 px-2 py-1 rounded">✅ Easy setup</span>
                <span class="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded">⚡ Fast signing</span>
              </div>
            </div>
          </label>
          
          <label class="flex items-start gap-4 p-4 border border-gray-600 rounded-lg opacity-50 cursor-not-allowed transition-colors">
            <input 
              type="radio" 
              value="nip46" 
              v-model="loginSigningMethod" 
              disabled
              class="w-5 h-5 text-gray-500 mt-0.5 cursor-not-allowed"
            />
            <div class="flex-grow">
              <span class="text-lg font-medium text-gray-400">Remote Signer (NIP-46)</span>
              <p class="text-sm text-gray-500 mt-1">Connect to nsec.app, nsecBunker, or other remote signers</p>
              <div class="flex flex-wrap gap-2 mt-2">
                <span class="text-xs bg-gray-800 text-gray-500 px-2 py-1 rounded">🚧 Coming Soon</span>
                <span class="text-xs bg-purple-900 text-purple-400 px-2 py-1 rounded opacity-60">📱 Mobile friendly</span>
                <span class="text-xs bg-yellow-900 text-yellow-400 px-2 py-1 rounded opacity-60">🔒 Enhanced security</span>
              </div>
            </div>
          </label>
        </div>
        
        <div class="text-center">
          <button @click="connectNostr" :disabled="!loginSigningMethod" class="btn-primary text-lg px-8 py-3">
            {{ getConnectButtonText() }}
          </button>
          
          <p class="text-xs text-gray-500 mt-4">
            You can change your signing method later in Settings
          </p>
        </div>
      </div>

      <div v-else>
        <component :is="currentView"></component>
      </div>
    </main>

    <!-- NIP-46 Setup Modal -->
    <div 
      v-if="showNip46Setup" 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
      @click="closeNip46Setup"
    >
      <div class="bg-zombie-dark border border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" @click.stop>
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-2xl font-bold text-gray-100">Setup Remote Signer</h2>
              <p class="text-gray-400 mt-1">Connect to your NIP-46 bunker to continue</p>
            </div>
            <button 
              @click="closeNip46Setup"
              class="text-gray-400 hover:text-gray-200 text-2xl leading-none"
            >
              ×
            </button>
          </div>
          
          <!-- Use the existing Nip46Connection component -->
          <Nip46Connection 
            @connected="onNip46Connected"
            @disconnected="closeNip46Setup"
          />
        </div>
      </div>
    </div>

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
</template>

<script>
import { markRaw } from 'vue';
import DashboardView from './views/DashboardView.vue';
import ZombieHuntingView from './views/ZombieHuntingView.vue';
import BackupsView from './views/BackupsView.vue';
import SettingsView from './views/SettingsView.vue';
import FollowsManagerView from './views/FollowsManagerView.vue';
import CopyButton from './components/CopyButton.vue';
import Nip46Connection from './components/Nip46Connection.vue';
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
    CopyButton,
    Nip46Connection
  },
  data() {
    return {
      isConnected: false,
      activeView: 'dashboard',
      mobileMenuOpen: false,
      userDropdownOpen: false,
      userProfile: null,
      loginSigningMethod: 'nip07', // Default to NIP-07 for login
      showNip46Setup: false, // Show NIP-46 setup modal
      zapModal: {
        show: false,
        lightningAddress: 'plebsvszombies@rizful.com',
        qrCode: ''
      },
      views: {
        dashboard: markRaw(DashboardView),
        hunting: markRaw(ZombieHuntingView),
        backups: markRaw(BackupsView),
        settings: markRaw(SettingsView),
        follows: markRaw(FollowsManagerView)
      }
    }
  },
  computed: {
    currentView() {
      return this.views[this.activeView];
    }
  },
  methods: {
    setActiveView(view) {
      if (this.views[view]) {
        this.activeView = view;
        this.mobileMenuOpen = false; // Close mobile menu when view changes
      }
    },
    async connectNostr() {
      try {
        console.log(`🚀 Starting Nostr connection with ${this.loginSigningMethod}...`);
        
        // Only set the signing method if it's different to avoid resetting NDK
        if (nostrService.getSigningMethod() !== this.loginSigningMethod) {
          nostrService.setSigningMethod(this.loginSigningMethod);
        }
        
        if (this.loginSigningMethod === 'nip07') {
          // Use NIP-07 connection flow
          const connectionResult = await nostrService.connectExtension();
          console.log('✅ Extension connected successfully:', connectionResult);
          
          this.isConnected = true;
          this.userProfile = nostrService.userProfile;
          
          // Initialize other services (NDK is already initialized by connectExtension)
          backupService.init();
          await immunityService.init();
          
          console.log('🎉 Successfully connected to Nostr with', connectionResult.extensionType);
          
        } else if (this.loginSigningMethod === 'nip46') {
          // For NIP-46, show the setup modal
          console.log('📱 Opening NIP-46 setup modal...');
          this.showNip46Setup = true;
          return; // Don't mark as connected yet
        }
        
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
    
    getConnectButtonText() {
      if (!this.loginSigningMethod) return 'Select a method';
      
      if (this.loginSigningMethod === 'nip07') {
        return 'Connect Browser Extension';
      } else if (this.loginSigningMethod === 'nip46') {
        return 'Setup Remote Signer';
      }
      
      return 'Connect to Nostr';
    },
    
    logout() {
      nostrService.logout();
      this.isConnected = false;
      this.userProfile = null;
      this.userDropdownOpen = false;
      this.mobileMenuOpen = false;
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
    
    onNip46Connected(event) {
      console.log('✅ NIP-46 connected from setup modal:', event.detail);
      this.isConnected = true;
      this.userProfile = {
        pubkey: event.detail.pubkey,
        // NIP-46 doesn't provide profile initially, will be loaded later
        display_name: event.detail.pubkey.substring(0, 8) + '...',
        name: 'NIP-46 User'
      };
      
      // Initialize other services
      backupService.init();
      immunityService.init();
      
      // Close the setup modal and navigate to dashboard
      this.showNip46Setup = false;
      this.activeView = 'dashboard';
    },
    
    closeNip46Setup() {
      this.showNip46Setup = false;
      this.loginSigningMethod = 'nip07'; // Reset to default
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
    }
  },
  async mounted() {
    // Try to restore session from localStorage
    const sessionRestored = await nostrService.restoreSession();
    if (sessionRestored && (nostrService.isExtensionReady() || nostrService.isBunkerReady())) {
      this.isConnected = true;
      this.userProfile = nostrService.userProfile;
      console.log('✅ Session restored successfully');
    } else if (sessionRestored) {
      // Session data exists but no signing method ready - clear it
      console.log('⚠️ Session data found but no signing method ready - clearing session');
      nostrService.logout();
    }
    
    // Initialize services
    backupService.init();
    immunityService.init();
    
    // Listen for NIP-46 connection events from SettingsView
    window.addEventListener('nip46-connected', this.onNip46Connected);
    
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
    window.removeEventListener('nip46-connected', this.onNip46Connected);
  }
}
</script>