<template>
  <div class="card">
    <h3 class="text-xl mb-4">{{ title }}</h3>
    <div class="zombie-selection-list">
      <div v-if="loading" class="text-center py-4">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zombie-green"></div>
        <p class="mt-2 text-gray-400">Loading zombies...</p>
      </div>
      
      <div v-else-if="zombies.length === 0" class="text-center py-4">
        <p class="text-gray-400">No zombies found in this category</p>
        <p class="text-xs text-gray-500 mt-1">They might all have zombie immunity 🛡️</p>
      </div>
      
      <div v-else class="space-y-4">
        <!-- Pagination Controls at Top -->
        <div v-if="availableZombies.length > itemsPerPage" class="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
          <div class="text-sm text-gray-400">
            Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }}-{{ Math.min(currentPage * itemsPerPage, availableZombies.length) }} of {{ availableZombies.length }} zombies
          </div>
          <div class="flex items-center gap-3">
            <button 
              @click="currentPage = 1" 
              :disabled="currentPage === 1"
              class="btn-secondary text-sm disabled:opacity-50"
              title="First page"
            >
              ⇤ First
            </button>
            <button 
              @click="previousPage" 
              :disabled="currentPage === 1"
              class="btn-secondary text-sm disabled:opacity-50"
            >
              ← Previous
            </button>
            <span class="text-sm text-gray-300 px-3 py-1 bg-gray-700 rounded">
              {{ currentPage }} / {{ totalPages }}
            </span>
            <button 
              @click="nextPage" 
              :disabled="currentPage === totalPages"
              class="btn-secondary text-sm disabled:opacity-50"
            >
              Next →
            </button>
            <button 
              @click="currentPage = totalPages" 
              :disabled="currentPage === totalPages"
              class="btn-secondary text-sm disabled:opacity-50"
              title="Last page"
            >
              Last ⇥
            </button>
          </div>
        </div>
        
        <!-- Zombie List -->
        <div class="space-y-2">
          <div 
            v-for="zombie in paginatedZombies" 
            :key="zombie.pubkey" 
            class="flex items-center p-3 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
          >
          <input 
            type="checkbox" 
            :id="zombie.pubkey" 
            :value="zombie.pubkey" 
            v-model="selectedZombies"
            class="mr-3 h-5 w-5 rounded text-zombie-green focus:ring-zombie-green"
          />
          <div class="flex-grow">
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <!-- Profile Picture -->
                <img 
                  v-if="zombie.profile?.picture" 
                  :src="zombie.profile.picture" 
                  :alt="getDisplayName(zombie)"
                  class="w-10 h-10 rounded-full mr-3 border-2 border-gray-600"
                  @error="$event.target.style.display = 'none'"
                />
                <div v-else class="w-10 h-10 rounded-full mr-3 bg-gray-700 flex items-center justify-center text-gray-400 text-xs">
                  👤
                </div>
                
                <div>
                  <!-- Display Name -->
                  <div class="font-medium text-gray-100">
                    {{ getDisplayName(zombie) }}
                  </div>
                  <!-- Username -->
                  <div class="text-sm text-gray-400" v-if="zombie.profile?.name && zombie.profile.name !== getDisplayName(zombie)">
                    @{{ zombie.profile.name }}
                  </div>
                  <!-- Npub fallback -->
                  <div class="font-mono text-xs text-gray-500 break-all flex items-center" :title="zombie.pubkey">
                    {{ formatNpub(zombie.pubkey) }}
                    <CopyButton :pubkey="zombie.pubkey" />
                  </div>
                </div>
              </div>
              
              <!-- Zombie Type Badge -->
              <div class="flex flex-col items-end gap-1">
                <span 
                  class="px-2 py-1 text-xs rounded-full"
                  :class="{
                    'bg-red-700 text-red-100': zombie.type === 'burned',
                    'bg-yellow-600 text-yellow-100': zombie.type === 'fresh',
                    'bg-orange-600 text-orange-100': zombie.type === 'rotting',
                    'bg-red-600 text-red-100': zombie.type === 'ancient'
                  }"
                >
                  {{ zombie.type === 'burned' ? '🔥 burned' : zombie.type }} zombie
                </span>
              </div>
            </div>
            
            <!-- Activity Info -->
            <div class="mt-2 text-sm text-gray-400">
              <div v-if="zombie.type === 'burned'" class="space-y-1">
                <div class="flex items-center justify-between">
                  <span class="text-red-300">🔥 Account marked as deleted</span>
                  <span v-if="zombie.deletionInfo" class="text-xs text-gray-500">
                    {{ Math.floor(zombie.deletionInfo.deletionAge / (24 * 60 * 60)) }} days ago
                  </span>
                </div>
                <div v-if="zombie.lastActivity" class="text-xs text-gray-500">
                  Last activity: {{ formatLastActivity(zombie.lastActivity) }} 
                  ({{ zombie.daysSinceActivity }} days ago)
                </div>
                <div v-if="zombie.deletionInfo && zombie.deletionInfo.profileUpdatesAfterDeletion > 0" class="text-xs text-orange-400">
                  ⚠️ {{ zombie.deletionInfo.profileUpdatesAfterDeletion }} profile updates after deletion
                </div>
              </div>
              <div v-else>
                Last activity: {{ formatLastActivity(zombie.lastActivity) }}
                <span v-if="zombie.daysSinceActivity" class="text-gray-500">
                  ({{ zombie.daysSinceActivity }} days ago)
                </span>
              </div>
            </div>
            
            <!-- About/Bio if available -->
            <div v-if="zombie.profile?.about" class="mt-1 text-xs text-gray-500 truncate">
              {{ zombie.profile.about.substring(0, 100) }}{{ zombie.profile.about.length > 100 ? '...' : '' }}
            </div>
            
            <!-- Action Buttons -->
            <div class="mt-2 flex flex-col sm:flex-row gap-1 sm:gap-2">
              <button 
                @click="viewProfile(zombie)" 
                class="text-xs px-2 py-1 bg-pleb-blue hover:bg-blue-600 rounded transition-colors"
                title="View full profile"
              >
                View Profile
              </button>
              <button 
                @click="grantImmunity(zombie)" 
                class="text-xs px-2 py-1 bg-green-700 hover:bg-green-600 rounded transition-colors"
                title="Grant zombie immunity (whitelist)"
              >
                🛡️ Grant Immunity
              </button>
            </div>
          </div>
        </div>
        </div>
        
        <!-- Bottom Pagination Controls (duplicate for convenience) -->
        <div v-if="availableZombies.length > itemsPerPage" class="mt-6 flex flex-col sm:flex-row justify-center items-center gap-3 p-4 bg-gray-800 border border-gray-700 rounded-lg">
          <div class="text-sm text-gray-400">
            Page {{ currentPage }} of {{ totalPages }} ({{ availableZombies.length }} total zombies)
          </div>
          <div class="flex items-center gap-3">
            <button 
              @click="currentPage = 1" 
              :disabled="currentPage === 1"
              class="btn-secondary text-sm disabled:opacity-50"
            >
              ⇤ First
            </button>
            <button 
              @click="previousPage" 
              :disabled="currentPage === 1"
              class="btn-secondary text-sm disabled:opacity-50"
            >
              ← Previous
            </button>
            <button 
              @click="nextPage" 
              :disabled="currentPage === totalPages"
              class="btn-secondary text-sm disabled:opacity-50"
            >
              Next →
            </button>
            <button 
              @click="currentPage = totalPages" 
              :disabled="currentPage === totalPages"
              class="btn-secondary text-sm disabled:opacity-50"
            >
              Last ⇥
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="mt-6 space-y-4">
      <!-- Selection Summary -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-3 bg-gray-800 rounded-lg">
        <div class="text-sm text-gray-300">
          <div class="font-medium">
            {{ totalSelectedCount }} of {{ availableZombies.length }} total selected
          </div>
          <div class="text-xs text-gray-400 mt-1">
            {{ currentPageSelectedCount }} of {{ paginatedZombies.length }} selected on this page
            <span v-if="immuneZombies.size > 0" class="ml-2 text-green-400">
              | {{ immuneZombies.size }} immune 🛡️
            </span>
          </div>
        </div>
      </div>
      
      <!-- Selection Controls -->
      <div class="flex flex-wrap justify-center sm:justify-between items-center gap-2">
        <!-- Current Page Controls -->
        <div class="flex gap-2">
          <button 
            v-if="!allCurrentPageSelected"
            @click="selectAll" 
            class="text-sm btn-secondary"
            :disabled="paginatedZombies.length === 0"
          >
            Select Page ({{ paginatedZombies.length }})
          </button>
          <button 
            v-if="allCurrentPageSelected && currentPageSelectedCount > 0"
            @click="deselectCurrentPage" 
            class="text-sm btn-secondary"
          >
            Deselect Page
          </button>
        </div>
        
        <!-- Global Controls -->
        <div class="flex gap-2">
          <button 
            @click="selectAllPages" 
            class="text-sm btn-primary"
            :disabled="availableZombies.length === 0 || totalSelectedCount === availableZombies.length"
          >
            Select All ({{ availableZombies.length }})
          </button>
          <button 
            @click="clearSelection" 
            class="text-sm btn-secondary"
            :disabled="selectedZombies.length === 0"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
    
    <div class="mt-6 border-t border-gray-700 pt-4">
      <!-- Warning for large batches -->
      <div v-if="totalSelectedCount > 50" class="mb-4 p-3 bg-yellow-900 border border-yellow-600 rounded-lg">
        <div class="text-yellow-200 text-sm">
          ⚠️ <strong>Large batch warning:</strong> You've selected {{ totalSelectedCount }} zombies.
        </div>
        <div class="text-yellow-300 text-xs mt-1">
          Large follow lists may cause signing issues. Consider unfollowing 10-30 zombies at a time for better reliability.
        </div>
      </div>
      
      <button 
        @click="confirmPurge" 
        class="btn-danger w-full flex justify-center items-center gap-2"
        :disabled="totalSelectedCount === 0"
      >
        <span>Purge Selected Zombies</span>
        <span>({{ totalSelectedCount }})</span>
      </button>
    </div>
  </div>
