<template>
  <div>
    <h2 class="text-2xl mb-6">Follows Manager</h2>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Follow List Management -->
      <div class="lg:col-span-1">
        <div class="card mb-6">
          <h3 class="text-xl mb-4">Follow List Management</h3>
          
          <div v-if="loading" class="text-center py-4">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zombie-green"></div>
            <p class="mt-2 text-gray-400">Loading follow list...</p>
          </div>
          
          <div v-else>
            <div class="mb-4">
              <div class="flex justify-between items-center mb-2">
                <span class="text-gray-300">Total follows:</span>
                <span class="font-bold text-zombie-green">{{ followList.length }}</span>
              </div>
              
              <div class="flex justify-between items-center mb-2">
                <span class="text-gray-300">Last updated:</span>
                <span class="font-bold" v-if="lastUpdated">{{ formatDate(lastUpdated) }}</span>
                <span class="text-gray-400" v-else>Never</span>
              </div>
            </div>
            
            <div class="space-y-3">
              <button @click="refreshFollowList" class="btn-primary w-full">
                Refresh Follow List
              </button>

              <button @click="createBackup" class="btn-secondary w-full">
                Create Backup
              </button>
            </div>
          </div>

        </div>

        <!-- Hunt Zombies CTA -->
        <div v-if="followList.length > 50" class="card bg-gradient-to-br from-zombie-dark to-gray-900 border-2 border-zombie-green/40">
          <div class="text-center">
            <div class="text-5xl mb-3">🧟‍♂️</div>
            <h3 class="text-xl font-bold text-zombie-green mb-2">
              Got {{ followList.length }} Follows?
            </h3>
            <p class="text-gray-300 text-sm mb-4">
              Time to hunt for zombies and clean up your feed!
            </p>
            <button
              @click="goToZombieHunting"
              class="btn-hunt w-full"
            >
              🎯 Scan for Zombies
            </button>
          </div>
        </div>
      </div>
      
      <!-- Follow List Display -->
      <div class="lg:col-span-2">
        <div class="card">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl">Your Follows</h3>
            
            <div class="flex gap-2">
              <input 
                type="text" 
                v-model="searchQuery" 
                placeholder="Search..." 
                class="input"
              />
              
              <select v-model="sortOption" class="input">
                <option value="recent">Recently Added</option>
                <option value="name">By Name</option>
                <option value="npub">By NPUB</option>
              </select>
            </div>
          </div>
          
          <div v-if="loading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zombie-green"></div>
            <p class="mt-2 text-gray-400">Loading follows...</p>
          </div>
          
          <div v-else-if="filteredFollows.length === 0" class="text-center py-8">
            <p v-if="searchQuery" class="text-gray-400">
              No follows matching "{{ searchQuery }}"
            </p>
            <p v-else class="text-gray-400">
              No follows found. Try refreshing your follow list.
            </p>
          </div>
          
          <div v-else class="space-y-3">
            <!-- Profile Loading Progress -->
            <div v-if="profilesLoading" class="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-300">Loading profile data...</span>
                <span class="text-xs text-gray-400">{{ totalProfilesToLoad }} profiles</span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div 
                  class="bg-zombie-green h-2 rounded-full transition-all duration-300"
                  :style="{ width: totalBatches > 0 ? (currentBatch / totalBatches * 100) + '%' : '0%' }"
                ></div>
              </div>
              <div class="flex justify-between text-xs text-gray-500">
                <span>Batch {{ currentBatch }} of {{ totalBatches }}</span>
                <span>{{ profilesLoaded }} users processed</span>
              </div>
              <div class="text-xs text-gray-500 mt-1">
                Follow list is visible, profiles are loading in the background...
              </div>
            </div>
            
            <!-- Pagination Controls -->
            <div v-if="totalPages > 1" class="flex items-center justify-between pb-4 border-b border-gray-700">
              <div class="text-sm text-gray-400">
                Showing {{ (currentPage - 1) * itemsPerPage + 1 }}-{{ Math.min(currentPage * itemsPerPage, filteredFollows.length) }} of {{ filteredFollows.length }}
              </div>
              
              <div class="flex items-center gap-2">
                <button 
                  @click="goToPage(currentPage - 1)"
                  :disabled="currentPage === 1"
                  class="px-3 py-1 text-sm rounded transition-colors"
                  :class="currentPage === 1 ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'"
                >
                  ← Prev
                </button>
                
                <div class="flex items-center gap-1">
                  <button
                    v-for="page in visiblePages"
                    :key="page"
                    @click="goToPage(page)"
                    class="px-3 py-1 text-sm rounded transition-colors"
                    :class="page === currentPage ? 'bg-zombie-green text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'"
                  >
                    {{ page }}
                  </button>
                </div>
                
                <button 
                  @click="goToPage(currentPage + 1)"
                  :disabled="currentPage === totalPages"
                  class="px-3 py-1 text-sm rounded transition-colors"
                  :class="currentPage === totalPages ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'"
                >
                  Next →
                </button>
              </div>
            </div>

            <div class="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              <div 
                v-for="follow in paginatedFollows" 
                :key="follow.pubkey" 
                class="p-4 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div class="flex items-start gap-4">
                  <!-- Avatar -->
                  <div class="flex-shrink-0">
                    <img 
                      :src="getAvatarUrl(follow.profile?.picture)" 
                      :alt="follow.profile?.display_name || follow.profile?.name || 'User'"
                      class="w-12 h-12 rounded-full object-cover bg-gray-700 cursor-pointer hover:opacity-80 transition-opacity"
                      @error="handleAvatarError"
                      @click="openProfile(follow.pubkey)"
                      loading="lazy"
                      title="Click to view profile"
                    />
                  </div>
                  
                  <!-- Main Content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between">
                      <div class="flex-1 min-w-0">
                        <!-- Name and Username -->
                        <div class="flex items-center gap-2 mb-1">
                          <h4 
                            class="font-bold text-white truncate cursor-pointer hover:text-blue-400 transition-colors"
                            @click="openProfile(follow.pubkey)"
                            title="Click to view profile"
                          >
                            {{ follow.profile?.display_name || follow.profile?.name || 'Unknown User' }}
                          </h4>
                        </div>
                        
                        <!-- Bio -->
                        <p v-if="follow.profile?.about" class="text-gray-400 text-sm mb-2 line-clamp-2">
                          {{ follow.profile.about }}
                        </p>
                        
                        <!-- NIP-05 -->
                        <div v-if="follow.profile?.nip05" class="text-xs text-blue-400 mb-2">
                          <span 
                            class="cursor-pointer hover:text-blue-300 transition-colors"
                            @click="openProfile(follow.pubkey)"
                            title="Click to view profile"
                          >
                            ✓ {{ follow.profile.nip05 }}
                          </span>
                        </div>
                        
                        <!-- NPUB -->
                        <div class="text-xs text-gray-500 flex items-center gap-2">
                          <span class="truncate font-mono">{{ follow.npub }}</span>
                          <CopyButton :pubkey="follow.pubkey" />
                        </div>
                      </div>
                      
                      <!-- Actions -->
                      <div class="flex items-start gap-2 ml-4">
                        <button 
                          @click="openProfile(follow.pubkey)"
                          class="text-sm px-3 py-1 bg-blue-900 hover:bg-blue-800 rounded transition-colors"
                          title="View Profile"
                        >
                          👤 Profile
                        </button>
                        
                        <button 
                          @click="removeFollow(follow.pubkey, $event)" 
                          class="text-sm px-3 py-1 bg-red-900 hover:bg-red-800 rounded transition-colors"
                          title="Unfollow"
                          :disabled="follow.unfollowing"
                        >
                          {{ follow.unfollowing ? '⏳ Unfollowing...' : '💔 Unfollow' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div v-if="filteredFollows.length > 0" class="mt-4 text-sm text-gray-400">
            Showing {{ filteredFollows.length }} of {{ followList.length }} follows
          </div>
        </div>
      </div>
    </div>
    
    <!-- Success Dialog -->
    <div 
      v-if="successMessage" 
      class="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75"
    >
      <div class="card max-w-md mx-auto p-6">
        <h3 class="text-xl mb-4 text-zombie-green">Success!</h3>
        <p class="text-gray-300 mb-6">{{ successMessage }}</p>
        <button @click="successMessage = ''" class="btn-primary w-full">
          Close
        </button>
      </div>
    </div>
    
    <!-- Custom Alert Modal -->
    <div 
      v-if="alertModal.show" 
      class="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75"
      @click.self="closeAlert"
    >
      <div class="card max-w-md mx-auto p-6">
        <div class="flex items-center mb-4">
          <div 
            class="w-8 h-8 rounded-full flex items-center justify-center mr-3"
            :class="{
              'bg-blue-600': alertModal.type === 'info',
              'bg-red-600': alertModal.type === 'error',
              'bg-zombie-green': alertModal.type === 'success',
              'bg-yellow-600': alertModal.type === 'warning'
            }"
          >
            <span v-if="alertModal.type === 'info'">ℹ️</span>
            <span v-else-if="alertModal.type === 'error'">❌</span>
            <span v-else-if="alertModal.type === 'success'">✅</span>
            <span v-else-if="alertModal.type === 'warning'">⚠️</span>
          </div>
          <h3 
            class="text-xl font-bold"
            :class="{
              'text-blue-400': alertModal.type === 'info',
              'text-red-400': alertModal.type === 'error',
              'text-zombie-green': alertModal.type === 'success',
              'text-yellow-400': alertModal.type === 'warning'
            }"
          >
            {{ alertModal.title }}
          </h3>
        </div>
        <p class="text-gray-300 mb-6 whitespace-pre-wrap">{{ alertModal.message }}</p>
        <button @click="closeAlert" class="btn-primary w-full">
          OK
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { format } from 'date-fns';
import CopyButton from '../components/CopyButton.vue';
import nostrService from '../services/nostrService';
import backupService from '../services/backupService';

