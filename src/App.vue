<template>
  <div class="min-h-screen flex flex-col" :class="{ 'zombie-mode': zombieMode }">
    <!-- Ambient background: gradient field, drifting fog, grid, grain, distress overlay -->
    <div class="app-bg" aria-hidden="true">
      <div class="app-bg-fog app-bg-fog-a"></div>
      <div class="app-bg-fog app-bg-fog-b"></div>
      <div class="app-bg-distressed"></div>
      <div class="app-bg-grain"></div>
    </div>

    <header ref="headerEl" :class="headerGlass" class="fixed top-0 left-0 right-0 z-40 backdrop-blur-xl transition-all duration-300" :key="forceUpdateKey">
      <div class="container mx-auto px-4 transition-all duration-300" :class="headerPad">
        <div class="flex items-center" :class="isLoginScreen ? 'justify-center' : 'justify-between'">
          <div class="flex items-center gap-3 group" :class="isScoutMode ? '' : 'cursor-pointer'" @click="handleLogoClick">
            <img src="/logo.svg" alt="Plebs vs Zombies" class="transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 drop-shadow-[0_0_14px_rgba(92,219,92,0.55)]" :class="[logoSize, { 'animate-lurch': zombieMode }]" />
            <div class="flex flex-col">
              <h1
                class="transition-all duration-300 animate-flicker text-gradient"
                :class="brandSize"
              >
                Plebs vs. Zombies
              </h1>
            </div>
          </div>

          <div class="flex items-center">
            <!-- Desktop Navigation for signed-in users -->
            <nav v-if="isConnected" class="hidden xl:block">
              <ul class="flex gap-1.5 items-center">
                <li>
                  <a
                    href="#"
                    @click.prevent="setActiveView('dashboard')"
                    class="nav-pill"
                    :class="navPill(activeView === 'dashboard' && !isScoutMode)"
                  >
                    Dashboard
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    @click.prevent="setActiveView('hunting')"
                    class="nav-pill inline-flex items-center gap-1"
                    :class="navPill(activeView === 'hunting')"
                  >
                    <span>🧟</span>
                    <span>Hunt Zombies</span>
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    @click.prevent="setActiveView('follows')"
                    class="nav-pill"
                    :class="navPill(activeView === 'follows')"
                  >
                    Follows
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    @click.prevent="setActiveView('backups')"
                    class="nav-pill"
                    :class="navPill(activeView === 'backups')"
                  >
                    Backups
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    @click.prevent="setActiveView('settings')"
                    class="nav-pill"
                    :class="navPill(activeView === 'settings')"
                  >
                    Settings
                  </a>
                </li>
                <li class="relative more-dropdown">
                  <a
                    href="#"
                    @click.prevent="moreDropdownOpen = !moreDropdownOpen; userDropdownOpen = false"
                    class="nav-pill inline-flex items-center gap-1"
                    :class="navPill(isMoreActive)"
                  >
                    More
                    <span class="text-xs transition-transform duration-200" :class="{'rotate-180': moreDropdownOpen}">▾</span>
                  </a>
                  <Transition name="drop">
                    <div
                      v-if="moreDropdownOpen"
                      class="absolute right-0 mt-2 w-44 bg-zombie-dark/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 z-50 p-1.5 origin-top-right"
                    >
                    <a
                      href="#"
                      @click.prevent="setActiveView('zombieCheck'); moreDropdownOpen = false"
                      class="block px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                      :class="activeView === 'zombieCheck' && !isScoutMode ? 'text-zombie-green' : ''"
                    >
                      Zombie Check
                    </a>
                    <a
                      href="#"
                      @click.prevent="showScoutModeMenu(); moreDropdownOpen = false"
                      class="block px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                      :class="isScoutMode ? 'text-zombie-green' : ''"
                    >
                      Scout Mode
                    </a>
                    <a
                      href="#"
                      @click.prevent="setActiveView('resurrector'); moreDropdownOpen = false"
                      class="block px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                      :class="activeView === 'resurrector' && !isScoutMode ? 'text-zombie-green' : ''"
                    >
                      Resurrector
                    </a>
                  </div>
                  </Transition>
                </li>
              </ul>
            </nav>

            <!-- Desktop Navigation for signed-out Scout Mode -->
            <nav v-if="!isConnected && isScoutMode" class="hidden xl:block">
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
                  @click="userDropdownOpen = !userDropdownOpen; moreDropdownOpen = false"
                  class="hover:bg-gray-800 rounded-lg transition-colors xl:ml-4"
                >
                  <img
                    :src="userProfile?.picture || '/default-avatar.svg'"
                    :alt="userProfile?.name || userProfile?.display_name || 'User'"
                    class="w-8 h-8 rounded-full object-cover bg-gray-700"
                    @error="handleAvatarError"
                  />
                </button>

              <!-- Dropdown Menu -->
              <Transition name="drop">
              <div
                v-if="userDropdownOpen"
                class="absolute right-0 mt-2 w-48 bg-zombie-dark/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 z-50 origin-top-right"
              >
                <div class="p-3 border-b border-white/10">
                  <div class="font-medium text-white">{{ userProfile?.display_name || userProfile?.name || 'Anonymous' }}</div>
                  <div class="text-sm text-gray-400 flex items-center">
                    <span class="truncate">{{ formatNpub(userProfile?.pubkey) }}</span>
                    <CopyButton :pubkey="userProfile?.pubkey" />
                  </div>
                  <div class="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                    {{ signerLabel }}
                  </div>
                </div>
                <div class="p-1">
                  <button
                    @click="logout"
                    class="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 font-semibold text-red-300 bg-red-500/10 border border-red-500/20 select-none transition-colors duration-150 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-200 active:scale-[0.98]"
                  >
                    <span>🚪</span>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
              </Transition>
              </div>

              <!-- Mobile/Tablet Hamburger Button -->
              <button
                v-if="isConnected"
                @click="mobileMenuOpen = !mobileMenuOpen"
                class="xl:hidden flex flex-col justify-center items-center w-8 h-8 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors ml-2"
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
        <Transition name="collapse">
        <nav
          v-if="isConnected && mobileMenuOpen"
          class="xl:hidden mt-4 pt-4 border-t border-gray-700 max-h-[calc(100vh-6rem)] overflow-y-auto"
        >
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
                <div class="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                  {{ signerLabel }}
                </div>
              </div>
            </div>
            <button
              @click="logout"
              class="w-full px-3 py-2.5 rounded-lg flex items-center gap-2.5 font-semibold text-red-300 bg-red-500/10 border border-red-500/20 select-none text-left transition-colors duration-150 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-200 active:scale-[0.98]"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>

          <ul class="space-y-2">
            <li>
              <a
                href="#"
                @click.prevent="setActiveView('dashboard'); mobileMenuOpen = false"
                :class="{'text-zombie-green bg-zombie-green/10 shadow-[0_0_18px_rgba(92,219,92,0.15)]': activeView === 'dashboard' && !isScoutMode}"
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Dashboard
              </a>
            </li>
            <li>
              <a
                href="#"
                @click.prevent="setActiveView('hunting'); mobileMenuOpen = false"
                :class="{'text-zombie-green bg-zombie-green/10 shadow-[0_0_18px_rgba(92,219,92,0.15)]': activeView === 'hunting'}"
                class="block px-4 py-4 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors font-bold text-lg border-2 border-zombie-green/30"
              >
                🧟 Hunt Zombies
              </a>
            </li>
            <li>
              <a
                href="#"
                @click.prevent="setActiveView('follows'); mobileMenuOpen = false"
                :class="{'text-zombie-green bg-zombie-green/10 shadow-[0_0_18px_rgba(92,219,92,0.15)]': activeView === 'follows'}"
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Follows
              </a>
            </li>
            <li>
              <a
                href="#"
                @click.prevent="setActiveView('backups'); mobileMenuOpen = false"
                :class="{'text-zombie-green bg-zombie-green/10 shadow-[0_0_18px_rgba(92,219,92,0.15)]': activeView === 'backups'}"
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Backups
              </a>
            </li>
            <li>
              <a
                href="#"
                @click.prevent="setActiveView('settings'); mobileMenuOpen = false"
                :class="{'text-zombie-green bg-zombie-green/10 shadow-[0_0_18px_rgba(92,219,92,0.15)]': activeView === 'settings'}"
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Settings
              </a>
            </li>

            <li class="pt-2 mt-2 border-t border-gray-700/50">
              <span class="block px-4 pt-1 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                More
              </span>
            </li>
            <li>
              <a
                href="#"
                @click.prevent="setActiveView('zombieCheck'); mobileMenuOpen = false"
                :class="{'text-zombie-green bg-zombie-green/10 shadow-[0_0_18px_rgba(92,219,92,0.15)]': activeView === 'zombieCheck' && !isScoutMode}"
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Zombie Check
              </a>
            </li>
            <li>
              <a
                href="#"
                @click.prevent="showScoutModeMenu(); mobileMenuOpen = false"
                :class="{'text-zombie-green bg-zombie-green/10 shadow-[0_0_18px_rgba(92,219,92,0.15)]': isScoutMode}"
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Scout Mode
              </a>
            </li>
            <li>
              <a
                href="#"
                @click.prevent="setActiveView('resurrector'); mobileMenuOpen = false"
                :class="{'text-zombie-green bg-zombie-green/10 shadow-[0_0_18px_rgba(92,219,92,0.15)]': activeView === 'resurrector' && !isScoutMode}"
                class="block px-4 py-3 rounded-lg hover:bg-gray-800 hover:text-zombie-green transition-colors"
              >
                Resurrector
              </a>
            </li>
          </ul>
        </nav>
        </Transition>

        <!-- Mobile/Tablet Navigation Menu for signed-out Scout Mode -->
        <Transition name="collapse">
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
        </Transition>
      </div>
    </header>

    <main
      class="container mx-auto px-4 py-8 flex-grow"
      :style="{ marginTop: headerHeight + 'px' }"
    >
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
        <!-- Login Card -->
        <div class="card max-w-2xl mx-auto mt-2 mb-12 animate-fade-up">
          <div class="text-center mb-8">
            <div class="relative inline-block mb-2 animate-float">
              <div class="absolute inset-0 -m-10 rounded-full bg-zombie-green/15 blur-3xl" aria-hidden="true"></div>
              <div class="relative text-7xl drop-shadow-[0_0_24px_rgba(92,219,92,0.5)]">🧟‍♂️</div>
            </div>
            <p class="text-xs font-semibold uppercase tracking-widest text-zombie-green mb-2">Nostr Follow List Manager</p>
            <h2 class="text-3xl sm:text-4xl mb-4 text-gradient">Connect to start hunting zombies!</h2>
            <p class="text-gray-300">Connect with a browser extension or remote signer to manage your dormant follows.</p>
            <p class="text-sm text-gray-400 mt-2">A desktop browser is recommended for best results.</p>
          </div>

          <div class="space-y-3 mb-6">
            <!-- Browser Extension: one click connects -->
            <button
              @click="handleExtensionConnect"
              :disabled="isConnecting"
              class="w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 bg-black/20 hover:-translate-y-px disabled:opacity-60"
              :class="hasNip07
                ? 'border-pleb-purple/50 hover:border-pleb-purple hover:shadow-[0_0_24px_rgba(192,132,252,0.25)]'
                : 'border-white/10 hover:border-white/25'"
            >
              <div class="w-11 h-11 rounded-xl grid place-items-center text-2xl flex-shrink-0"
                   :class="hasNip07 ? 'bg-pleb-purple/20' : 'bg-white/5 grayscale opacity-60'">
                <span v-if="isConnecting && connectingMethod === 'nip07'" class="spinner-md border-pleb-purple"></span>
                <span v-else>⚡</span>
              </div>
              <div class="flex-grow min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-lg font-semibold text-gray-100">
                    {{ isConnecting && connectingMethod === 'nip07' ? 'Connecting…' : 'Browser Extension' }}
                  </span>
                  <span v-if="hasNip07 && !(isConnecting && connectingMethod === 'nip07')"
                        class="inline-flex items-center gap-1 text-[11px] font-medium text-green-300 bg-green-900/40 border border-green-500/30 px-2 py-0.5 rounded-full">
                    <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                    detected
                  </span>
                </div>
                <p class="text-sm text-gray-400 mt-0.5">
                  <template v-if="isConnecting && connectingMethod === 'nip07'">Approve the request in your extension…</template>
                  <template v-else-if="hasNip07">One click — Sidecar, Alby or any NIP-07 extension</template>
                  <template v-else>Click for install options — Sidecar, Alby or any NIP-07 extension</template>
                </p>
              </div>
            </button>

            <!-- Install hints when no extension is present -->
            <div v-if="showInstallHints" class="p-4 rounded-xl border border-pleb-blue/40 bg-pleb-blue/5 text-sm animate-fade-up">
              <p class="font-semibold text-pleb-blue mb-1.5">Need a Nostr extension?</p>
              <p class="text-gray-300">
                Install
                <a href="https://sidecar.top/" target="_blank" rel="noopener noreferrer" class="text-pleb-blue underline hover:no-underline">Sidecar</a>,
                <a href="https://getalby.com/" target="_blank" rel="noopener noreferrer" class="text-pleb-blue underline hover:no-underline">Alby</a>
                or
                <a href="https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp" target="_blank" rel="noopener noreferrer" class="text-pleb-blue underline hover:no-underline">nos2x</a>,
                then refresh this page.
              </p>
            </div>

            <!-- Remote Signer: opens the bunker / QR flow -->
            <button
              @click="openNip46Setup"
              :disabled="isConnecting"
              class="w-full flex items-center gap-4 p-4 rounded-xl border border-pleb-blue/40 text-left transition-all duration-200 bg-black/20 hover:border-pleb-blue hover:shadow-[0_0_24px_rgba(30,144,255,0.25)] hover:-translate-y-px"
            >
              <div class="w-11 h-11 rounded-xl grid place-items-center text-2xl flex-shrink-0 bg-pleb-blue/15">
                <span v-if="isConnecting && connectingMethod === 'nip46'" class="spinner-md border-pleb-blue"></span>
                <span v-else>🔑</span>
              </div>
              <div class="flex-grow min-w-0">
                <span class="text-lg font-semibold text-gray-100">Remote Signer</span>
                <p class="text-sm text-gray-400 mt-0.5">Scan a QR or paste a bunker URL — Amber, Clave &amp; co.</p>
              </div>
            </button>

            <!-- Inline error (replaces alert) -->
            <div v-if="loginError" class="p-3 rounded-xl border border-red-500/50 bg-red-950/40 text-sm text-red-200 animate-fade-up">
              {{ loginError }}
            </div>
          </div>

          <!-- nsec login -->
          <div class="pt-2 text-center">
            <button
              @click="showNsecLogin = !showNsecLogin"
              class="text-xs text-gray-500 hover:text-gray-400 transition-colors mb-3"
            >
              {{ showNsecLogin ? 'Hide private key sign-in' : 'Or sign in with your private key' }}
            </button>
            <Transition name="collapse">
            <div v-if="showNsecLogin">
              <div class="flex items-center gap-2 mb-3">
                <span class="text-yellow-400">⚠️</span>
                <p class="text-sm text-yellow-300/80">Your key is only used locally to sign events and is never stored or sent anywhere.</p>
              </div>
              <div class="flex gap-2">
                <input
                  v-model="nsecInput"
                  type="password"
                  placeholder="nsec1..."
                  class="input flex-1 font-mono text-sm"
                  :disabled="isConnecting"
                  @keyup.enter="connectWithNsec"
                />
                <button
                  @click="connectWithNsec"
                  :disabled="isConnecting || !nsecInput.trim()"
                  class="btn-secondary px-5 whitespace-nowrap"
                >
                  <span v-if="isConnecting">Signing in...</span>
                  <span v-else>Sign in</span>
                </button>
              </div>
            </div>
            </Transition>
          </div>


          <!-- Zombie Check Section -->
          <div class="mt-10 pt-6 border-t border-gray-700/50">
            <ZombieCheck />
          </div>

          <!-- Scout Mode Section -->
          <div class="mt-10 pt-6 border-t border-gray-700/50">
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
                  placeholder="Search by username or paste npub/nprofile/hex..."
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

          <!-- The Resurrector Section -->
          <div class="mt-10 pt-6 border-t border-gray-700/50">
            <div class="text-center mb-6">
              <div class="text-4xl mb-3 flex items-center justify-center gap-2">
                <span style="display: inline-block; transform: scaleX(-1);">⚡</span>
                <span>🧟‍♂️</span>
                <span>⚡</span>
              </div>
              <h3 class="text-xl mb-2 text-zombie-green">The Resurrector</h3>
              <p class="text-gray-300 text-sm">
                Bring your deleted Nostr profile back to life
              </p>
            </div>

            <a
              href="/resurrector"
              target="_blank"
              class="btn-primary w-full flex items-center justify-center gap-2"
            >
              <span>⚡</span>
              <span>Open Resurrector</span>
            </a>

            <div class="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
              <div class="flex items-start gap-2">
                <span class="text-zombie-green text-sm">💡</span>
                <div class="text-xs text-gray-300">
                  <strong class="text-zombie-green">What it does:</strong><br>
                  • Scans for deleted profile events<br>
                  • Removes the "deleted" flag from your profile<br>
                  • Publishes a clean profile to relays<br>
                  • Works with nsec/hex keys (no extension needed)<br>
                  • Your keys never leave your browser
                </div>
              </div>
            </div>
          </div>

          <div class="mt-10 pt-6 border-t border-gray-700/50 text-center">
            <div class="text-xs text-gray-400 space-y-1.5">
              <div class="text-white font-medium">From the creator of</div>
              <div class="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <a
                href="https://mutable.top"
                target="_blank"
                rel="noreferrer"
                class="inline-flex items-center gap-2 hover:text-gray-200 transition-colors"
              >
                <img
                  src="https://www.mutable.top/mutable_logo.svg"
                  alt=""
                  class="h-8 w-auto"
                  loading="lazy"
                />
                <img
                  src="https://www.mutable.top/mutable_text.svg"
                  alt="Mutable"
                  class="h-4 w-auto"
                  loading="lazy"
                />
              </a>
              <span class="text-white font-medium">and</span>
              <a
                href="https://sidecar.top"
                target="_blank"
                rel="noreferrer"
                class="inline-flex items-center hover:opacity-80 transition-opacity"
              >
                <!--
                  Self-hosted so the footer doesn't depend on sidecar.top.
                  h-7 sizes the script to match the "mutable" wordmark beside
                  it. The lockup's script sits in the lower third of its
                  viewBox (the glass fills the full height), so plain
                  box-centering reads low — the small upward nudge lines the
                  word up with the surrounding text.
                -->
                <img
                  src="/sidecar_logo_white.svg"
                  alt="Sidecar"
                  class="h-7 w-auto -translate-y-[3px]"
                  loading="lazy"
                />
              </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main App Views -->
      <div v-else>
        <router-view @logout="logout" v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="$route.path" ref="currentViewComponent" />
          </Transition>
        </router-view>
      </div>
    </main>

    <!-- NIP-46 Setup Modal -->
    <Transition name="modal">
    <div
      v-if="showNip46Setup"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click="closeNip46Setup"
    >
      <div class="modal-panel bg-zombie-dark border border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" @click.stop>
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
    </Transition>

    <footer class="mt-auto py-6 bg-black/30 backdrop-blur-xl border-t border-white/10">
      <div class="container mx-auto px-4">
        <div class="flex flex-col lg:flex-row items-center justify-between gap-4">
          <p class="text-gray-400 text-sm text-center lg:text-left">
            <span class="block sm:inline">Plebs vs. Zombies v{{ appVersion }} &copy; {{ new Date().getFullYear() }}</span>
            <span class="hidden sm:inline"> | </span>
            <span class="block sm:inline">Made with 🧠 for the Nostr community</span>
          </p>
          <div class="flex flex-nowrap gap-1 sm:gap-1.5 overflow-x-auto max-w-full">
            <a
              href="https://jumble.social/users/npub1pvz2c9z4pau26xdwfya24d0qhn6ne8zp9vwjuyxw629wkj9vh5lsrrsd4h"
              target="_blank"
              class="text-xs px-2 sm:px-2.5 py-1 bg-black/40 hover:bg-black/60 text-pleb-purple border border-pleb-purple/30 rounded-full transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              Nostr 🤙
            </a>
            <button
              @click="showZapModal"
              class="text-xs px-2 sm:px-2.5 py-1 bg-black/40 hover:bg-black/60 text-pleb-gold border border-pleb-gold/30 rounded-full transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              ⚡ Zap
            </button>
            <a
              href="https://github.com/dmnyc/plebs-vs-zombies"
              target="_blank"
              class="text-xs px-2 sm:px-2.5 py-1 bg-black/40 hover:bg-black/60 text-gray-300 border border-white/15 rounded-full transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              GitHub 🤓
            </a>
          </div>
        </div>
      </div>
    </footer>

    <!-- Zap Modal -->
    <Transition name="modal">
    <div
      v-if="zapModal.show"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="closeZapModal"
    >
      <div class="modal-panel bg-zombie-dark border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4" @click.stop>
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
                @click="copyLightningAddress($event)"
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
    </Transition>
  </div>

  <!-- Client Authorization Modal -->
  <ClientAuthorizationModal
    :show="authorizationModal.show"
    :appInfo="authorizationModal.appInfo"
    @allow="handleAuthorizationAllow"
    @deny="handleAuthorizationDeny"
  />

  <!-- Scout Mode Modal for Signed-in Users -->
  <Transition name="modal">
  <div
    v-if="showScoutModal"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="closeScoutModal"
  >
    <div class="modal-panel bg-zombie-dark border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4" @click.stop>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-yellow-400">👁️🔍 Start Scout Mode</h3>
        <button
          @click="closeScoutModal"
          class="text-gray-400 hover:text-gray-200 text-2xl leading-none"
        >
          ×
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Search for a user to scout:
          </label>
          <ProfileSearchInput
            ref="modalScoutInput"
            placeholder="Search by username or paste npub/nprofile/hex..."
            :auto-focus="true"
            @profile-selected="handleModalScoutProfileSelected"
            @input-changed="handleScoutInputChanged"
          />
        </div>

        <div class="space-y-2">
          <button
            @click="startScoutFromModal"
            :disabled="!scoutInputValue"
            class="btn-scout w-full"
            :class="{'opacity-50 cursor-not-allowed': !scoutInputValue}"
          >
            Start Scouting
          </button>
          <button
            v-if="isConnected"
            @click="scoutMyself"
            class="btn-tertiary btn-sm w-full"
          >
            Scout Myself
          </button>
        </div>
        <div v-if="scoutInputError" class="text-red-400 text-xs mt-2">
          {{ scoutInputError }}
        </div>
      </div>
    </div>
  </div>
  </Transition>
  <Analytics />

  <!-- Easter egg: falling zombies overlay -->
  <ZombieRain ref="zombieRain" />

  <!-- Easter egg toast -->
  <Transition name="drop">
    <div
      v-if="eggToast.show"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-gray-800/95 backdrop-blur border border-zombie-green/50 text-gray-100 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold animate-fade-up"
    >
      {{ eggToast.message }}
    </div>
  </Transition>
