<template>
  <div class="min-h-screen flex flex-col bg-gray-900">
    <header class="bg-zombie-dark border-b border-gray-700 shadow-lg">
      <div class="container mx-auto px-4 py-4">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <img src="/logo.svg" alt="Plebs vs Zombies" class="w-12 h-12" />
            <h1 class="text-2xl sm:text-3xl">Plebs vs. Zombies</h1>
          </div>
          
          <div class="flex items-center gap-4">
            <!-- Desktop Navigation -->
            <nav class="hidden lg:block">
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
        <nav v-if="mobileMenuOpen" class="lg:hidden mt-4 pt-4 border-t border-gray-700">
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
      <div v-if="!isConnected" class="card max-w-xl mx-auto my-12 text-center">
        <h2 class="text-2xl mb-6">Connect to start hunting zombies!</h2>
        <p class="mb-8">Connect your Nostr extension to manage your dormant follows and clean up your follow list.</p>
        <button @click="connectNostr" class="btn-primary text-lg">Connect to Nostr</button>
      </div>

      <div v-else>
        <component :is="currentView"></component>
      </div>
    </main>

    <footer class="mt-auto py-6 bg-zombie-dark border-t border-gray-700">
      <div class="container mx-auto px-4 text-center text-gray-400">
        <p>Plebs vs. Zombies &copy; 2025 | Made with 🧠 for the Nostr community</p>
      </div>
    </footer>
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
    CopyButton
  },
  data() {
    return {
      isConnected: false,
      activeView: 'dashboard',
      mobileMenuOpen: false,
      userDropdownOpen: false,
      userProfile: null,
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
        // Check if NIP-07 extension is available
        if (typeof window.nostr === 'undefined') {
          console.error('window.nostr is undefined');
          alert('No Nostr extension found. Please install a NIP-07 compatible extension like nos2x or Alby, then refresh the page.');
          return;
        }

        console.log('window.nostr found:', window.nostr);
        console.log('Available methods:', Object.keys(window.nostr));

        // Request public key
        console.log('Requesting public key...');
        const pubkey = await nostrService.getPublicKey();
        console.log('Got pubkey:', pubkey);
        
        this.isConnected = true;
        this.userProfile = nostrService.userProfile;
        
        // Initialize services
        await nostrService.initialize();
        backupService.init();
        await immunityService.init();
        
        console.log('Successfully connected to Nostr');
        
      } catch (error) {
        console.error('Failed to connect to Nostr:', error);
        console.error('Error details:', error.message, error.stack);
        alert(`Failed to connect to Nostr: ${error.message}. Check the console for details.`);
      }
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
    }
  },
  async mounted() {
    // Try to restore session from localStorage
    const sessionRestored = await nostrService.restoreSession();
    if (sessionRestored) {
      this.isConnected = true;
      this.userProfile = nostrService.userProfile;
    }
    
    // Initialize services
    backupService.init();
    immunityService.init();
    
    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
      if (this.mobileMenuOpen && !e.target.closest('header')) {
        this.mobileMenuOpen = false;
      }
      if (this.userDropdownOpen && !e.target.closest('.relative')) {
        this.userDropdownOpen = false;
      }
    });
  }
}
</script>