export default {
  name: 'FollowsManagerView',
  components: {
    CopyButton
  },
  data() {
    return {
      loading: true,
      followList: [],
      lastUpdated: null,
      searchQuery: '',
      sortOption: 'recent',
      successMessage: '',
      currentPage: 1,
      itemsPerPage: 20,
      profilesLoading: false,
      profilesLoaded: 0,
      totalProfilesToLoad: 0,
      currentBatch: 0,
      totalBatches: 0,
      alertModal: {
        show: false,
        title: '',
        message: '',
        type: 'info' // 'info', 'error', 'success', 'warning'
      }
    };
  },
  computed: {
    filteredFollows() {
      if (!this.followList) return [];
      
      let follows = [...this.followList];
      
      // Apply search filter
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        follows = follows.filter(follow => {
          return follow.pubkey.toLowerCase().includes(query) || 
                 (follow.npub && follow.npub.toLowerCase().includes(query)) ||
                 (follow.profile?.name && follow.profile.name.toLowerCase().includes(query)) ||
                 (follow.profile?.display_name && follow.profile.display_name.toLowerCase().includes(query)) ||
                 (follow.profile?.about && follow.profile.about.toLowerCase().includes(query)) ||
                 (follow.profile?.nip05 && follow.profile.nip05.toLowerCase().includes(query));
        });
      }
      
      // Apply sorting
      if (this.sortOption === 'recent') {
        // Assuming most recent follows are at the end of the array
        follows = [...follows].reverse();
      } else if (this.sortOption === 'name') {
        follows.sort((a, b) => {
          const aName = (a.profile?.display_name || a.profile?.name || 'Unknown User').toLowerCase();
          const bName = (b.profile?.display_name || b.profile?.name || 'Unknown User').toLowerCase();
          return aName.localeCompare(bName);
        });
      } else if (this.sortOption === 'npub') {
        follows.sort((a, b) => {
          const aNpub = a.npub || a.pubkey;
          const bNpub = b.npub || b.pubkey;
          return aNpub.localeCompare(bNpub);
        });
      }
      
      return follows;
    },
    paginatedFollows() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.filteredFollows.slice(start, end);
    },
    totalPages() {
      return Math.ceil(this.filteredFollows.length / this.itemsPerPage);
    },
    visiblePages() {
      const pages = [];
      const maxVisible = 5;
      const halfVisible = Math.floor(maxVisible / 2);
      
      let startPage = Math.max(1, this.currentPage - halfVisible);
      let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);
      
      if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      return pages;
    }
  },
  methods: {
    formatDate(timestamp) {
      return format(new Date(timestamp), 'MMM d, yyyy, HH:mm');
    },
    formatPubkey(pubkey) {
      if (!pubkey) return '';
      return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8);
    },
    async loadFollowList() {
      this.loading = true;
      this.profilesLoading = false;
      this.profilesLoaded = 0;
      this.totalProfilesToLoad = 0;
      
      try {
        // First, get the follow list and show it immediately
        const followList = await nostrService.getFollowList();
        this.followList = followList.map(pubkey => {
          return {
            pubkey,
            npub: nostrService.hexToNpub(pubkey),
            profile: null // Will be populated with profile data
          };
        });
        
        this.lastUpdated = Date.now();
        this.loading = false; // Show follow list immediately
        
        // Then fetch profile metadata in the background with progress
        if (followList.length > 0) {
          this.profilesLoading = true;
          this.totalProfilesToLoad = followList.length;
          
          console.log(`Fetching profile data for ${followList.length} follows...`);
          
          // Use the getProfileMetadata with a progress callback if available
          const profileMap = await this.getProfilesWithProgress(followList);
          
          // Update follows with profile data
          this.followList = this.followList.map(follow => {
            const profile = profileMap.get(follow.pubkey);
            return {
              ...follow,
              profile: profile || null
            };
          });
          
          console.log(`Loaded ${this.followList.length} follows with profile data`);
        }
      } catch (error) {
        console.error('Failed to load follow list:', error);
        this.showError('Failed to load follow list. See console for details.');
      } finally {
        this.loading = false;
        this.profilesLoading = false;
      }
    },
    
    async getProfilesWithProgress(pubkeys) {
      if (!pubkeys || pubkeys.length === 0) {
        return new Map();
      }
      
      // Calculate batch info (matching nostrService batch size of 25)
      const batchSize = 25;
      this.totalBatches = Math.ceil(pubkeys.length / batchSize);
      this.currentBatch = 0;
      this.profilesLoaded = 0;
      
      // Initialize result map
      const profileMap = new Map();
      
      // Process in batches to show progress
      for (let i = 0; i < pubkeys.length; i += batchSize) {
        const batch = pubkeys.slice(i, i + batchSize);
        this.currentBatch = Math.floor(i / batchSize) + 1;
        
        try {
          // Fetch profiles for this batch
          const batchProfiles = await nostrService.getProfileMetadata(batch);
          
          // Merge results
          for (const [pubkey, profile] of batchProfiles) {
            profileMap.set(pubkey, profile);
          }
          
          this.profilesLoaded += batch.length;
          
          // Small delay to allow UI to update and prevent overwhelming the relays
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Failed to fetch batch ${this.currentBatch}:`, error);
          // Continue with next batch even if this one fails
        }
      }
      
      return profileMap;
    },
    async refreshFollowList() {
      await this.loadFollowList();
    },
    async createBackup() {
      this.loading = true;
      
      try {
        const result = await backupService.createBackup('Manual backup from Follows Manager');
        
        if (result.success) {
          this.successMessage = `Backup created successfully with ${result.backup.followCount} follows.`;
        } else {
          this.showError(`Failed to create backup: ${result.message}`);
        }
      } catch (error) {
        console.error('Failed to create backup:', error);
        this.showError('Failed to create backup. See console for details.');
      } finally {
        this.loading = false;
      }
    },
    async removeFollow(pubkey, event) {
      if (!confirm(`Are you sure you want to unfollow this account?`)) {
        return;
      }
      
      // Find the user info for the success message
      const user = this.followList.find(f => f.pubkey === pubkey);
      const userName = user?.profile?.display_name || user?.profile?.name || 'User';
      
      // Set loading state on the specific user
      this.followList = this.followList.map(follow => {
        if (follow.pubkey === pubkey) {
          return { ...follow, unfollowing: true };
        }
        return follow;
      });
      
      try {
        const result = await nostrService.createUnfollowEvent([pubkey]);
        
        if (result.success) {
          // Remove the user from the local follow list immediately
          this.followList = this.followList.filter(follow => follow.pubkey !== pubkey);
          
          // Update last updated timestamp
          this.lastUpdated = Date.now();
          
          // Show success message
          this.successMessage = `Successfully unfollowed ${userName}`;
          
          console.log(`Removed ${pubkey} from local follow list. New count: ${this.followList.length}`);
        } else {
          this.showError(`Failed to unfollow account: ${result.message}`);
          
          // Remove loading state on failure
          this.followList = this.followList.map(follow => {
            if (follow.pubkey === pubkey) {
              return { ...follow, unfollowing: false };
            }
            return follow;
          });
        }
      } catch (error) {
        console.error('Failed to unfollow account:', error);
        this.showError('Failed to unfollow account. See console for details.');
        
        // Remove loading state on failure
        this.followList = this.followList.map(follow => {
          if (follow.pubkey === pubkey) {
            return { ...follow, unfollowing: false };
          }
          return follow;
        });
      }
    },
    goToPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
      }
    },
    goToZombieHunting() {
      this.$emit('navigate', 'hunting');
      // If the parent App doesn't handle navigate event, use router or direct method
      if (this.$parent && this.$parent.setActiveView) {
        this.$parent.setActiveView('hunting');
      }
    },
    handleAvatarError(event) {
      const img = event.target;
      const originalSrc = img.src;
      
      // Log common problematic domains for debugging
      if (originalSrc.includes('instagram.com') || originalSrc.includes('facebook.com')) {
        console.warn(`Failed to load avatar from ${new URL(originalSrc).hostname} (likely blocked by CORS/403)`);
      } else {
        console.warn(`Failed to load avatar: ${originalSrc}`);
      }
      
      // Set fallback avatar
      img.src = '/default-avatar.svg';
      img.onerror = null; // Prevent infinite loop if default avatar also fails
    },
    openProfile(pubkey) {
      // Open profile in a new tab using jumble.social
      const npub = this.followList.find(f => f.pubkey === pubkey)?.npub;
      if (npub) {
        // Use jumble.social as primary profile viewer
        window.open(`https://jumble.social/users/${npub}`, '_blank');
      }
    },
    showError(message) {
      this.showAlert('Error', message, 'error');
    },
    showSuccess(message) {
      this.showAlert('Success', message, 'success');
    },
    showWarning(message) {
      this.showAlert('Warning', message, 'warning');
    },
    showInfo(message) {
      this.showAlert('Info', message, 'info');
    },
    showAlert(title, message, type = 'info') {
      this.alertModal = {
        show: true,
        title,
        message,
        type
      };
    },
    closeAlert() {
      this.alertModal.show = false;
    },
    getAvatarUrl(pictureUrl) {
      if (!pictureUrl) {
        return '/default-avatar.svg';
      }
      
      // Check for known problematic domains and use default avatar instead
      const problematicDomains = [
        'instagram.com',
        'facebook.com',
        'fbcdn.net',
        'cdninstagram.com'
      ];
      
      const url = pictureUrl.toLowerCase();
      if (problematicDomains.some(domain => url.includes(domain))) {
        console.warn(`Skipping potentially blocked avatar from: ${new URL(pictureUrl).hostname}`);
        return '/default-avatar.svg';
      }
      
      return pictureUrl;
    },
    async debugSpecificUser(npub) {
      console.log('🔍 DEBUGGING UNKNOWN USER ISSUE');
      console.log('================================');
      console.log(`NPUB: ${npub}`);
      
      try {
        // Convert npub to hex
        let hex;
        try {
          const { decode } = await import('nostr-tools/nip19');
          const decoded = decode(npub);
          hex = decoded.data;
          console.log(`HEX:  ${hex}`);
        } catch (decodeError) {
          console.error('❌ Failed to decode npub:', decodeError.message);
          return;
        }
        
        console.log('');
        
        // Check if user is in current follows list
        console.log('1. 📝 Checking current follows list...');
        const userInList = this.followList.find(f => f.pubkey === hex);
        if (userInList) {
          console.log('✅ User found in follows list:');
          console.log('- Pubkey:', userInList.pubkey);
          console.log('- Profile data:', userInList.profile);
          console.log('- Display name would be:', userInList.profile?.display_name || userInList.profile?.name || 'Unknown User');
          console.log('- Name:', userInList.profile?.name || 'null');
          console.log('- Display Name:', userInList.profile?.display_name || 'null');
          console.log('- About:', userInList.profile?.about ? userInList.profile.about.substring(0, 100) + '...' : 'null');
          console.log('- Picture:', userInList.profile?.picture || 'null');
          console.log('- NIP-05:', userInList.profile?.nip05 || 'null');
          console.log('- Deleted:', userInList.profile?.deleted);
        } else {
          console.log('❌ User not found in current follows list');
        }
        
        console.log('');
        console.log('2. 📋 Fetching profile metadata directly...');
        const profileMap = await nostrService.getProfileMetadata([hex]);
        const profile = profileMap.get(hex);
        
        console.log('Profile data received:');
        console.log('- Raw profile object:', profile);
        console.log('- Name:', profile?.name || 'null');
        console.log('- Display Name:', profile?.display_name || 'null');
        console.log('- About:', profile?.about ? profile.about.substring(0, 100) + '...' : 'null');
        console.log('- Picture:', profile?.picture || 'null');
        console.log('- NIP-05:', profile?.nip05 || 'null');
        console.log('- Deleted:', profile?.deleted);
        console.log('');
        
        // Check what the display logic would show
        const displayName = profile?.display_name || profile?.name || 'Unknown User';
        console.log(`3. 🖥️ Display logic result: "${displayName}"`);
        console.log('');
        
        console.log('4. 🔍 Checking for profile events directly from relays...');
        await nostrService.initialize();
        
        const profileFilter = {
          kinds: [0],
          authors: [hex],
          limit: 5
        };
        
        const events = await nostrService.ndk.fetchEvents(profileFilter);
        console.log(`Found ${events.size} profile events for this user`);
        
        let eventIndex = 0;
        events.forEach((event) => {
          eventIndex++;
          console.log(`Event ${eventIndex}:`);
          console.log('- Created at:', new Date(event.created_at * 1000).toISOString());
          console.log('- Content length:', event.content.length);
          console.log('- Content preview:', event.content.substring(0, 100) + '...');
          
          try {
            const parsed = JSON.parse(event.content);
            console.log('- Parsed name:', parsed.name);
            console.log('- Parsed display_name:', parsed.display_name);
            console.log('- Parsed deleted:', parsed.deleted);
          } catch (e) {
            console.log('- JSON parse error:', e.message);
          }
          console.log('---');
        });
        
      } catch (error) {
        console.error('❌ Error during investigation:', error);
      }
      
      console.log('🏁 INVESTIGATION COMPLETE');
      console.log('You can now call window.debugUnknownUser("npub...") to debug other users');
    }
  },
  mounted() {
    this.loadFollowList();
    
    // Add debug method to window for console access
    window.debugUnknownUser = (npub) => {
      this.debugSpecificUser(npub);
    };
  }
};
</script>

<style scoped>
.input {
  @apply bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Profile clickable elements */
.cursor-pointer:hover {
  transform: translateX(1px);
}

/* Avatar hover effect */
img.cursor-pointer:hover {
  transform: scale(1.05);
}
</style>