</template>

<script>
import { format, formatDistanceToNow } from 'date-fns';
import { nip19 } from 'nostr-tools';
import immunityService from '../services/immunityService';
import CopyButton from './CopyButton.vue';

export default {
  name: 'ZombieBatchSelector',
  components: {
    CopyButton
  },
  props: {
    title: {
      type: String,
      default: 'Select Zombies to Purge'
    },
    zombies: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      selectedZombies: [], // Tracks selected pubkeys across all pages
      currentPage: 1,
      itemsPerPage: 25,
      immuneZombies: new Set() // Track zombies that have been granted immunity in this session
    };
  },
  computed: {
    // Filter out zombies that have been granted immunity in this session
    availableZombies() {
      return this.zombies.filter(zombie => !this.immuneZombies.has(zombie.pubkey));
    },
    totalPages() {
      return Math.ceil(this.availableZombies.length / this.itemsPerPage);
    },
    paginatedZombies() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      return this.availableZombies.slice(start, start + this.itemsPerPage);
    },
    // Count total selections across all pages
    totalSelectedCount() {
      return this.selectedZombies.filter(pubkey => 
        this.availableZombies.some(zombie => zombie.pubkey === pubkey)
      ).length;
    },
    // Count selections on current page only
    currentPageSelectedCount() {
      return this.selectedZombies.filter(pubkey => 
        this.paginatedZombies.some(zombie => zombie.pubkey === pubkey)
      ).length;
    },
    // Check if all zombies on current page are selected
    allCurrentPageSelected() {
      return this.paginatedZombies.length > 0 && 
             this.paginatedZombies.every(zombie => this.selectedZombies.includes(zombie.pubkey));
    }
  },
  methods: {
    formatPubkey(pubkey) {
      if (!pubkey) return '';
      return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8);
    },
    formatNpub(pubkey) {
      if (!pubkey) return '';
      try {
        const npub = nip19.npubEncode(pubkey);
        return npub.substring(0, 12) + '...' + npub.substring(npub.length - 8);
      } catch (error) {
        console.error('Failed to encode npub:', error);
        return this.formatPubkey(pubkey);
      }
    },
    formatLastActivity(timestamp) {
      if (!timestamp) {
        return 'Unknown';
      }
      
      try {
        const date = new Date(timestamp * 1000);
        return `${formatDistanceToNow(date, { addSuffix: true })}`;
      } catch (error) {
        console.error('formatLastActivity error:', error);
        return 'Unknown';
      }
    },
    getDisplayName(zombie) {
      const profile = zombie.profile;
      if (!profile) return this.formatNpub(zombie.pubkey);
      
      return profile.display_name || profile.name || this.formatNpub(zombie.pubkey);
    },
    selectAll() {
      // Add all zombies from current page to selection
      const currentPagePubkeys = this.paginatedZombies.map(zombie => zombie.pubkey);
      currentPagePubkeys.forEach(pubkey => {
        if (!this.selectedZombies.includes(pubkey)) {
          this.selectedZombies.push(pubkey);
        }
      });
    },
    selectAllPages() {
      // Select ALL zombies across all pages
      this.selectedZombies = [...this.availableZombies.map(zombie => zombie.pubkey)];
    },
    deselectCurrentPage() {
      // Remove current page selections
      const currentPagePubkeys = this.paginatedZombies.map(zombie => zombie.pubkey);
      this.selectedZombies = this.selectedZombies.filter(pubkey => !currentPagePubkeys.includes(pubkey));
    },
    clearSelection() {
      this.selectedZombies = [];
    },
    previousPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
      }
    },
    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
      }
    },
    viewProfile(zombie) {
      // Validate pubkey format first
      if (!zombie.pubkey || typeof zombie.pubkey !== 'string' || zombie.pubkey.length !== 64 || !/^[0-9a-fA-F]+$/i.test(zombie.pubkey)) {
        console.error('Invalid pubkey format:', zombie.pubkey, 'length:', zombie.pubkey?.length);
        alert(`Cannot view profile: Invalid pubkey format`);
        return;
      }
      
      try {
        const npub = nip19.npubEncode(zombie.pubkey);
        const profileUrl = `https://jumble.social/${npub}`;
        window.open(profileUrl, '_blank');
      } catch (error) {
        console.error('Failed to generate profile URL:', error);
        alert(`Cannot view profile: ${error.message}`);
      }
    },
    async grantImmunity(zombie) {
      const displayName = this.getDisplayName(zombie);
      const reason = prompt(
        `Grant zombie immunity to ${displayName}?\n\nThis will add them to your whitelist and they won't appear in future scans.\n\nOptional reason:`,
        'Manual review - not actually inactive'
      );
      
      if (reason !== null) { // null means cancelled
        try {
          await immunityService.grantImmunity(zombie.pubkey, reason || 'Manual immunity grant');
          
          // Track this zombie as immune in this session (prevents reappearance until reload)
          this.immuneZombies.add(zombie.pubkey);
          
          // Remove from selection if selected
          const index = this.selectedZombies.indexOf(zombie.pubkey);
          if (index > -1) {
            this.selectedZombies.splice(index, 1);
          }
          
          // Adjust current page if we're now on a page beyond available pages
          const newTotalPages = Math.ceil(this.availableZombies.length / this.itemsPerPage);
          if (this.currentPage > newTotalPages && newTotalPages > 0) {
            this.currentPage = newTotalPages;
          }
          
          // Emit event to parent to update statistics
          this.$emit('immunity-granted', zombie.pubkey);
          
          alert(`${displayName} has been granted zombie immunity! 🛡️`);
        } catch (error) {
          console.error('Failed to grant immunity:', error);
          alert('Failed to grant immunity. See console for details.');
        }
      }
    },
    confirmPurge() {
      // Additional warning for very large batches
      if (this.totalSelectedCount > 50) {
        const confirmed = confirm(
          `⚠️ WARNING: You're about to unfollow ${this.totalSelectedCount} accounts.\n\n` +
          `Large batches may fail due to Nostr extension limitations.\n\n` +
          `Recommendation: Try 10-30 accounts at a time for better success rates.\n\n` +
          `Continue with ${this.totalSelectedCount} accounts anyway?`
        );
        if (!confirmed) {
          return;
        }
      }
      
      this.$emit('purge', this.selectedZombies);
    }
  },
  watch: {
    zombies(newZombies, oldZombies) {
      // Only clear selections if this is a brand new scan (not just immunity changes)
      const isNewScan = !oldZombies || 
                        oldZombies.length === 0 || 
                        Math.abs(newZombies.length - oldZombies.length) > 5; // Significant change suggests new scan
      
      if (isNewScan) {
        // New scan detected - reset everything
        this.selectedZombies = [];
        this.immuneZombies.clear();
        this.currentPage = 1;
      } else {
        // Minor changes (likely immunity grants) - preserve selections but clean up
        // Remove any selected zombies that are no longer in the list
        this.selectedZombies = this.selectedZombies.filter(pubkey => 
          newZombies.some(zombie => zombie.pubkey === pubkey)
        );
        
        // Adjust current page if it's now beyond the available pages
        const newTotalPages = Math.ceil(this.availableZombies.length / this.itemsPerPage);
        if (this.currentPage > newTotalPages && newTotalPages > 0) {
          this.currentPage = newTotalPages;
        }
      }
    }
  },
  emits: ['purge', 'immunity-granted']
};
</script>

<style scoped>
/* Removed max-height and overflow restrictions to allow natural page flow */
.zombie-selection-list {
  /* Let the list grow naturally and use browser's main scrollbar */
}
</style>