</template>

<script>
import { markRaw } from 'vue';
import DashboardView from './views/DashboardView.vue';
import ZombieHuntingView from './views/ZombieHuntingView.vue';
import BackupsView from './views/BackupsView.vue';
import SettingsView from './views/SettingsView.vue';
import FollowsManagerView from './views/FollowsManagerView.vue';
import ScoutModeView from './views/ScoutModeView.vue';
import ZombieCheckView from './views/ZombieCheckView.vue';
import ResurrectorView from './views/ResurrectorView.vue';
import CopyButton from './components/CopyButton.vue';
import Nip46Connection from './components/Nip46Connection.vue';
import ClientAuthorizationModal from './components/ClientAuthorizationModal.vue';
import ProfileSearchInput from './components/ProfileSearchInput.vue';
import ZombieCheck from './components/ZombieCheck.vue';
import ZombieRain from './components/ZombieRain.vue';
import nostrService from './services/nostrService';
import backupService from './services/backupService';
import immunityService from './services/immunityService';
import scoutService from './services/scoutService';
import { nip19, finalizeEvent, getPublicKey } from 'nostr-tools';
import { Analytics } from '@vercel/analytics/vue';
import { baseVersion } from './utils/version';

export default {
  name: 'App',
  components: {
    DashboardView,
    ZombieHuntingView,
    BackupsView,
    SettingsView,
    FollowsManagerView,
    ScoutModeView,
    ResurrectorView,
    CopyButton,
    Analytics,
    Nip46Connection,
    ClientAuthorizationModal,
    ProfileSearchInput,
    ZombieCheck,
    ZombieRain
  },
  data() {
    return {
      isConnected: false,
      activeView: 'dashboard',
      mobileMenuOpen: false,
      userDropdownOpen: false,
      moreDropdownOpen: false,
      userProfile: null,
      loginSigningMethod: 'nip07', // Default to NIP-07 for login
      hasNip07: false, // NIP-07 extension detected in this browser
      showInstallHints: false,
      loginError: '',
      connectingMethod: null, // Which card is spinning: 'nip07' | 'nip46' | 'nsec'
      forceUpdateKey: 0,
      showNip46Setup: false, // Show NIP-46 setup modal
      showNsecLogin: false,
      nsecInput: '',
      appVersion: baseVersion,
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
        resurrector: markRaw(ResurrectorView),
        scout: markRaw(ScoutModeView),
        zombieCheck: markRaw(ZombieCheckView)
      },
      // Scout Mode state
      isScoutMode: false,
      scoutModeLoading: false,
      scoutTarget: null,
      showScoutModal: false,
      selectedScoutProfile: null, // Stores selected profile from ProfileSearchInput
      scoutInputValue: '', // Tracks input value for button enable/disable
      scoutInputError: '', // Error message for validation
      // Easter eggs
      zombieMode: false, // Konami code toggles screen-wide zombie apocalypse mode
      eggToast: {
        show: false,
        message: '',
        timer: null
      },
      logoClicks: 0,
      logoClickTimer: null,
      konamiProgress: 0,
      scrolled: false,
      // Separate from `scrolled` (which has a wide hysteresis band to avoid
      // a layout-driven scroll-position feedback loop — see onScroll below).
      // Opacity doesn't shift layout height, so it doesn't need that
      // protection, and riding on the same 48px threshold as `scrolled`
      // left the sticky header pinned-but-transparent for the first 48px
      // of every scroll, letting page content show through underneath it.
      headerSolid: false,
      // Header is fixed (so overscroll bounce doesn't drag it with the
      // page); main's margin tracks its real rendered height via
      // ResizeObserver instead of a guessed constant, since the header's
      // height changes as it compacts on scroll. The footer stays in
      // normal flow: fixed positioning made it permanently eat screen
      // space on mobile (worse than the overscroll bounce it prevented),
      // and unlike the header it doesn't need bounce-prevention badly
      // enough to justify that cost.
      headerHeight: 90
    }
  },
  computed: {
    currentView() {
      return this.views[this.activeView];
    },
    // Header compacts once the page is scrolled (landing and in-app alike)
    headerPad() {
      if (!this.isLoginScreen) return this.scrolled ? 'py-2' : 'py-4';
      return this.scrolled ? 'pt-3 pb-3' : 'pt-8 pb-7';
    },
    logoSize() {
      return this.scrolled ? 'w-9 h-9' : 'w-12 h-12';
    },
    headerGlass() {
      if (!this.isLoginScreen) {
        return 'bg-black/85 border-b border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)]';
      }
      // Landing: transparent at the top, glass as soon as you scroll at all
      // (headerSolid, not scrolled — see its comment in data()). Mostly-
      // opaque fill (not just backdrop-blur) so the header still reliably
      // hides page content if a browser's compositor doesn't keep the blur
      // in sync with fast/momentum scrolling (seen on iOS Safari).
      return this.headerSolid
        ? 'bg-black/85 border-b border-white/10'
        : 'bg-transparent border-b border-transparent';
    },
    brandSize() {
      if (this.isLoginScreen) return this.scrolled ? 'text-2xl' : 'text-3xl sm:text-5xl';
      return this.scrolled ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl';
    },
    signerLabel() {
      const method = nostrService.signingMethod;
      if (method === 'nip07') return 'Browser Extension';
      if (method === 'nip46') return 'Remote Signer';
      if (method === 'nsec') return 'Private Key';
      return '';
    },
    // The actual sign-in landing page. Scout Mode is also unauthenticated
    // but renders its own nav (Start Over, etc.) in the header, so it must
    // keep the original styled header — only the real sign-in screen gets
    // the stripped-down treatment.
    isLoginScreen() {
      return !this.isConnected && !this.isScoutMode;
    },
    // True when the active view lives inside the "More" dropdown, so the
    // dropdown trigger can show the active-highlight state.
    isMoreActive() {
      return (
        this.isScoutMode ||
        this.activeView === 'zombieCheck' ||
        this.activeView === 'resurrector'
      );
    }
  },
  watch: {
    // Sync activeView with route changes
    '$route'(to) {
      const routeToView = {
        'Dashboard': 'dashboard',
        'Hunt Zombies': 'hunting',
        'Follows': 'follows',
        'Backups': 'backups',
        'Resurrector': 'resurrector',
        'Settings': 'settings',
        'Scout': 'scout',
        'Zombie Check': 'zombieCheck'
      };

      const viewName = routeToView[to.name];
      if (viewName) {
        this.activeView = viewName;
      }
    },
    zombieMode(on) {
      document.title = on
        ? '🧟 BRAINZ! | Plebs vs. Zombies'
        : 'Plebs vs. Zombies';
    },
    // :key="forceUpdateKey" on <header> destroys and recreates the header
    // DOM node on login/profile-load, so $refs.headerEl points at a
    // detached element afterward — re-observe the new one or headerHeight
    // freezes stale and main's margin stops tracking the real header.
    forceUpdateKey() {
      this.$nextTick(() => this.observeHeaderEl());
    }
  },
  methods: {
    observeHeaderEl() {
      if (!this.headerResizeObserver) return;
      this.headerResizeObserver.disconnect();
      if (this.$refs.headerEl) {
        // Measure synchronously now rather than waiting for the observer's
        // first (async) callback — otherwise main briefly uses the
        // guessed default (headerHeight's initial data() value) and then
        // visibly snaps to the real height a frame or two later.
        this.headerHeight = this.$refs.headerEl.getBoundingClientRect().height;
        this.headerResizeObserver.observe(this.$refs.headerEl);
      }
    },
    setActiveView(view) {
      // Map view names to route names
      const viewToRoute = {
        'dashboard': '/',
        'hunting': '/hunt',
        'follows': '/follows',
        'backups': '/backups',
        'resurrector': '/resurrector',
        'settings': '/settings',
        'scout': '/scout',
        'zombieCheck': '/zombiecheck'
      };

      const routePath = viewToRoute[view];
      if (routePath) {
        this.$router.push(routePath);
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
    async scoutMyself() {
      const pubkey = nostrService.pubkey || this.userProfile?.pubkey;
      if (!pubkey) return;

      this.selectedScoutProfile = {
        npub: nip19.npubEncode(pubkey),
        pubkey,
        name: this.userProfile?.name,
        display_name: this.userProfile?.display_name,
        picture: this.userProfile?.picture
      };
      this.showScoutModal = false;
      this.scoutInputError = '';

      // Mirror startScoutFromModal: force a remount when already in Scout Mode
      if (this.isScoutMode) {
        await scoutService.forceShutdown();
        await scoutService.reset();
        this.isScoutMode = false;
        this.scoutTarget = null;
        await this.$nextTick();
        await this.startScoutMode();
      } else {
        await this.startScoutMode();
      }
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
    async connectNostr(method = this.loginSigningMethod) {
      try {
        this.isConnecting = true;
        this.connectingMethod = method;
        this.loginError = '';
        console.log(`🚀 Starting Nostr connection with ${method}...`);

        // Only set the signing method if it's different to avoid resetting NDK
        this.loginSigningMethod = method;
        if (nostrService.getSigningMethod() !== method) {
          nostrService.setSigningMethod(method);
        }

        if (method === 'nip07') {
          // Use NIP-07 connection flow
          const connectionResult = await nostrService.connectExtension();
          console.log('✅ Extension connected successfully:', connectionResult);

          this.isConnected = true;
          this.userProfile = nostrService.userProfile;

          // Initialize other services (NDK is already initialized by connectExtension)
          backupService.init();
          await immunityService.init();

          console.log('🎉 Successfully connected to Nostr with', connectionResult.extensionType);

        } else if (method === 'nip46') {
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
          userMessage = 'Extension connection timed out. Please make sure your signer extension is unlocked and responding, then try again.';
        } else if (error.message.includes('denied') || error.message.includes('rejected')) {
          userMessage = 'Connection was denied. Please approve the connection request in your Nostr extension.';
        } else if (error.message.includes('No Nostr extension found')) {
          userMessage = 'No Nostr extension found. Please install Sidecar, Alby, nos2x, or another NIP-07 compatible extension, then refresh the page.';
        }

        this.loginError = `${userMessage} If issues persist, try disconnecting and reconnecting this site in your extension settings.`;
      } finally {
        this.isConnecting = false;
        this.connectingMethod = null;
      }
    },

    // Landing widget: one-click extension connect; without an extension,
    // surface install options instead of failing silently
    handleExtensionConnect() {
      this.refreshExtensionDetection();
      if (!this.hasNip07) {
        this.showInstallHints = !this.showInstallHints;
        return;
      }
      this.showInstallHints = false;
      this.connectNostr('nip07');
    },

    openNip46Setup() {
      this.loginError = '';
      this.loginSigningMethod = 'nip46';
      this.showNip46Setup = true;
    },

    refreshExtensionDetection() {
      this.hasNip07 = typeof window.nostr !== 'undefined';
    },

    async connectWithNsec() {
      const input = this.nsecInput.trim();
      if (!input) return;

      this.isConnecting = true;
      try {
        // Decode nsec
        const decoded = nip19.decode(input);
        if (decoded.type !== 'nsec') {
          throw new Error('Invalid nsec key. Must start with nsec1...');
        }

        const secretKey = decoded.data;
        const pubkey = getPublicKey(secretKey);

        // Set up nostrService with nsec signing
        nostrService.setSigningMethod('nsec');
        nostrService.pubkey = pubkey;
        nostrService.secretKey = secretKey;

        // Provide a signEvent function that signs locally
        nostrService.nsecSignEvent = (event) => {
          return finalizeEvent(event, secretKey);
        };

        // Initialize NDK for relay connections
        await nostrService.initialize();

        this.isConnected = true;
        this.userProfile = {
          pubkey,
          display_name: pubkey.substring(0, 8) + '...',
          name: 'Nostr User',
          picture: '/default-avatar.svg'
        };

        // Clear nsec from UI after setup
        this.nsecInput = '';

        backupService.init();
        await immunityService.init();

        // Load profile
        setTimeout(() => {
          nostrService.loadUserProfile().then(() => {
            if (nostrService.userProfile) {
              this.userProfile = {
                ...nostrService.userProfile,
                picture: nostrService.userProfile.picture || '/default-avatar.svg'
              };
            }
          }).catch(() => {});
        }, 100);

        console.log('[App] Connected with nsec, pubkey:', pubkey.substring(0, 8) + '...');
      } catch (error) {
        console.error('nsec login failed:', error);
        this.loginError = `Failed to sign in: ${error.message}`;
      } finally {
        this.isConnecting = false;
      }
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

    // Classes for the header nav pills; active gets a glowing gradient chip
    navPill(active) {
      return active
        ? 'text-zombie-dark bg-gradient-to-r from-zombie-green to-lime-400 shadow-[0_0_18px_rgba(92,219,92,0.45)] font-semibold'
        : 'text-gray-300 hover:text-white hover:bg-white/5';
    },

    // ------------------------------------------------------------------
    // Easter eggs
    // ------------------------------------------------------------------

    // Logo: normal click navigates to the dashboard; five rapid clicks
    // wake up the horde.
    handleLogoClick() {
      if (!this.isScoutMode) {
        this.setActiveView('dashboard');
      }

      this.logoClicks += 1;
      clearTimeout(this.logoClickTimer);
      this.logoClickTimer = setTimeout(() => {
        this.logoClicks = 0;
      }, 1500);

      if (this.logoClicks >= 5) {
        this.logoClicks = 0;
        clearTimeout(this.logoClickTimer);
        this.wakeTheHorde();
      }
    },

    wakeTheHorde() {
      this.$refs.zombieRain?.start(36);
      this.showEggToast('🧟 The horde heard that. They\'re coming.');
    },

    toggleZombieMode() {
      this.zombieMode = !this.zombieMode;
      if (this.zombieMode) {
        this.$refs.zombieRain?.start(50);
        this.showEggToast('☢️ ZOMBIE MODE ACTIVATED — the horde has your scent. (Konami again to cure)', 5000);
      } else {
        this.showEggToast('💉 Vaccine administered. You\'re human again.');
      }
    },

    handleKonamiKey(event) {
      const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
      const expected = konami[this.konamiProgress];
      const pressed = event.key.length === 1 ? event.key.toLowerCase() : event.key;

      if (pressed === expected) {
        this.konamiProgress += 1;
        if (this.konamiProgress === konami.length) {
          this.konamiProgress = 0;
          this.toggleZombieMode();
        }
      } else {
        // Allow a fresh sequence to start with this key if it matches the beginning
        this.konamiProgress = pressed === konami[0] ? 1 : 0;
      }
    },

    showEggToast(message, duration = 3500) {
      clearTimeout(this.eggToast.timer);
      this.eggToast.message = message;
      this.eggToast.show = true;
      this.eggToast.timer = setTimeout(() => {
        this.eggToast.show = false;
      }, duration);
    },

    logEasterEgg() {
      const style = 'color:#5cdb5c;font-size:14px;font-weight:bold;text-shadow:0 0 8px rgba(92,219,92,.6)';
      const styleDim = 'color:#9ca3af;font-size:12px';
      console.log('%c🧟 Plebs vs. Zombies', style);
      console.log('%cYou look like someone who reads console logs. Respect.', styleDim);
      console.log('%cPsst... try the Konami Code on this page. ⬆️⬆️⬇️⬇️⬅️➡️⬅️➡️🅱️🅰️', styleDim);
      console.log('%cAnd keep an eye on the logo... it doesn\'t like being poked.', styleDim);
    },

    onNip46Connected(result) {
      console.log('✅ NIP-46 connected from setup modal:', result);

      // Handle both direct result object and CustomEvent
      const data = result?.detail || result;

      if (!data || !data.pubkey) {
        console.error('❌ Invalid connection data:', result);
        // Close the modal — leaving it open on a "Connected" screen with no
        // way forward is how users get stuck; the error shows on the login card
        this.loginError = 'The signer connected but did not return your public key. Please try connecting again.';
        this.showNip46Setup = false;
        return;
      }

      // Close the setup modal FIRST — if anything below throws, a stuck open
      // modal over the dashboard is worse than a rough landing
      this.showNip46Setup = false;

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

      // Navigate to dashboard immediately
      console.log('🔄 Navigating to dashboard');
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

    copyLightningAddress(event) {
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

    // Compacts the landing header once scrolled. Hysteresis on purpose:
    // compacting shrinks the fixed header's rendered height, which would
    // otherwise nudge scrollY back — a single threshold makes the logo
    // oscillate (the "epileptic fit"), a dead zone cannot.
    this.onScroll = () => {
      const y = window.scrollY;
      if (!this.scrolled && y > 48) this.scrolled = true;
      else if (this.scrolled && y < 8) this.scrolled = false;
      // No hysteresis needed here — see the headerSolid comment in data().
      this.headerSolid = y > 2;
    };
    this.onScroll();
    window.addEventListener('scroll', this.onScroll, { passive: true });

    // Header is fixed and out of normal flow (so overscroll bounce doesn't
    // drag it with the page); track its real rendered height so main's
    // margin can keep content clear of it in every state (compact/
    // expanded, login/in-app, mobile menu open, responsive breakpoints...).
    if (window.ResizeObserver) {
      // Read via getBoundingClientRect(), not entries[0].contentRect —
      // contentRect excludes padding/border.
      this.headerResizeObserver = new ResizeObserver(() => {
        if (this.$refs.headerEl) this.headerHeight = this.$refs.headerEl.getBoundingClientRect().height;
      });
      this.observeHeaderEl();
    }

    // Detect NIP-07 extension; re-check when the tab regains focus
    // (covers "installed the extension, came back" without a reload)
    this.refreshExtensionDetection();
    this.onWindowFocus = () => this.refreshExtensionDetection();
    window.addEventListener('focus', this.onWindowFocus);

    // Easter eggs: Konami code + console message
    window.addEventListener('keydown', this.handleKonamiKey);
    this.logEasterEgg();

    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
      if (this.mobileMenuOpen && !e.target.closest('header')) {
        this.mobileMenuOpen = false;
      }
      if (this.userDropdownOpen && !e.target.closest('.relative')) {
        this.userDropdownOpen = false;
      }
      if (this.moreDropdownOpen && !e.target.closest('.more-dropdown')) {
        this.moreDropdownOpen = false;
      }
    });

    // Sync activeView with initial route
    const routeToView = {
      'Dashboard': 'dashboard',
      'Hunt Zombies': 'hunting',
      'Follows': 'follows',
      'Backups': 'backups',
      'Resurrector': 'resurrector',
      'Settings': 'settings',
      'Scout': 'scout'
    };
    const viewName = routeToView[this.$route.name];
    if (viewName) {
      this.activeView = viewName;
    }
  },

  beforeUnmount() {
    window.removeEventListener('nip46-connected', this.onNip46Connected);
    window.removeEventListener('user-profile-loaded', this.onUserProfileLoaded);
    window.removeEventListener('keydown', this.handleKonamiKey);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('focus', this.onWindowFocus);
    if (this.headerResizeObserver) this.headerResizeObserver.disconnect();
    clearTimeout(this.eggToast.timer);
    clearTimeout(this.logoClickTimer);
  }
}
</script>
