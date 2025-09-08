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
        <div v-if="zombies.length > itemsPerPage" class="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
          <div class="text-sm text-gray-400">
            Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }}-{{ Math.min(currentPage * itemsPerPage, zombies.length) }} of {{ zombies.length }} zombies
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
            <div class="mt-2 text-sm text-gray-400 flex items-center justify-between">
              <span v-if="zombie.type === 'burned'">
                🔥 Account deleted - highest priority for removal
              </span>
              <span v-else>
                Last activity: {{ formatLastActivity(zombie.lastActivity) }}
                <span v-if="zombie.daysSinceActivity" class="text-gray-500">
                  ({{ zombie.daysSinceActivity }} days ago)
                </span>
              </span>
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
        <div v-if="zombies.length > itemsPerPage" class="mt-6 flex flex-col sm:flex-row justify-center items-center gap-3 p-4 bg-gray-800 border border-gray-700 rounded-lg">
          <div class="text-sm text-gray-400">
            Page {{ currentPage }} of {{ totalPages }} ({{ zombies.length }} total zombies)
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
    
    <div class="mt-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
      <div class="text-sm text-gray-400 text-center sm:text-left">
        {{ selectedZombies.length }} of {{ zombies.length }} selected
      </div>
      <div class="flex justify-center sm:justify-end gap-2">
        <button 
          @click="selectAll" 
          class="text-sm btn-secondary"
          :disabled="zombies.length === 0"
        >
          Select All
        </button>
        <button 
          @click="clearSelection" 
          class="text-sm btn-secondary"
          :disabled="selectedZombies.length === 0"
        >
          Clear
        </button>
      </div>
    </div>
    
    <div class="mt-6 border-t border-gray-700 pt-4">
      <button 
        @click="$emit('purge', selectedZombies)" 
        class="btn-danger w-full flex justify-center items-center gap-2"
        :disabled="selectedZombies.length === 0"
      >
        <span>Purge Selected Zombies</span>
        <span>({{ selectedZombies.length }})</span>
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
      selectedZombies: [],
      currentPage: 1,
      itemsPerPage: 25
    };
  },
  computed: {
    totalPages() {
      return Math.ceil(this.zombies.length / this.itemsPerPage);
    },
    paginatedZombies() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      return this.zombies.slice(start, start + this.itemsPerPage);
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
        console.log('🚨 formatLastActivity: timestamp is null/undefined');
        return 'Unknown';
      }
      
      try {
        const date = new Date(timestamp * 1000);
        console.log(`✅ formatLastActivity: ${timestamp} -> ${date.toISOString()} -> ${formatDistanceToNow(date, { addSuffix: true })}`);
        return `${formatDistanceToNow(date, { addSuffix: true })}`;
      } catch (error) {
        console.log('🚨 formatLastActivity error:', error);
        return 'Unknown';
      }
    },
    getDisplayName(zombie) {
      const profile = zombie.profile;
      if (!profile) return this.formatNpub(zombie.pubkey);
      
      return profile.display_name || profile.name || this.formatNpub(zombie.pubkey);
    },
    selectAll() {
      this.selectedZombies = this.paginatedZombies.map(zombie => zombie.pubkey);
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
          
          // Remove from selection if selected
          const index = this.selectedZombies.indexOf(zombie.pubkey);
          if (index > -1) {
            this.selectedZombies.splice(index, 1);
          }
          
          // Emit event to parent to refresh the list
          this.$emit('immunity-granted', zombie.pubkey);
          
          alert(`${displayName} has been granted zombie immunity! 🛡️`);
        } catch (error) {
          console.error('Failed to grant immunity:', error);
          alert('Failed to grant immunity. See console for details.');
        }
      }
    }
  },
  watch: {
    zombies(newZombies, oldZombies) {
      // Clear selection when zombie list changes
      this.selectedZombies = [];
      
      // Only reset to page 1 if this is a completely new scan (different length)
      // Don't reset if just filtering out immune zombies (keep user's current page)
      if (!oldZombies || newZombies.length !== oldZombies.length) {
        // Adjust current page if it's now beyond the total pages
        const newTotalPages = Math.ceil(newZombies.length / this.itemsPerPage);
        if (this.currentPage > newTotalPages && newTotalPages > 0) {
          this.currentPage = newTotalPages;
        }
        // Only reset to page 1 for completely new scans (when we had no zombies before)
        if (!oldZombies || oldZombies.length === 0) {
          this.currentPage = 1;
        }
      }
      
      // Debug: log zombie data structure
      if (this.zombies.length > 0) {
        console.log('🧟 ZombieBatchSelector received zombies:', this.zombies.length);
        console.log('🧟 First zombie structure:', this.zombies[0]);
        
        // Check for our problematic users
        const debugPrefixes = ['d4338b7c', '8c7c6312', '2e5c7e3'];
        for (const zombie of this.zombies) {
          for (const prefix of debugPrefixes) {
            if (zombie.pubkey?.startsWith(prefix)) {
              console.log(`🎯 Found debug user ${zombie.pubkey.substring(0, 8)}... in zombie list:`, zombie);
            }
          }
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