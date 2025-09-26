<template>
  <div>
    <!-- Scout Mode Header -->
    <div class="card mb-6 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-600/30">
      <!-- Header row with title and buttons -->
      <div class="flex items-start justify-between gap-4 mb-3">
        <div class="flex items-center gap-4">
          <div class="text-3xl flex-shrink-0">🔍</div>
          <h2 class="text-2xl text-yellow-400">Scout Mode</h2>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <button 
            @click="showScoutNewUser" 
            class="btn-secondary text-sm whitespace-nowrap"
            :class="{'opacity-50 cursor-not-allowed': scanning}"
            :disabled="scanning"
          >
            Scout Different User
          </button>
        </div>
      </div>
      
      <!-- User info section -->
      <div class="flex items-center gap-3">
        <!-- Target User Avatar -->
        <div class="flex-shrink-0">
          <img 
            v-if="scoutTarget.picture" 
            :src="scoutTarget.picture" 
            :alt="targetUsername"
            class="w-8 h-8 rounded-full object-cover"
            @error="$event.target.style.display='none'"
          >
          <div 
            v-else 
            class="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-gray-300 text-xs font-medium"
          >
            {{ (targetUsername || 'U').charAt(0).toUpperCase() }}
          </div>
        </div>
        <!-- Analyzing text with username and link -->
        <div class="flex items-center gap-2 text-gray-400 min-w-0">
          <span class="flex-shrink-0">Analyzing</span>
          <span class="font-bold text-white truncate">{{ targetUsername || targetDisplay }}</span>
          <a 
            :href="getNostrProfileUrl(scoutTarget.pubkey)" 
            target="_blank" 
            class="text-purple-400 hover:text-purple-300 text-sm flex-shrink-0"
          >
            profile ↗
          </a>
        </div>
      </div>
    </div>

    <!-- Scout New User Modal -->
    <div 
      v-if="showNewUserModal" 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
      @click="showNewUserModal = false"
    >
      <div class="bg-zombie-dark border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4" @click.stop>
        <h3 class="text-lg font-medium text-yellow-400 mb-4">🔍 Scout New User</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Enter npub to scout:
            </label>
            <input
              v-model="newScoutNpub"
              type="text"
              placeholder="npub1..."
              class="input w-full text-center"
              :class="{'border-red-500': newScoutError, 'border-green-500': newScoutValid}"
            />
            <div v-if="newScoutError" class="text-red-400 text-xs mt-1">
              {{ newScoutError }}
            </div>
          </div>
          
          <div class="flex gap-2">
            <button 
              @click="showNewUserModal = false" 
              class="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button 
              @click="scoutNewUser" 
              :disabled="!newScoutValid || processingNewUser"
              class="btn-scout flex-1"
              :class="{'opacity-50 cursor-not-allowed': !newScoutValid || processingNewUser}"
            >
              <span v-if="processingNewUser">⏳ Processing...</span>
              <span v-else>Start Scouting</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Scanning Progress -->
    <div v-if="scanning" class="card mb-6 p-6">
      <div class="flex flex-col">
        <h3 class="text-xl mb-4 text-center text-yellow-400">🔍 Scouting {{ targetDisplay }}...</h3>
        
        <!-- Progress Bar -->
        <div class="mb-6">
          <div class="flex justify-between items-center text-sm text-gray-400 mb-2 gap-2">
            <span class="truncate flex-1 min-w-0">{{ scanProgress.stage || 'Initializing scout...' }}</span>
            <span class="flex-shrink-0 font-mono whitespace-nowrap">{{ scanProgress.processed || 0 }} / {{ scanProgress.total || 0 }}</span>
          </div>
          <div class="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div 
              class="bg-yellow-400 h-3 rounded-full transition-all duration-300"
              :style="{ width: scanProgress.total > 0 ? Math.min(100, (scanProgress.processed / scanProgress.total * 100)) + '%' : '0%' }"
            ></div>
          </div>
          
          <!-- Follow count explanation -->
          <div class="text-right mt-2">
            <button 
              @click="showFollowCountModal = true"
              class="text-xs text-gray-400 hover:text-gray-300 underline cursor-pointer"
            >
              Follow count explanation
            </button>
          </div>
        </div>
        
        <!-- Current Processing Info -->
        <div class="flex flex-col justify-center space-y-4 mb-6">
          <div class="text-sm text-gray-300 break-all text-center h-10 flex items-center justify-center">
            <span v-if="scanProgress.currentNpub">
              <span class="text-gray-400">Processing: </span>
              <span class="font-mono text-xs sm:text-sm">{{ formatPubkeyForProgress(scanProgress.currentNpub) }}</span>
            </span>
            <span v-else>&nbsp;</span>
          </div>
          
          <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
          </div>
        </div>
        
        <div class="text-center">
          <button 
            @click="stopScan" 
            class="btn-danger px-6 py-2"
          >
            Stop Scout
          </button>
        </div>
      </div>
    </div>

    <!-- Post Success Modal -->
    <div 
      v-if="showPostModal" 
      class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" 
      @click.self="showPostModal = false"
    >
      <div class="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-w-md w-full mx-4">
        <!-- Header -->
        <div class="p-6 border-b border-gray-700">
          <div class="flex items-center justify-between">
            <h2 class="text-2xl font-bold text-purple-400 flex items-center gap-2">
              📡 Scout Report Posted! 
            </h2>
            <button 
              @click="showPostModal = false"
              class="text-gray-400 hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-4">
          <div class="text-center space-y-2">
            <div class="text-4xl">🎯</div>
            <h3 class="text-xl font-bold text-gray-100">
              Successfully shared your Scout report!
            </h3>
            <p class="text-gray-400">
              Your {{ isMyReport ? 'personal' : 'Scout' }} zombie analysis has been posted to Nostr
            </p>
          </div>

          <div class="bg-gray-900 rounded-lg p-4">
            <h4 class="text-lg font-semibold mb-3 text-gray-200">Report Summary:</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between items-center">
                <span class="text-blue-300">Total Follows:</span>
                <span class="font-bold text-lg">{{ scoutResults?.totalFollows || 0 }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-red-300">Zombies Found:</span>
                <span class="font-bold text-lg">{{ scoutResults?.totalZombies || 0 }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-green-300">Zombie Score:</span>
                <span class="font-bold text-lg">{{ scoutResults?.zombieScore || 0 }}%</span>
              </div>
            </div>
          </div>

          <div class="flex justify-center">
            <button 
              @click="showPostModal = false" 
              class="btn-primary px-6"
            >
              Awesome! 🎉
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Follow Count Explanation Modal -->
    <div 
      v-if="showFollowCountModal" 
      class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" 
      @click.self="showFollowCountModal = false"
    >
      <div class="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-w-md w-full mx-4">
        <!-- Header -->
        <div class="p-6 border-b border-gray-700">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-yellow-400 flex items-center gap-2">
              📊 Follow Count Explanation
            </h2>
            <button 
              @click="showFollowCountModal = false"
              class="text-gray-400 hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-4">
          <div class="text-gray-300">
            <p class="mb-4">
              <strong class="text-yellow-400">Why might the follow count be different?</strong>
            </p>
            
            <div class="space-y-3 text-sm">
              <div class="flex items-start gap-2">
                <span class="text-blue-400 text-lg">📡</span>
                <div>
                  <strong class="text-gray-200">Relay Distribution:</strong> Your follow list may be stored across different Nostr relays, and we might not have access to all of them.
                </div>
              </div>
              
              <div class="flex items-start gap-2">
                <span class="text-green-400 text-lg">📅</span>
                <div>
                  <strong class="text-gray-200">Multiple Versions:</strong> You may have updated your follows recently, and older versions exist on some relays.
                </div>
              </div>
              
              <div class="flex items-start gap-2">
                <span class="text-purple-400 text-lg">🔒</span>
                <div>
                  <strong class="text-gray-200">Network Limits:</strong> Some relays may be temporarily unavailable or have connection limits.
                </div>
              </div>
              
              <div class="flex items-start gap-2">
                <span class="text-orange-400 text-lg">🔄</span>
                <div>
                  <strong class="text-gray-200">Batch Processing:</strong> Scout Mode analyzes follows in batches to determine zombie status. When network issues occur, it retries with smaller batches. Some follows may be skipped if they consistently fail analysis across multiple retry attempts.
                </div>
              </div>
            </div>
            
            <div class="mt-4 p-3 bg-gray-900 rounded-lg">
              <p class="text-xs text-gray-400 mb-2">
                <strong class="text-yellow-400">Why counts vary between scans:</strong>
              </p>
              <ul class="text-xs text-gray-400 space-y-1 ml-2">
                <li>• Batch processing may skip some follows due to network failures</li>
                <li>• Relay timeouts can prevent analysis of certain accounts</li>
                <li>• Retry attempts with smaller batches may not recover all data</li>
                <li>• The scan analyzes only the accounts it can successfully reach</li>
              </ul>
            </div>
            
            <div class="mt-3 p-3 bg-gray-900 rounded-lg">
              <p class="text-xs text-gray-400">
                <strong class="text-yellow-400">Note:</strong> Scout Mode shows the most complete follow list we can access from available relays. The zombie analysis is performed on the follows we found.
              </p>
            </div>
          </div>

          <div class="flex justify-center">
            <button 
              @click="showFollowCountModal = false" 
              class="btn-primary px-6"
            >
              Got it! 👍
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Scout Results -->
    <div v-else-if="scoutComplete && scoutResults">
      <!-- Results Summary -->
      <div class="card mb-6">
        <h3 class="text-xl mb-4 text-yellow-400">🎯 Scout Report</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="bg-gray-800 p-4 rounded-lg text-center">
            <div class="text-2xl font-bold text-blue-400">{{ scoutResults.totalFollows }}</div>
            <div class="text-sm text-gray-400">Total Follows</div>
          </div>
          <div class="bg-gray-800 p-4 rounded-lg text-center">
            <div class="text-2xl font-bold text-red-400">{{ scoutResults.totalZombies }}</div>
            <div class="text-sm text-gray-400">Zombie Follows</div>
          </div>
          <div class="bg-gray-800 p-4 rounded-lg text-center">
            <div class="text-2xl font-bold text-green-400">{{ scoutResults.zombieScore }}%</div>
            <div class="text-sm text-gray-400">Zombie Score</div>
          </div>
        </div>

        <!-- Zombie Score Visualization -->
        <div class="mb-6">
          <h4 class="text-lg font-semibold mb-3">Zombie Score Breakdown</h4>
          <div class="flex gap-1 mb-2">
            <span 
              v-for="(square, index) in scoreBarSquares" 
              :key="index" 
              class="text-sm"
              v-html="square"
            >
            </span>
          </div>
          <!-- Labels removed for clarity -->
        </div>

        <!-- Social Share -->
        <div class="bg-gray-800 p-4 rounded-lg">
          <h4 class="text-lg font-semibold mb-3 flex items-center gap-2">
            📢 Share Scout Report
          </h4>
          
          <!-- "This is me!" toggle with prominent callout -->
          <div class="mb-4 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
            <div class="text-yellow-400 text-sm font-medium mb-2">
              Sharing your own Zombie Score? Check this box!
            </div>
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <div class="text-yellow-400 text-lg">👉</div>
              <input
                type="checkbox"
                v-model="isMyReport"
                class="w-4 h-4 text-yellow-600 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500 focus:ring-2"
              >
              <span class="text-sm text-gray-300">This is me!</span>
            </label>
          </div>
          
          <div class="bg-gray-700 p-3 rounded text-sm font-mono mb-3 whitespace-pre-wrap break-long-strings">{{ shareMessage }}</div>
          
          <div class="flex flex-col sm:flex-row gap-2">
            <!-- Post to Nostr button (only for authenticated users) -->
            <button 
              v-if="isLoggedIn"
              @click="postToNostr"
              :disabled="posting || posted"
              :class="posted ? 'btn-success' : 'btn-primary'"
              class="flex-1 flex items-center justify-center gap-2"
            >
              <span v-if="posting">⏳</span>
              <span v-else-if="posted">✅</span>
              <span v-else>📡</span>
              {{ posting ? 'Posting...' : posted ? 'Posted!' : 'Post to Nostr' }}
            </button>
            
            <!-- Copy button -->
            <button 
              @click="copyShareMessage"
              :class="[
                copied ? 'btn-success' : 'btn-secondary',
                isLoggedIn ? 'flex-1' : 'w-full'
              ]"
              class="flex items-center justify-center gap-2"
            >
              <span v-if="copied">✅</span>
              <span v-else>📋</span>
              {{ copied ? 'Copied!' : 'Copy Share Message' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Detailed Breakdown -->
      <div class="card">
        <h3 class="text-xl mb-4">Zombie Breakdown</h3>
        
        <div class="space-y-3">
          <!-- Active Users section removed since they don't count as zombies -->

          <!-- Fresh Zombies -->
          <div v-if="scoutResults.breakdown.fresh > 0" class="border border-gray-600 rounded-lg">
            <button 
              @click="toggleSection('fresh')" 
              class="w-full flex justify-between items-center p-3 bg-yellow-800/20 rounded-lg hover:bg-yellow-800/30 transition-colors"
            >
              <span class="text-yellow-400">🧟‍♀️ Fresh (120+ days inactive)</span>
              <div class="flex items-center gap-2">
                <span class="font-bold text-lg">{{ scoutResults.breakdown.fresh }}</span>
                <span class="text-sm">{{ expandedSections.fresh ? '▼' : '▶' }}</span>
              </div>
            </button>
            <div v-if="expandedSections.fresh" class="p-3 border-t border-gray-600 bg-gray-800/30">
              <div class="text-sm text-gray-400 mb-2">Sample fresh zombie accounts:</div>
              <div class="space-y-2">
                <div v-for="user in scoutResults.analysisResults.fresh.slice(0, 10)" :key="user.pubkey" class="bg-gray-700 p-3 rounded-lg">
                  <div class="flex items-start gap-3">
                    <!-- Avatar -->
                    <div class="flex-shrink-0">
                      <img 
                        v-if="getUserAvatar(user)" 
                        :src="getUserAvatar(user)" 
                        :alt="getUserDisplayName(user)"
                        class="w-10 h-10 rounded-full object-cover"
                        @error="$event.target.style.display='none'"
                      >
                      <div 
                        v-else 
                        class="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-gray-300 text-sm font-medium"
                      >
                        {{ getUserDisplayName(user).charAt(0).toUpperCase() }}
                      </div>
                    </div>
                    <!-- User Info -->
                    <div class="flex-grow min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <div class="font-medium text-white truncate">
                          {{ getUserDisplayName(user) }}
                        </div>
                        <a :href="getNostrProfileUrl(user.pubkey)" target="_blank" class="text-purple-400 hover:text-purple-300 text-xs">
                          profile ↗
                        </a>
                      </div>
                      <div class="font-mono text-xs text-gray-400 truncate">
                        {{ formatPubkeyForDisplay(user.pubkey) }}
                      </div>
                      <div v-if="user.lastActivity" class="text-xs text-yellow-400 mt-1">
                        Last active: {{ formatLastActivity(user.lastActivity) }} ({{ Math.round(user.daysSinceActivity) }} days ago)
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="scoutResults.analysisResults.fresh.length > 10" class="text-xs text-gray-500 text-center py-2">
                  ... and {{ scoutResults.analysisResults.fresh.length - 10 }} more
                </div>
              </div>
            </div>
          </div>

          <!-- Rotting Zombies -->
          <div v-if="scoutResults.breakdown.rotting > 0" class="border border-gray-600 rounded-lg">
            <button 
              @click="toggleSection('rotting')" 
              class="w-full flex justify-between items-center p-3 bg-orange-800/20 rounded-lg hover:bg-orange-800/30 transition-colors"
            >
              <span class="text-orange-400">🧟‍♂️ Rotting (180+ days inactive)</span>
              <div class="flex items-center gap-2">
                <span class="font-bold text-lg">{{ scoutResults.breakdown.rotting }}</span>
                <span class="text-sm">{{ expandedSections.rotting ? '▼' : '▶' }}</span>
              </div>
            </button>
            <div v-if="expandedSections.rotting" class="p-3 border-t border-gray-600 bg-gray-800/30">
              <div class="text-sm text-gray-400 mb-2">Sample rotting zombie accounts:</div>
              <div class="space-y-2">
                <div v-for="user in scoutResults.analysisResults.rotting.slice(0, 10)" :key="user.pubkey" class="bg-gray-700 p-3 rounded-lg">
                  <div class="flex items-start justify-between">
                    <div class="flex-grow min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <div class="font-medium text-white truncate">
                          {{ getUserDisplayName(user) }}
                        </div>
                        <a :href="getNostrProfileUrl(user.pubkey)" target="_blank" class="text-purple-400 hover:text-purple-300 text-xs">
                          profile ↗
                        </a>
                      </div>
                      <div class="font-mono text-xs text-gray-400 truncate">
                        {{ formatPubkeyForDisplay(user.pubkey) }}
                      </div>
                      <div v-if="user.lastActivity" class="text-xs text-orange-400 mt-1">
                        Last active: {{ formatLastActivity(user.lastActivity) }} ({{ Math.round(user.daysSinceActivity) }} days ago)
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="scoutResults.analysisResults.rotting.length > 10" class="text-xs text-gray-500 text-center py-2">
                  ... and {{ scoutResults.analysisResults.rotting.length - 10 }} more
                </div>
              </div>
            </div>
          </div>

          <!-- Ancient Zombies -->
          <div v-if="scoutResults.breakdown.ancient > 0" class="border border-gray-600 rounded-lg">
            <button 
              @click="toggleSection('ancient')" 
              class="w-full flex justify-between items-center p-3 bg-red-800/20 rounded-lg hover:bg-red-800/30 transition-colors"
            >
              <span class="text-red-400">💀 Ancient (365+ days inactive)</span>
              <div class="flex items-center gap-2">
                <span class="font-bold text-lg">{{ scoutResults.breakdown.ancient }}</span>
                <span class="text-sm">{{ expandedSections.ancient ? '▼' : '▶' }}</span>
              </div>
            </button>
            <div v-if="expandedSections.ancient" class="p-3 border-t border-gray-600 bg-gray-800/30">
              <div class="text-sm text-gray-400 mb-2">Sample ancient zombie accounts:</div>
              <div class="space-y-2">
                <div v-for="user in scoutResults.analysisResults.ancient.slice(0, 10)" :key="user.pubkey" class="bg-gray-700 p-3 rounded-lg">
                  <div class="flex items-start justify-between">
                    <div class="flex-grow min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <div class="font-medium text-white truncate">
                          {{ getUserDisplayName(user) }}
                        </div>
                        <a :href="getNostrProfileUrl(user.pubkey)" target="_blank" class="text-purple-400 hover:text-purple-300 text-xs">
                          profile ↗
                        </a>
                      </div>
                      <div class="font-mono text-xs text-gray-400 truncate">
                        {{ formatPubkeyForDisplay(user.pubkey) }}
                      </div>
                      <div v-if="user.lastActivity" class="text-xs text-red-400 mt-1">
                        Last active: {{ formatLastActivity(user.lastActivity) }} ({{ Math.round(user.daysSinceActivity) }} days ago)
                      </div>
                      <div v-else class="text-xs text-red-400 mt-1">
                        No activity found in last 90 days
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="scoutResults.analysisResults.ancient.length > 10" class="text-xs text-gray-500 text-center py-2">
                  ... and {{ scoutResults.analysisResults.ancient.length - 10 }} more
                </div>
              </div>
            </div>
          </div>

          <!-- Burned Zombies -->
          <div v-if="scoutResults.breakdown.burned > 0" class="border border-gray-600 rounded-lg">
            <button 
              @click="toggleSection('burned')" 
              class="w-full flex justify-between items-center p-3 bg-red-900/20 rounded-lg hover:bg-red-900/30 transition-colors"
            >
              <span class="text-red-300">🔥 Burned (deleted accounts)</span>
              <div class="flex items-center gap-2">
                <span class="font-bold text-lg">{{ scoutResults.breakdown.burned }}</span>
                <span class="text-sm">{{ expandedSections.burned ? '▼' : '▶' }}</span>
              </div>
            </button>
            <div v-if="expandedSections.burned" class="p-3 border-t border-gray-600 bg-gray-800/30">
              <div class="text-sm text-gray-400 mb-2">Sample burned zombie accounts:</div>
              <div class="space-y-2">
                <div v-for="user in scoutResults.analysisResults.burned.slice(0, 10)" :key="user.pubkey" class="bg-gray-700 p-3 rounded-lg">
                  <div class="flex items-start justify-between">
                    <div class="flex-grow min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <div class="font-medium text-white truncate">
                          {{ getUserDisplayName(user) }}
                        </div>
                        <a :href="getNostrProfileUrl(user.pubkey)" target="_blank" class="text-purple-400 hover:text-purple-300 text-xs">
                          profile ↗
                        </a>
                      </div>
                      <div class="font-mono text-xs text-gray-400 truncate">
                        {{ formatPubkeyForDisplay(user.pubkey) }}
                      </div>
                      <div class="text-xs text-red-300 mt-1">
                        🔥 Account deleted (found deletion event)
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="scoutResults.analysisResults.burned.length > 10" class="text-xs text-gray-500 text-center py-2">
                  ... and {{ scoutResults.analysisResults.burned.length - 10 }} more
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Results State -->
    <div v-else-if="scoutComplete && !scoutResults" class="card p-8 text-center">
      <div class="text-6xl mb-4">🤔</div>
      <h3 class="text-xl mb-4">Unable to Scout User</h3>
      <p class="text-gray-400 mb-6">
        Could not analyze this user's follows. They may have a private profile or no follows to analyze.
      </p>
      <button @click="showScoutNewUser" class="btn-secondary">
        Try Different User
      </button>
    </div>

    <!-- Initial State -->
    <div v-else-if="!scanning && !scoutComplete" class="card p-8 text-center">
      <div class="text-6xl mb-4">🔍</div>
      <h3 class="text-xl mb-4">Ready to Scout</h3>
      <p class="text-gray-400 mb-6">
        Scout mode will analyze {{ targetDisplay }}'s zombie follows.
      </p>
      <button @click="startScout" class="btn-scout">
        🏹 Begin Scouting
      </button>
    </div>
  </div>
</template>

<script>
import scoutService from '../services/scoutService';
import nostrService from '../services/nostrService';
import { nip19 } from 'nostr-tools';

export default {
  name: 'ScoutModeView',
  props: {
    scoutTarget: {
      type: Object,
      required: true
    },
    isLoggedIn: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      scanning: false,
      scoutComplete: false,
      scoutResults: null,
      scanProgress: {
        total: 0,
        processed: 0,
        currentNpub: '',
        stage: 'initializing'
      },
      showNewUserModal: false,
      newScoutNpub: '',
      newScoutError: '',
      processingNewUser: false,
      copied: false,
      posting: false,
      posted: false,
      showPostModal: false,
      isMyReport: false,
      expandedSections: {
        active: false,
        fresh: false,
        rotting: false,
        ancient: false,
        burned: false
      },
      showFollowCountModal: false
    }
  },
  computed: {
    targetDisplay() {
      // Try to show a readable name if available, otherwise truncated npub
      return this.scoutTarget.name || 
             this.scoutTarget.display_name || 
             (this.scoutTarget.npub.substring(0, 12) + '...');
    },
    targetUsername() {
      // Return just the username (name or display_name) without falling back to npub
      return this.scoutTarget.name || this.scoutTarget.display_name;
    },
    newScoutValid() {
      if (!this.newScoutNpub.trim()) {
        this.newScoutError = '';
        return false;
      }
      
      try {
        if (!this.newScoutNpub.startsWith('npub1') || this.newScoutNpub.length !== 63) {
          this.newScoutError = 'Invalid npub format';
          return false;
        }
        
        nip19.decode(this.newScoutNpub.trim());
        this.newScoutError = '';
        return true;
      } catch (error) {
        this.newScoutError = 'Invalid npub format';
        return false;
      }
    },
    shareMessage() {
      if (!this.scoutResults) return '';
      
      const targetNpub = this.scoutTarget.npub;
      const zombieCount = this.scoutResults.totalZombies;
      const zombieScore = this.scoutResults.zombieScore;
      
      if (this.isMyReport) {
        return `I just scouted my follows with #PlebsVsZombies! 👁️🔍🧟‍♀🧟‍♀

My Zombie Count is: ${zombieCount}

My Zombie Score is ${zombieScore}%!
${this.scoreBarEmojis.join('')}

Follow nostr:npub1pvz2c9z4pau26xdwfya24d0qhn6ne8zp9vwjuyxw629wkj9vh5lsrrsd4h and join the hunt at: 🏹
https://plebs-vs-zombies.vercel.app`;
      } else {
        return `Hey nostr:${targetNpub} — I just scouted your follows with #PlebsVsZombies! 👁️🔍🧟‍♀🧟‍♀

Your Zombie Count is: ${zombieCount}

Your Zombie Score is ${zombieScore}%!
${this.scoreBarEmojis.join('')}

Follow nostr:npub1pvz2c9z4pau26xdwfya24d0qhn6ne8zp9vwjuyxw629wkj9vh5lsrrsd4h and join the hunt at: 🏹
https://plebs-vs-zombies.vercel.app`;
      }
    },
    scoreBarSquares() {
      if (!this.scoutResults) return [];
      
      const squares = [];
      const totalSquares = 14;
      const zombiePercentage = this.scoutResults.zombieScore;
      const healthySquares = Math.floor((100 - zombiePercentage) / 100 * totalSquares);
      const zombieSquares = totalSquares - healthySquares;
      
      for (let i = 0; i < healthySquares; i++) {
        squares.push('<span class="inline-block w-3 h-3 rounded-sm" style="background-color: #8e30eb;"></span>');
      }
      for (let i = 0; i < zombieSquares; i++) {
        squares.push('<span class="inline-block w-3 h-3 rounded-sm bg-green-400"></span>');
      }
      
      return squares;
    },
    scoreBarEmojis() {
      if (!this.scoutResults) return [];
      
      const bars = [];
      const totalBars = 14;
      const zombiePercentage = this.scoutResults.zombieScore;
      const healthyBars = Math.floor((100 - zombiePercentage) / 100 * totalBars);
      const zombieBars = totalBars - healthyBars;
      
      for (let i = 0; i < healthyBars; i++) bars.push('🟪');
      for (let i = 0; i < zombieBars; i++) bars.push('🟩');
      
      return bars;
    }
  },
  methods: {
    async startScout() {
      this.scanning = true;
      this.scoutComplete = false;
      this.scoutResults = null;
      
      this.scanProgress = {
        total: 0,
        processed: 0,
        currentNpub: '',
        stage: 'Starting scout analysis...'
      };
      
      try {
        console.log('🔍 Starting scout for:', this.scoutTarget);
        
        const results = await scoutService.scoutUser(this.scoutTarget.pubkey, (progress) => {
          this.scanProgress = {
            ...this.scanProgress,
            ...progress
          };
        });
        
        // Check if scan was cancelled - if so, don't show results
        if (!scoutService.cancelled) {
          if (results.success) {
            this.scoutResults = results;
            this.scoutComplete = true;
            console.log('✅ Scout completed successfully:', results);
          } else {
            console.error('❌ Scout failed:', results.message);
            this.scoutComplete = true;
            this.scoutResults = null;
          }
        } else {
          console.log('🛑 Scan was cancelled, not showing results');
          // Ensure we stay in initial state
          this.scoutComplete = false;
          this.scoutResults = null;
        }
        
      } catch (error) {
        console.error('❌ Scout error:', error);
        // Only set error state if not cancelled
        if (!scoutService.cancelled) {
          this.scoutComplete = true;
          this.scoutResults = null;
        } else {
          // Stay in initial state if cancelled
          this.scoutComplete = false;
          this.scoutResults = null;
        }
      } finally {
        this.scanning = false;
      }
    },
    async stopScan() {
      // Force shutdown all scout activity
      await scoutService.forceShutdown();
      this.scanning = false;
      // Reset to initial state - don't show incomplete results
      this.scoutComplete = false;
      this.scoutResults = null;
      console.log('🛑 Scout scan stopped by user');
    },
    showScoutNewUser() {
      this.showPostModal = false;
      this.showNewUserModal = true;
      this.newScoutNpub = '';
      this.newScoutError = '';
    },
    async scoutNewUser() {
      if (!this.newScoutValid) return;

      // Prevent multiple simultaneous calls
      if (this.processingNewUser) {
        console.log('⚠️ scoutNewUser already processing, ignoring duplicate call');
        return;
      }
      this.processingNewUser = true;
      
      try {
        console.log('🔄 Starting new user scout process...');
        
        // Stop any existing scan first with timeout
        if (this.scanning) {
          console.log('⏹️ Stopping existing scan...');
          await Promise.race([
            this.stopScan(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Stop scan timeout')), 5000)
            )
          ]);
        }
        
        // Force shutdown with timeout
        console.log('🔄 Shutting down scout service...');
        await Promise.race([
          scoutService.forceShutdown(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Shutdown timeout')), 5000)
          )
        ]);
        
        // Reset service with timeout
        console.log('🔄 Resetting scout service...');
        await Promise.race([
          scoutService.reset(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Reset timeout')), 3000)
          )
        ]);
        
        const decoded = nip19.decode(this.newScoutNpub.trim());
        
        // Fetch user profile with timeout
        console.log('👤 Fetching user profile...');
        const profile = await Promise.race([
          scoutService.fetchUserProfile(decoded.data),
          new Promise((resolve) => 
            setTimeout(() => resolve(null), 8000)
          )
        ]);
        
        const newTarget = {
          npub: this.newScoutNpub.trim(),
          pubkey: decoded.data,
          name: profile?.name,
          display_name: profile?.display_name,
          picture: profile?.picture
        };
        
        console.log('🔄 Switching scout target from', this.scoutTarget.pubkey.substring(0, 8), 'to', newTarget.pubkey.substring(0, 8));
        
        // Update the target and close modal
        this.$emit('update-target', newTarget);
        this.showNewUserModal = false;
        
        // Reset all component state
        this.scoutComplete = false;
        this.scoutResults = null;
        this.posted = false;
        this.copied = false;
        this.isMyReport = false;
        this.showPostModal = false;
        this.expandedSections = {
          active: false,
          fresh: false,
          rotting: false,
          ancient: false,
          burned: false
        };
        
        // Wait for next tick to ensure the target is updated
        await this.$nextTick();
        console.log('✅ Target updated, starting scout for:', this.scoutTarget.pubkey.substring(0, 8));
        await this.startScout();
        
      } catch (error) {
        console.error('❌ Failed to scout new user:', error);
        this.newScoutError = error.message.includes('timeout') ? 
          'Operation timed out, please try again' : 
          'Failed to process npub';
      } finally {
        this.processingNewUser = false;
      }
    },
    exitScoutMode() {
      this.$emit('exit-scout');
    },
    formatPubkeyForProgress(pubkey) {
      if (!pubkey) return '';
      if (pubkey.length <= 16) return pubkey;
      return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8);
    },
    formatPubkeyForDisplay(pubkey) {
      if (!pubkey) return '';
      // Convert hex pubkey to npub format
      try {
        const npub = nip19.npubEncode(pubkey);
        return npub.substring(0, 12) + '...' + npub.substring(npub.length - 8);
      } catch (error) {
        // Fallback to hex if conversion fails
        return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8);
      }
    },
    toggleSection(section) {
      this.expandedSections[section] = !this.expandedSections[section];
    },
    getUserDisplayName(user) {
      if (user.display_name) return user.display_name;
      if (user.name) return user.name;
      return `${user.pubkey.substring(0, 8)}...${user.pubkey.substring(-8)}`;
    },
    getUserAvatar(user) {
      return user.profile?.picture || user.picture || '';
    },
    formatLastActivity(timestamp) {
      if (!timestamp) return 'Unknown';
      const date = new Date(timestamp * 1000);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    },
    getNostrProfileUrl(pubkey) {
      // Use Jumble for profile viewing
      const npub = nip19.npubEncode(pubkey);
      return `https://jumble.social/${npub}`;
    },
    async copyShareMessage() {
      try {
        await navigator.clipboard.writeText(this.shareMessage);
        this.copied = true;
        
        setTimeout(() => {
          this.copied = false;
        }, 3000);
      } catch (error) {
        console.error('Failed to copy share message:', error);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = this.shareMessage;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          this.copied = true;
          setTimeout(() => { this.copied = false; }, 3000);
        } catch (e) {
          console.error('Copy fallback failed:', e);
        }
        document.body.removeChild(textArea);
      }
    },
    async postToNostr() {
      if (!this.isLoggedIn) return;
      
      this.posting = true;
      
      try {
        console.log('📡 Posting scout report to Nostr...');
        
        // Create a note event
        const event = {
          kind: 1, // Text note
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['client', 'Plebs vs. Zombies', '31990:acd7818ead75a59d18a96ed87c8c0db56c98785c7df34eaeb9ab11fc7add70e7:1736530923', 'wss://relay.damus.io'],
            ['t', 'PlebsVsZombies']
          ],
          content: this.shareMessage
        };
        
        // Ensure appropriate signing method is ready
        if (!nostrService.isSigningReady()) {
          if (nostrService.signingMethod === 'nip07') {
            console.log('🔄 Extension not ready, attempting connection...');
            await nostrService.connectExtension();
          } else if (nostrService.signingMethod === 'nip46') {
            throw new Error('NIP-46 bunker not connected. Please connect your bunker first.');
          }
        }
        
        // Double-check connection is still valid
        if (!nostrService.isSigningReady()) {
          throw new Error(`Unable to establish connection with signing method: ${nostrService.signingMethod}`);
        }
        
        console.log('🔐 Starting signing process for scout report...');
        
        // Sign event using appropriate method
        let signedEvent;
        try {
          if (nostrService.signingMethod === 'nip07') {
            console.log('Attempting NIP-07 signing...');
            console.log('⏳ Calling window.nostr.signEvent() - check your extension for signing prompt...');
            
            signedEvent = await Promise.race([
              window.nostr.signEvent(event),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Signing timeout - please approve the signing request in your extension')), 60000)
              )
            ]);
          } else if (nostrService.signingMethod === 'nip46') {
            console.log('Attempting NIP-46 signing...');
            console.log('⏳ Requesting signature from bunker - check your bunker app for signing prompt...');
            
            signedEvent = await nostrService.nip46Service.signEvent(event);
          } else {
            throw new Error(`Invalid signing method: ${nostrService.signingMethod}`);
          }
          
          console.log('✅ Event signed successfully:', signedEvent.id);
        } catch (signingError) {
          console.error('❌ Signing failed:', signingError);
          throw new Error(`Failed to sign event: ${signingError.message}`);
        }
        
        if (!signedEvent) {
          throw new Error('Failed to create or sign event');
        }
        
        // Ensure relay list is fresh for posting
        if (!nostrService.isConnected) {
          await nostrService.fetchUserRelayList();
        }
        
        const publishResults = await nostrService.publishEventToRelays(signedEvent);
        
        if (publishResults.successful > 0) {
          this.posted = true;
          this.showPostModal = true;
          console.log(`✅ Scout report posted to ${publishResults.successful}/${nostrService.getPublishRelays().length} relays`);
        } else {
          throw new Error('Failed to publish to any relays');
        }
        
      } catch (error) {
        console.error('❌ Failed to post scout report:', error);
        // Show user-friendly error message but don't throw
      } finally {
        this.posting = false;
      }
    }
  },
  async mounted() {
    // Auto-start scouting when component mounts
    await this.startScout();
  }
}
</script>