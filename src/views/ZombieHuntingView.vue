<template>
  <div>
    <h2 class="text-2xl mb-6">Zombie Hunting</h2>
    
    <div class="grid grid-cols-1 xl:grid-cols-3 lg:grid-cols-2 gap-6">
      <div class="xl:col-span-1 lg:col-span-1">
        <div class="card mb-6">
          <h3 class="text-xl mb-4">Hunt Controls</h3>
          
          <div v-if="loading" class="text-center py-4">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zombie-green"></div>
            <p class="mt-2 text-gray-400">Loading data...</p>
          </div>
          
          <div v-else>
            <div class="mb-4">
              <label class="block text-gray-300 mb-2">Zombie Age Threshold</label>
              <select 
                v-model="selectedThreshold" 
                class="input w-full"
                @change="updateThreshold"
              >
                <option value="90">Fresh Zombies (90+ days)</option>
                <option value="180">Rotting Zombies (180+ days)</option>
                <option value="365">Ancient Zombies (365+ days)</option>
                <option value="all">All Zombies</option>
              </select>
            </div>
            
            <div class="mb-4">
              <label class="block text-gray-300 mb-2">Batch Size</label>
              <div class="flex items-center">
                <input 
                  type="range" 
                  v-model.number="batchSize" 
                  min="5" 
                  max="50" 
                  step="5" 
                  class="w-full mr-3"
                />
                <span class="text-zombie-green font-bold">{{ batchSize }}</span>
              </div>
              <p class="text-sm text-gray-400 mt-1">
                Recommended: 30 zombies per batch
              </p>
            </div>
            
            <div class="mb-6">
              <button 
                @click="scanForZombies" 
                class="btn-primary w-full"
                :disabled="scanning"
              >
                {{ scanning ? 'Scanning...' : 'Scan for Zombies' }}
              </button>
              
              <button 
                v-if="scanning"
                @click="stopScan" 
                class="btn-danger w-full mt-2"
              >
                Stop Scan
              </button>
              
              
            </div>
            
            <div class="border-t border-gray-700 pt-4">
              <h4 class="text-lg mb-3">Hunt Statistics</h4>
              
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-gray-300">Total follows:</span>
                  <span class="font-bold">{{ stats.totalFollows }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-300">Immune users:</span>
                  <span class="font-bold text-green-400">🛡️ {{ stats.immuneUsers }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-300">Zombies found:</span>
                  <span class="font-bold text-red-500">{{ stats.totalZombies }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-300">Zombies purged:</span>
                  <span class="font-bold text-zombie-green">{{ stats.zombiesPurged }}</span>
                </div>
              </div>
            </div>
            
            <div class="border-t border-gray-700 pt-4 mt-4">
              <h4 class="text-lg mb-3">Immunity Management</h4>
              
              <div class="space-y-2">
                <button 
                  @click="viewImmuneUsers" 
                  class="btn-secondary w-full text-sm"
                  :disabled="stats.immuneUsers === 0"
                >
                  View Immune Users ({{ stats.immuneUsers }})
                </button>
                
                <button 
                  @click="resetImmunity" 
                  class="btn-danger w-full text-sm"
                  :disabled="stats.immuneUsers === 0"
                >
                  Reset All Immunity
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <ZombieStats
          v-if="zombieStatsReady"
          title="Zombie Breakdown"
          :stats="zombieStats"
        />
      </div>
      
      <div class="xl:col-span-2 lg:col-span-1">
        <!-- Scanning Progress Display -->
        <div v-if="scanning" class="card mb-6 p-6">
          <div class="flex flex-col">
            <h3 class="text-xl mb-4 text-center">Scanning for Zombies...</h3>
            
            <!-- Progress Bar -->
            <div class="mb-6">
              <div class="flex justify-between text-sm text-gray-400 mb-2">
                <span class="truncate">{{ scanProgress.stage || 'Initializing...' }}</span>
                <span class="flex-shrink-0 ml-2">{{ scanProgress.processed || 0 }} / {{ scanProgress.total || 0 }}</span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-3">
                <div 
                  class="bg-zombie-green h-3 rounded-full transition-all duration-300"
                  :style="{ width: scanProgress.total > 0 ? (scanProgress.processed / scanProgress.total * 100) + '%' : '0%' }"
                ></div>
              </div>
            </div>
            
            <!-- Current Processing Info -->
            <div class="flex flex-col justify-center space-y-4 mb-6">
              <div class="text-sm text-gray-300 break-all text-center h-10 flex items-center justify-center">
                <span v-if="scanProgress.currentNpub">
                  <span class="text-gray-400">Processing:</span>
                  <span class="font-mono text-xs sm:text-sm">{{ scanProgress.currentNpub }}</span>
                </span>
                <span v-else>&nbsp;</span>
              </div>
              
              <div class="flex justify-center gap-4 sm:gap-8 text-lg">
                <div class="text-center">
                  <div class="text-xl sm:text-2xl font-bold text-blue-400 h-8 flex items-center justify-center">{{ scanProgress.processed || 0 }}</div>
                  <div class="text-xs text-gray-400">{{ getScanProgressLabel() }}</div>
                </div>
                <div class="text-center">
                  <div class="text-xl sm:text-2xl font-bold text-gray-400 h-8 flex items-center justify-center">{{ scanProgress.total || 0 }}</div>
                  <div class="text-xs text-gray-400">{{ getScanTotalLabel() }}</div>
                </div>
              </div>
              
              <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zombie-green"></div>
              </div>
            </div>
            
            <!-- Patience Message -->
            <div class="text-center mb-4">
              <p class="text-sm text-gray-400">This may take time, please be patient.</p>
              <p class="text-xs text-gray-500 mt-1">Analyzing activity across multiple relays...</p>
            </div>
            
            <!-- Stop Scan Button -->
            <div class="text-center">
              <button 
                @click="stopScan" 
                class="btn-danger px-6 py-2"
              >
                Stop Scan
              </button>
            </div>
          </div>
        </div>
        
        <div v-else-if="purging" class="card mb-6 p-8 text-center">
          <h3 class="text-xl mb-4">Purging Zombies...</h3>
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-zombie-green mb-4"></div>
          <p class="text-gray-300">Please wait while we purge the selected zombies.</p>
          <p class="text-gray-400 mt-2">This process requires signing an event with your Nostr extension.</p>
        </div>
        
        <div v-else-if="purgeSuccess" class="card mb-6 p-8 text-center">
          <h3 class="text-xl mb-4 text-zombie-green">Zombies Successfully Purged!</h3>
          <div class="text-6xl mb-4">🎯</div>
          <p class="text-gray-300">{{ lastPurgeResult.removedCount }} zombies have been removed from your follow list.</p>
          <p class="text-gray-400 mt-2">Your new follow count: {{ lastPurgeResult.newFollowCount }}</p>
          <button @click="purgeSuccess = false" class="btn-primary mt-6">
            Continue Hunting
          </button>
        </div>
        
        <div v-else-if="scanComplete && !zombiesFiltered.length" class="card p-8 text-center">
          <h3 class="text-xl mb-4">No Zombies Found</h3>
          <div class="text-6xl mb-4">🧠</div>
          <p class="text-gray-300">
            Great job! No zombies found matching the current threshold.
          </p>
          <p class="text-gray-400 mt-2">
            Try adjusting the zombie age threshold to find more undead follows.
          </p>
        </div>
        
        <div v-else-if="scanComplete">
          <ZombieBatchSelector
            :title="`Zombie Batch (${zombiesFiltered.length} found)`"
            :zombies="zombiesFiltered"
            :loading="scanning"
            @purge="purgeZombies"
            @immunity-granted="handleImmunityGranted"
          />
        </div>
        
        <div v-else class="card p-8 text-center">
          <h3 class="text-xl mb-4">Ready to Hunt?</h3>
          <div class="text-6xl mb-4">🧟</div>
          <p class="text-gray-300">
            Use the controls on the left to scan for dormant follows.
          </p>
          <p class="text-gray-400 mt-2">
            We recommend using smaller batches for safer zombie hunting.
          </p>
          <button 
            @click="scanForZombies" 
            class="btn-primary mt-6"
            :disabled="scanning"
          >
            Start Zombie Scan
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import ZombieStats from '../components/ZombieStats.vue';
import ZombieBatchSelector from '../components/ZombieBatchSelector.vue';
import nostrService from '../services/nostrService';
import zombieService from '../services/zombieService';
import immunityService from '../services/immunityService';
import { nip19 } from 'nostr-tools';

export default {
  name: 'ZombieHuntingView',
  components: {
    ZombieStats,
    ZombieBatchSelector
  },
  data() {
    return {
      loading: true,
      scanning: false,
      scanComplete: false,
      purging: false,
      purgeSuccess: false,
      selectedThreshold: 'all',
      batchSize: 30,
      zombieData: null,
      lastPurgeResult: null,
      scanCancelled: false,
      scanProgress: {
        total: 0,
        processed: 0,
        currentNpub: '',
        stage: 'initializing'
      },
      stats: {
        totalFollows: 0,
        totalZombies: 0,
        zombiesPurged: 0,
        immuneUsers: 0
      },
      zombieStats: {
        total: 0,
        active: 0,
        fresh: 0,
        rotting: 0,
        ancient: 0
      }
    };
  },
  computed: {
    zombieStatsReady() {
      return this.zombieStats.total > 0;
    },
    zombiesFiltered() {
      if (!this.zombieData) return [];
      
      const { burned, fresh, rotting, ancient } = this.zombieData;
      const burnedZombies = burned || [];
      let zombies = [];
      
      if (this.selectedThreshold === 'all') {
        zombies = [
          ...burnedZombies.map(zombie => ({ ...zombie, type: 'burned' })), // Always include burned zombies first
          ...ancient.map(zombie => ({ ...zombie, type: 'ancient' })),
          ...rotting.map(zombie => ({ ...zombie, type: 'rotting' })),
          ...fresh.map(zombie => ({ ...zombie, type: 'fresh' }))
        ];
      } else if (this.selectedThreshold === '365') {
        zombies = [
          ...burnedZombies.map(zombie => ({ ...zombie, type: 'burned' })), // Always include burned zombies
          ...ancient.map(zombie => ({ ...zombie, type: 'ancient' }))
        ];
      } else if (this.selectedThreshold === '180') {
        zombies = [
          ...burnedZombies.map(zombie => ({ ...zombie, type: 'burned' })), // Always include burned zombies
          ...rotting.map(zombie => ({ ...zombie, type: 'rotting' }))
        ];
      } else if (this.selectedThreshold === '90') {
        zombies = [
          ...burnedZombies.map(zombie => ({ ...zombie, type: 'burned' })), // Always include burned zombies
          ...fresh.map(zombie => ({ ...zombie, type: 'fresh' }))
        ];
      }
      
      // Debug: log zombie filtering process
      if (zombies.length > 0) {
        console.log(`🎯 zombiesFiltered: ${zombies.length} zombies after filtering by threshold '${this.selectedThreshold}'`);
        
        // Check for our problematic users
        const debugPrefixes = ['d4338b7c', '8c7c6312', '2e5c7e3'];
        for (const zombie of zombies) {
          for (const prefix of debugPrefixes) {
            if (zombie.pubkey?.startsWith(prefix)) {
              console.log(`🎯 Debug user ${zombie.pubkey.substring(0, 8)}... in filtered zombies:`, zombie);
            }
          }
        }
      }
      
      return zombies;
    }
  },
  methods: {
    async loadInitialData() {
      this.loading = true;
      
      try {
        // Initialize immunity service
        await immunityService.init();
        
        // Get immune users count
        this.stats.immuneUsers = immunityService.getImmunePubkeys().length;
        
        // Get zombie statistics
        const scanResults = await zombieService.getLatestScanResults();
        
        if (scanResults) {
          this.zombieData = scanResults.data;
          this.scanComplete = true;
          
          const { active, burned, fresh, rotting, ancient } = scanResults.data;
          const burnedLength = burned?.length || 0;
          const total = active.length + burnedLength + fresh.length + rotting.length + ancient.length;
          
          this.zombieStats = {
            total,
            active: active.length,
            burned: burnedLength,
            fresh: fresh.length,
            rotting: rotting.length,
            ancient: ancient.length
          };
          
          this.stats.totalFollows = total;
          this.stats.totalZombies = burnedLength + fresh.length + rotting.length + ancient.length;
        }
        
        // Get purge history
        const purgeHistory = await zombieService.getPurgeHistory();
        this.stats.zombiesPurged = purgeHistory.reduce((total, record) => total + record.count, 0);
        
        // Set batch size from zombie service
        this.batchSize = zombieService.batchSize;
      } catch (error) {
        console.error('Failed to load initial data:', error);
      } finally {
        this.loading = false;
      }
    },
    async scanForZombies() {
      this.scanning = true;
      this.scanComplete = false;
      this.scanCancelled = false;
      
      // Reset progress
      this.scanProgress = {
        total: 0,
        processed: 0,
        currentNpub: '',
        stage: 'Initializing scan...'
      };
      
      try {
        // Update batch size in the service
        zombieService.setBatchSize(this.batchSize);
        
        // Perform the scan with progress callback
        const result = await zombieService.scanForZombies(true, (progress) => {
          // Check if scan was cancelled
          if (this.scanCancelled) {
            throw new Error('Scan cancelled by user');
          }
          
          this.scanProgress = {
            ...this.scanProgress,
            ...progress
          };
        });
        
        if (result.success && !this.scanCancelled) {
          this.zombieData = result.zombieData;
          this.scanComplete = true;
          
          this.zombieStats = {
            total: result.totalFollows,
            active: result.zombieData.active.length,
            burned: result.zombieData.burned?.length || 0,
            fresh: result.zombieData.fresh.length,
            rotting: result.zombieData.rotting.length,
            ancient: result.zombieData.ancient.length
          };
          
          this.stats.totalFollows = result.totalFollows;
          this.stats.totalZombies = this.zombieStats.burned + this.zombieStats.fresh + this.zombieStats.rotting + this.zombieStats.ancient;
          this.stats.immuneUsers = result.immuneCount || 0;
        } else if (!this.scanCancelled) {
          alert(`Failed to scan for zombies: ${result.message}`);
        }
      } catch (error) {
        if (error.message === 'Scan cancelled by user') {
          console.log('Scan cancelled by user');
        } else {
          console.error('Failed to scan for zombies:', error);
          alert('Failed to scan for zombies. See console for details.');
        }
      } finally {
        this.scanning = false;
      }
    },
    stopScan() {
      this.scanCancelled = true;
      this.scanning = false;
      console.log('Zombie scan stopped by user');
    },
    getScanProgressLabel() {
      const stage = this.scanProgress.stage || '';
      
      if (stage.includes('Aggressive retry') || stage.includes('deeper search')) {
        return 'Users Retried';
      } else if (stage.includes('Fallback scan') || stage.includes('unknown activity')) {
        return 'Users Retried';
      } else {
        return 'Users Processed';
      }
    },
    getScanTotalLabel() {
      const stage = this.scanProgress.stage || '';
      
      if (stage.includes('Aggressive retry') || stage.includes('deeper search')) {
        return 'Retry Queue';
      } else if (stage.includes('Fallback scan') || stage.includes('unknown activity')) {
        return 'Retry Queue';
      } else {
        return 'Total Follows';
      }
    },
    updateThreshold() {
      // No need to do anything here, the computed property will handle filtering
      console.log('Threshold updated to:', this.selectedThreshold);
    },
    async purgeZombies(selectedPubkeys) {
      if (!selectedPubkeys || selectedPubkeys.length === 0) {
        alert('No zombies selected for purging');
        return;
      }
      
      if (!confirm(`Are you sure you want to purge ${selectedPubkeys.length} zombies from your follow list?`)) {
        return;
      }
      
      this.purging = true;
      
      try {
        const result = await zombieService.unfollowZombieBatch(selectedPubkeys);
        
        if (result.success) {
          this.lastPurgeResult = result;
          this.purgeSuccess = true;
          
          // Update stats
          this.stats.zombiesPurged += result.removedCount;
          
          // Clear current zombie data instead of auto-scanning
          this.zombieData = null;
          this.scanComplete = false;
        } else {
          alert(`Failed to purge zombies: ${result.message}`);
        }
      } catch (error) {
        console.error('Failed to purge zombies:', error);
        alert('Failed to purge zombies. See console for details.');
      } finally {
        this.purging = false;
      }
    },
    handleImmunityGranted(pubkey) {
      // Remove the zombie from the current list
      if (this.zombieData) {
        ['fresh', 'rotting', 'ancient'].forEach(type => {
          const index = this.zombieData[type].findIndex(z => z.pubkey === pubkey);
          if (index > -1) {
            this.zombieData[type].splice(index, 1);
            this.zombieStats[type]--;
            this.stats.totalZombies--;
          }
        });
      }
      
      // Update immune users count
      this.stats.immuneUsers++;
    },
    async viewImmuneUsers() {
      try {
        const immuneRecords = await immunityService.getAllImmunityRecords();
        
        if (immuneRecords.length === 0) {
          alert('No immune users found.');
          return;
        }
        
        // Create a formatted list for display
        const immuneList = immuneRecords.map(record => {
          const npub = record.pubkey ? nip19.npubEncode(record.pubkey).substring(0, 16) + '...' : 'Invalid';
          const date = record.timestamp ? new Date(record.timestamp).toLocaleDateString() : 'Unknown';
          return `• ${npub} - ${record.reason} (${date})`;
        }).join('\n');
        
        alert(`Immune Users (${immuneRecords.length}):\n\n${immuneList}`);
      } catch (error) {
        console.error('Failed to view immune users:', error);
        alert('Failed to load immune users. See console for details.');
      }
    },
    async resetImmunity() {
      const count = this.stats.immuneUsers;
      
      if (count === 0) {
        alert('No immune users to reset.');
        return;
      }
      
      const confirmed = confirm(`Are you sure you want to reset immunity for all ${count} users?\n\nThis will remove all immunity records and they may appear as zombies in future scans.`);
      
      if (!confirmed) {
        return;
      }
      
      try {
        const result = await immunityService.resetAllImmunity();
        
        if (result.success) {
          this.stats.immuneUsers = 0;
          alert(`Successfully reset immunity for ${result.clearedCount} users.`);
        } else {
          alert('Failed to reset immunity.');
        }
      } catch (error) {
        console.error('Failed to reset immunity:', error);
        alert('Failed to reset immunity. See console for details.');
      }
    }
  },
  mounted() {
    this.loadInitialData();
  }
};
</script>