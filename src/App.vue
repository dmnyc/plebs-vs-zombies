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
            <!-- Desktop Navigation for signed-in users -->
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
                    class="font-bold text-lg inline-flex items-center gap-1"
                    style="line-height: 0.75rem;"
                  >
                    <span class="text-base">🧟</span>
                    <span>Hunt Zombies</span>
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
            
            <!-- Desktop Navigation for signed-out Scout Mode -->
            <nav v-if="!isConnected && isScoutMode" class="hidden lg:block">
              <ul class="flex gap-6">
                <li>
                  <a 
                    href="#" 
                    @click.prevent="async () => await exitScoutMode()" 
                    class="hover:text-zombie-green transition-colors"
                  >
                    Start Over
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
                class="block px-4 py-4 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors font-bold text-lg border-2 border-zombie-green/30"
              >
                🧟 Hunt Zombies
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
        
        <!-- Mobile/Tablet Navigation Menu for signed-out Scout Mode -->
        <nav v-if="!isConnected && isScoutMode && mobileMenuOpen" class="lg:hidden mt-4 pt-4 border-t border-gray-700">
          <ul class="space-y-2">
            <li>
              <a 
                href="#" 
                @click.prevent="async () => { await exitScoutMode(); mobileMenuOpen = false; }" 
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Start Over
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
          ref="scoutModeComponent"
          :scout-target="scoutTarget"
          :is-logged-in="isConnected"
          @update-target="updateScoutTarget"
          @exit-scout="exitScoutMode"
        />
      </div>

      <!-- Login Screen -->
      <div v-else-if="!isConnected">
        <!-- [TEMPORARY - October 2025 Competition] Top Zombie Challenge Banner -->
        <!-- REMOVE AFTER: October 31, 2025 -->
        <div v-if="showCompetitionBanner" class="max-w-4xl mx-auto mb-6">
          <div class="relative bg-gradient-to-r from-purple-900/90 via-red-900/90 to-orange-900/90 border-2 border-yellow-500 rounded-lg p-6 shadow-2xl">
            <!-- Close Button -->
            <button
              @click="showCompetitionBanner = false"
              class="absolute top-3 right-3 text-gray-300 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/30 transition-colors"
              aria-label="Close banner"
            >
              ×
            </button>

            <!-- Banner Content -->
            <div class="text-center">
              <div class="text-4xl mb-3">🏆💀⚡</div>
              <h2 class="text-2xl sm:text-3xl font-bold text-yellow-400 mb-2">
                TOP ZOMBIE CHALLENGE - OCTOBER 2025
              </h2>
              <p class="text-gray-200 text-lg mb-4">
                The hunt is ON! Compete for over <strong class="text-yellow-400">100K sats</strong> in prizes!
              </p>

              <div class="flex flex-col sm:flex-row gap-3 justify-center items-center mb-4">
                <a
                  href="/competition.html"
                  target="_blank"
                  class="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg transition-colors shadow-lg"
                >
                  🎯 Competition Rules
                </a>
                <a
                  href="/leaderboard.html"
                  target="_blank"
                  class="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-lg transition-colors shadow-lg"
                >
                  📊 View Leaderboard
                </a>
              </div>

              <!-- Sponsor Credit -->
              <div class="flex items-center justify-center gap-2 py-3 px-4 bg-black/30 rounded-lg mb-3 mx-auto max-w-md">
                <span class="text-gray-300 text-sm font-medium">Sponsored by</span>
                <a
                  href="https://rizful.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:opacity-80 transition-opacity"
                >
                  <img
                    src="/rizful_logo_white.png"
                    alt="Rizful"
                    class="h-6 w-auto"
                  />
                </a>
              </div>

              <p class="text-gray-300 text-sm">
                Sign in to start hunting zombies and claim your spot on the leaderboard!
              </p>
            </div>
          </div>
        </div>

        <!-- Login Card -->
        <div class="card max-w-2xl mx-auto my-12">
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

        <!-- TEMPORARILY DISABLED - Multiple Signing Method Selection -->
        <!--
        <div class="text-center mb-8">
          <div class="text-6xl mb-6">🧟‍♂️</div>
          <h2 class="text-3xl mb-4">Connect to start hunting zombies!</h2>
          <p class="text-gray-300">Choose your signing method to connect and manage your dormant follows.</p>
        </div>
        
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
        </div>
        -->
          
          <!-- TEMPORARILY DISABLED - NIP-46 Remote Signer -->
          <!--
          <label class="flex items-start gap-4 p-4 border border-gray-600 rounded-lg hover:border-purple-500 transition-colors cursor-pointer"
                 :class="loginSigningMethod === 'nip46' ? 'border-purple-500 bg-purple-900/20' : ''">
            <input 
              type="radio" 
              value="nip46" 
              v-model="loginSigningMethod" 
              class="w-5 h-5 text-purple-500 mt-0.5"
            />
            <div class="flex-grow">
              <span class="text-lg font-medium text-gray-100">Remote Signer (NIP-46)</span>
              <p class="text-sm text-gray-400 mt-1">Connect to nsec.app, nsecBunker, or other remote signers</p>
              <div class="flex flex-wrap gap-2 mt-2">
                <span class="text-xs bg-purple-900 text-purple-300 px-2 py-1 rounded">📱 Mobile friendly</span>
                <span class="text-xs bg-yellow-900 text-yellow-300 px-2 py-1 rounded">🔒 Enhanced security</span>
              </div>
            </div>
          </label>
          -->

          <div class="text-center">
            <button
              @click="connectNostr"
              :disabled="isConnecting"
              class="btn-primary text-lg px-8 py-3 transition-all"
              :class="{'opacity-50 cursor-not-allowed': isConnecting}"
            >
              <span v-if="isConnecting">🔄 Signing in...</span>
              <span v-else>Connect with Browser Extension</span>
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
                <label class="block text-sm font-medium text-gray-300 mb-2">
                  Search for a user to scout:
                </label>
                <ProfileSearchInput
                  ref="loginScoutInput"
                  placeholder="Search by username or paste npub/nprofile..."
                  @profile-selected="handleLoginScoutProfileSelected"
                  @input-changed="handleScoutInputChanged"
                />
              </div>

              <button
                @click="startScoutMode"
                :disabled="!scoutInputValue || scoutModeLoading"
                class="btn-secondary w-full flex items-center justify-center gap-2"
                :class="{'opacity-50 cursor-not-allowed': !scoutInputValue || scoutModeLoading}"
              >
                <span v-if="scoutModeLoading">🔍</span>
                <span v-else>🏹</span>
                {{ scoutModeLoading ? 'Starting Scout Mode...' : 'Start Scouting' }}
              </button>
              <div v-if="scoutInputError" class="text-red-400 text-xs mt-1">
                {{ scoutInputError }}
              </div>
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
      </div>

      <!-- Main App Views -->
      <div v-else>
        <component :is="currentView" ref="currentViewComponent" @logout="logout"></component>
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
            Search for a user to scout:
          </label>
          <ProfileSearchInput
            ref="modalScoutInput"
            placeholder="Search by username or paste npub/nprofile..."
            :auto-focus="true"
            @profile-selected="handleModalScoutProfileSelected"
            @input-changed="handleScoutInputChanged"
          />
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
            :disabled="!scoutInputValue"
            class="btn-scout flex-1"
            :class="{'opacity-50 cursor-not-allowed': !scoutInputValue}"
          >
            Start Scouting
          </button>
        </div>
        <div v-if="scoutInputError" class="text-red-400 text-xs mt-2">
          {{ scoutInputError }}
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
import Nip46Connection from './components/Nip46Connection.vue';
import ClientAuthorizationModal from './components/ClientAuthorizationModal.vue';
import ProfileSearchInput from './components/ProfileSearchInput.vue';
import nostrService from './services/nostrService';
import backupService from './services/backupService';
import immunityService from './services/immunityService';
import scoutService from './services/scoutService';
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
    Nip46Connection,
    ClientAuthorizationModal,
    ProfileSearchInput
  },
  data() {
    return {
      isConnected: false,
      activeView: 'dashboard',
      mobileMenuOpen: false,
      userDropdownOpen: false,
      userProfile: null,
      loginSigningMethod: 'nip07', // Default to NIP-07 for login
      forceUpdateKey: 0,
      showNip46Setup: false, // Show NIP-46 setup modal
      showCompetitionBanner: true, // [TEMPORARY - October 2025] Show competition banner
      isConnecting: false, // Track connection state for visual feedback
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
      scoutModeLoading: false,
      scoutTarget: null,
      showScoutModal: false,
      selectedScoutProfile: null, // Stores selected profile from ProfileSearchInput
      scoutInputValue: '', // Tracks input value for button enable/disable
      scoutInputError: '' // Error message for validation
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
        
        // Exit scout mode when navigating to other views
        if (this.isScoutMode && view !== 'scout') {
          this.exitScoutMode();
        }
      }
    },
    handleLoginScoutProfileSelected(profile) {
      console.log('📝 Login scout profile selected:', profile);
      this.selectedScoutProfile = profile;
      this.scoutInputError = ''; // Clear any errors when profile is selected
    },
    handleModalScoutProfileSelected(profile) {
      console.log('📝 Modal scout profile selected:', profile);
      this.selectedScoutProfile = profile;
      this.scoutInputError = ''; // Clear any errors when profile is selected
    },
    handleScoutInputChanged(value) {
      this.scoutInputValue = value;
      this.scoutInputError = ''; // Clear error when user types
      // Clear selected profile if input changes significantly
      if (this.selectedScoutProfile && value !== this.selectedScoutProfile.npub) {
        const currentDisplay = this.selectedScoutProfile.display_name ||
                              this.selectedScoutProfile.name || '';
        if (value !== currentDisplay) {
          this.selectedScoutProfile = null;
        }
      }
    },
    showScoutModeMenu() {
      // For signed-in users, show Scout Mode modal
      this.showScoutModal = true;
      this.selectedScoutProfile = null;
      this.scoutInputValue = '';
      this.scoutInputError = '';

      // Clear the input when modal opens
      this.$nextTick(() => {
        this.$refs.modalScoutInput?.clear();
      });
    },
    closeScoutModal() {
      this.showScoutModal = false;
      this.selectedScoutProfile = null;
      this.scoutInputValue = '';
      this.scoutInputError = '';

      // Clear the input
      this.$refs.modalScoutInput?.clear();
    },
    async startScoutFromModal() {
      console.log('🔍 Start Scout From Modal clicked!');
      this.scoutInputError = '';

      let profile = this.selectedScoutProfile;

      // If no profile selected from dropdown, validate and fetch from input
      if (!profile) {
        const result = await this.$refs.modalScoutInput.validateAndFetch();

        if (!result.valid) {
          this.scoutInputError = result.error;
          return;
        }

        profile = result.profile;
      }

      // Store the profile for startScoutMode to use
      this.selectedScoutProfile = profile;
      this.showScoutModal = false;

      // If already in Scout Mode, force a complete reset by exiting and re-entering
      if (this.isScoutMode) {
        console.log('🔄 Already in Scout Mode, doing complete reset...');

        // Force shutdown and reset scout service
        await scoutService.forceShutdown();
        await scoutService.reset();

        // Temporarily exit scout mode to force component remount
        this.isScoutMode = false;
        this.scoutTarget = null;

        // Wait for Vue to process the state change
        await this.$nextTick();

        // Now start scout mode with new target
        await this.startScoutMode();
      } else {
        // Not in Scout Mode yet, start normally
        await this.startScoutMode();
      }
    },
    async startScoutMode() {
      console.log('🔍 Start Scout Mode clicked!');
      this.scoutInputError = '';
      this.scoutModeLoading = true;

      try {
        let profile = this.selectedScoutProfile;

        // If no profile selected from dropdown, validate and fetch from input
        if (!profile) {
          const result = await this.$refs.loginScoutInput.validateAndFetch();

          if (!result.valid) {
            this.scoutInputError = result.error;
            this.scoutModeLoading = false;
            return;
          }

          profile = result.profile;
        }

        console.log('✅ Profile to scout:', profile);

        // Use the profile data
        this.scoutTarget = {
          npub: profile.npub,
          pubkey: profile.pubkey,
          name: profile.name,
          display_name: profile.display_name,
          picture: profile.picture
        };

        // Switch to scout mode
        this.isScoutMode = true;

        console.log('🔍 Starting Scout Mode for:', this.scoutTarget);

      } catch (error) {
        console.error('Failed to start Scout Mode:', error);
        this.scoutInputError = 'Failed to start Scout Mode. Please try again.';
      } finally {
        this.scoutModeLoading = false;
      }
    },
    async exitScoutMode() {
      // Force shutdown all scout activity and connections
      await scoutService.forceShutdown();

      this.isScoutMode = false;
      this.scoutTarget = null;
      this.selectedScoutProfile = null;
      this.scoutInputValue = '';
      this.scoutInputError = '';

      // Clear the inputs
      this.$refs.loginScoutInput?.clear();
      this.$refs.modalScoutInput?.clear();

      this.activeView = 'dashboard';
    },
    updateScoutTarget(newTarget) {
      this.scoutTarget = newTarget;
      console.log('🔄 Updated scout target:', newTarget);
    },
    async connectNostr() {
      try {
        this.isConnecting = true;
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
      } finally {
        this.isConnecting = false;
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
      
      // Exit Scout Mode if active
      if (this.isScoutMode) {
        this.exitScoutMode();
      }
      
      // Reset to sign-in state
      this.activeView = 'dashboard'; // Reset view state
      console.log('✅ Logged out and returned to sign-in page');
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
    
    onNip46Connected(result) {
      console.log('✅ NIP-46 connected from setup modal:', result);
      
      // Handle both direct result object and CustomEvent
      const data = result?.detail || result;
      
      if (!data || !data.pubkey) {
        console.error('❌ Invalid connection data:', result);
        return;
      }
      
      console.log('🔄 Setting isConnected = true and userProfile');
      this.isConnected = true;
      
      // CRITICAL: Set pubkey in nostrService for other parts of the app
      nostrService.pubkey = data.pubkey;
      nostrService.setSigningMethod('nip46');
      console.log('✅ Set nostrService.pubkey:', data.pubkey.substring(0, 8) + '...');
      
      // Check if we already have profile data in nostrService
      const existingProfile = nostrService.userProfile;
      
      this.userProfile = existingProfile ? {
        ...existingProfile,
        picture: existingProfile.picture || '/default-avatar.svg' // Ensure we have a picture
      } : {
        pubkey: data.pubkey,
        // NIP-46 doesn't provide profile initially, will be loaded later
        display_name: data.pubkey.substring(0, 8) + '...',
        name: 'NIP-46 User',
        picture: '/default-avatar.svg'
      };
      
      console.log('✅ State after setting:', {
        isConnected: this.isConnected,
        userProfile: this.userProfile,
        showNip46Setup: this.showNip46Setup
      });
      console.log('📋 userProfile details:', JSON.stringify(this.userProfile, null, 2));
      
      // Initialize other services
      backupService.init();
      immunityService.init();
      
      // Close the setup modal and navigate to dashboard immediately
      console.log('🔄 Closing modal and navigating to dashboard');
      this.showNip46Setup = false;
      this.activeView = 'dashboard';
      
      console.log('✅ Final state:', {
        isConnected: this.isConnected,
        userProfile: this.userProfile,
        showNip46Setup: this.showNip46Setup,
        activeView: this.activeView
      });
      
      // Force Vue reactivity update using key technique
      this.forceUpdateKey += 1;
      
      // Load the user profile data which will dispatch user-profile-loaded event
      console.log('🔄 Loading user profile data...');
      // Use setTimeout to not block the UI update
      setTimeout(() => {
        nostrService.loadUserProfile().then(() => {
          console.log('✅ User profile loading initiated');
        }).catch(error => {
          console.warn('⚠️ Failed to load user profile:', error);
        });
      }, 100); // Small delay to let UI update first
      
      // Force dashboard to refresh follow data after connection
      this.$nextTick(() => {
        if (this.activeView === 'dashboard' && this.$refs.currentViewComponent) {
          console.log('🔄 Forcing dashboard refresh after NIP-46 connection');
          this.$refs.currentViewComponent.loadDashboardData?.();
        }
      });
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
        console.log('💾 User wants to remember this decision for future connections');
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
        console.log('💾 User wants to remember this decision for future connections');
        // Could store app permissions in localStorage to auto-deny
      }
      
      // Cancel the pending connection
      this.authorizationModal.pendingConnection = null;
    },

    completePendingConnection() {
      if (this.authorizationModal.pendingConnection) {
        // Handle the connection completion based on the pending connection data
        console.log('🔗 Completing authorized connection');
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
    if (sessionRestored && (nostrService.isExtensionReady() || nostrService.isBunkerReady())) {
      this.isConnected = true;
      
      // For NIP-46, create default profile if userProfile is not set or incomplete
      if (nostrService.getSigningMethod() === 'nip46' && nostrService.pubkey) {
        this.userProfile = nostrService.userProfile || {
          pubkey: nostrService.pubkey,
          display_name: nostrService.pubkey.substring(0, 8) + '...',
          name: 'NIP-46 User',
          picture: '/default-avatar.svg'
        };
        
        // If userProfile exists but is missing picture, add default
        if (this.userProfile && !this.userProfile.picture) {
          this.userProfile.picture = '/default-avatar.svg';
        }
      } else {
        this.userProfile = nostrService.userProfile;
      }
      
      console.log('✅ Session restored successfully');
      console.log('📋 Final userProfile:', this.userProfile);
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
    window.removeEventListener('nip46-connected', this.onNip46Connected);
    window.removeEventListener('user-profile-loaded', this.onUserProfileLoaded);
  }
}
</script>