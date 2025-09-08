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
              
              <button @click="scanForZombies" class="btn-danger w-full">
                Scan for Zombies
              </button>
            </div>
          </div>
          
          <div class="border-t border-gray-700 pt-4 mt-6">
            <h4 class="text-lg mb-3">Import/Export</h4>
            
            <div class="space-y-3">
              <button @click="exportFollowList" class="btn-secondary w-full">
                Export Follow List
              </button>
              
              <input 
                type="file" 
                ref="fileInput" 
                accept=".json" 
                class="hidden" 
                @change="handleFileUpload"
              />
              <button @click="$refs.fileInput.click()" class="btn-secondary w-full">
                Import Follow List
              </button>
            </div>
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
          
          <div v-else class="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            <div 
              v-for="follow in filteredFollows" 
              :key="follow.pubkey" 
              class="p-3 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <div class="flex justify-between items-center">
                <div>
                  <div class="font-mono text-sm text-gray-400 truncate" :title="follow.pubkey">
                    {{ formatPubkey(follow.pubkey) }}
                  </div>
                  <div v-if="follow.npub" class="text-xs text-gray-500 mt-1 flex items-center">
                    <span class="truncate">{{ follow.npub }}</span>
                    <CopyButton :pubkey="follow.pubkey" />
                  </div>
                </div>
                
                <div>
                  <span 
                    v-if="follow.status" 
                    class="px-2 py-0.5 text-xs rounded-full mr-2"
                    :class="{
                      'bg-pleb-blue text-white': follow.status === 'active',
                      'bg-yellow-400 text-yellow-900': follow.status === 'fresh',
                      'bg-orange-500 text-orange-900': follow.status === 'rotting',
                      'bg-red-500 text-red-900': follow.status === 'ancient'
                    }"
                  >
                    {{ follow.status }}
                  </span>
                  
                  <button 
                    @click="removeFollow(follow.pubkey)" 
                    class="text-sm px-2 py-1 bg-red-900 hover:bg-red-800 rounded"
                    title="Unfollow"
                  >
                    Unfollow
                  </button>
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
  </div>
</template>

<script>
import { format } from 'date-fns';
import CopyButton from '../components/CopyButton.vue';
import nostrService from '../services/nostrService';
import backupService from '../services/backupService';
import zombieService from '../services/zombieService';

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
      successMessage: ''
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
                 (follow.npub && follow.npub.toLowerCase().includes(query));
        });
      }
      
      // Apply sorting
      if (this.sortOption === 'recent') {
        // Assuming most recent follows are at the end of the array
        follows = [...follows].reverse();
      } else if (this.sortOption === 'npub') {
        follows.sort((a, b) => {
          const aNpub = a.npub || a.pubkey;
          const bNpub = b.npub || b.pubkey;
          return aNpub.localeCompare(bNpub);
        });
      }
      
      return follows;
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
      
      try {
        const followList = await nostrService.getFollowList();
        this.followList = followList.map(pubkey => {
          return {
            pubkey,
            npub: nostrService.hexToNpub(pubkey),
            status: null // Will be set when scanning for zombies
          };
        });
        
        this.lastUpdated = Date.now();
      } catch (error) {
        console.error('Failed to load follow list:', error);
        alert('Failed to load follow list. See console for details.');
      } finally {
        this.loading = false;
      }
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
          alert(`Failed to create backup: ${result.message}`);
        }
      } catch (error) {
        console.error('Failed to create backup:', error);
        alert('Failed to create backup. See console for details.');
      } finally {
        this.loading = false;
      }
    },
    async exportFollowList() {
      try {
        const backup = await nostrService.backupFollowList();
        backupService.exportBackupToJson(backup);
      } catch (error) {
        console.error('Failed to export follow list:', error);
        alert('Failed to export follow list. See console for details.');
      }
    },
    async handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      this.loading = true;
      
      try {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
          try {
            const content = e.target.result;
            const backup = JSON.parse(content);
            
            // Validate the backup data
            if (!backup.pubkey || !backup.follows || !Array.isArray(backup.follows)) {
              throw new Error('Invalid backup file format');
            }
            
            // Apply the imported follow list
            const applyResult = await this.applyImportedFollowList(backup);
            
            if (applyResult.success) {
              // Store the backup
              const result = await backupService.importBackupFromJson(content);
              
              if (result.success) {
                this.successMessage = `Follow list imported successfully with ${backup.follows.length} follows.`;
                await this.loadFollowList();
              } else {
                alert(`Failed to import follow list: ${result.message}`);
              }
            } else {
              alert(`Failed to apply follow list: ${applyResult.message}`);
            }
          } catch (error) {
            console.error('Failed to import follow list:', error);
            alert('Failed to import follow list. See console for details.');
          } finally {
            this.loading = false;
          }
        };
        
        reader.readAsText(file);
      } catch (error) {
        console.error('Failed to read file:', error);
        alert('Failed to read file. See console for details.');
        this.loading = false;
      }
      
      // Reset the file input
      event.target.value = '';
    },
    async applyImportedFollowList(backup) {
      try {
        const result = await backupService.applyImportedFollowList(backup);
        return result;
      } catch (error) {
        console.error('Failed to apply imported follow list:', error);
        return {
          success: false,
          message: error.message
        };
      }
    },
    async removeFollow(pubkey) {
      if (!confirm(`Are you sure you want to unfollow this account?`)) {
        return;
      }
      
      this.loading = true;
      
      try {
        const result = await nostrService.createUnfollowEvent([pubkey]);
        
        if (result.success) {
          this.successMessage = 'Account unfollowed successfully.';
          await this.loadFollowList();
        } else {
          alert(`Failed to unfollow account: ${result.message}`);
        }
      } catch (error) {
        console.error('Failed to unfollow account:', error);
        alert('Failed to unfollow account. See console for details.');
      } finally {
        this.loading = false;
      }
    },
    async scanForZombies() {
      this.loading = true;
      
      try {
        const result = await zombieService.scanForZombies();
        
        if (result.success) {
          // Update the status of each follow
          const { active, fresh, rotting, ancient } = result.zombieData;
          
          this.followList = this.followList.map(follow => {
            let status = null;
            
            if (active.includes(follow.pubkey)) {
              status = 'active';
            } else if (fresh.includes(follow.pubkey)) {
              status = 'fresh';
            } else if (rotting.includes(follow.pubkey)) {
              status = 'rotting';
            } else if (ancient.includes(follow.pubkey)) {
              status = 'ancient';
            }
            
            return {
              ...follow,
              status
            };
          });
          
          this.successMessage = `Scan complete. Found ${result.zombieCount} zombies out of ${result.totalFollows} follows.`;
        } else {
          alert(`Failed to scan for zombies: ${result.message}`);
        }
      } catch (error) {
        console.error('Failed to scan for zombies:', error);
        alert('Failed to scan for zombies. See console for details.');
      } finally {
        this.loading = false;
      }
    }
  },
  mounted() {
    this.loadFollowList();
  }
};
</script>

<style scoped>
.input {
  @apply bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm;
}
</style>