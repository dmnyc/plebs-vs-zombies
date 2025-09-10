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
                <option value="burned">Burned Zombies (deleted accounts)</option>
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
                  <span class="text-gray-400">Processing: </span>
                  <span class="font-mono text-xs sm:text-sm">{{ formatPubkeyForProgress(scanProgress.currentNpub) }}</span>
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
            
            <!-- Easter Egg / Patience Message -->
            <div class="text-center mb-4">
              <p class="text-sm text-gray-400">{{ currentEasterEgg || 'This may take time, please be patient.' }}</p>
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
            :batchSize="batchSize"
            @purge="purgeZombies"
            @confirm-purge="handleConfirmPurge"
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

    <!-- Zombie Purge Celebration Modal -->
    <ZombiePurgeCelebration
      v-if="showCelebration && lastPurgeResult && prePurgeStats"
      :purgeResult="lastPurgeResult"
      :zombieScore="prePurgeStats.zombieScore"
      :purgeStats="purgeTypeBreakdown"
      @close="closeCelebration"
    />

    <!-- Confirmation Modal -->
    <ConfirmModal
      :show="confirmModal.show"
      :title="confirmModal.title"
      :message="confirmModal.message"
      :type="confirmModal.type"
      :confirmText="confirmModal.confirmText"
      :cancelText="confirmModal.cancelText"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />

    <!-- Alert Modal -->
    <ConfirmModal
      :show="alertModal.show"
      :title="alertModal.title"
      :message="alertModal.message"
      :type="alertModal.type"
      confirmText="OK"
      cancelText=""
      @confirm="closeAlert"
      @cancel="closeAlert"
    />
  </div>
</template>

<script>
import ZombieStats from '../components/ZombieStats.vue';
import ZombieBatchSelector from '../components/ZombieBatchSelector.vue';
import ZombiePurgeCelebration from '../components/ZombiePurgeCelebration.vue';
import ConfirmModal from '../components/ConfirmModal.vue';
import nostrService from '../services/nostrService';
import zombieService from '../services/zombieService';
import immunityService from '../services/immunityService';
import backupService from '../services/backupService';
import easterEggData from '../data/easterEggs.js';
import { nip19 } from 'nostr-tools';

export default {
  name: 'ZombieHuntingView',
  components: {
    ZombieStats,
    ZombieBatchSelector,
    ZombiePurgeCelebration,
    ConfirmModal
  },
  data() {
    return {
      loading: true,
      scanning: false,
      scanComplete: false,
      purging: false,
      purgeSuccess: false,
      showCelebration: false,
      selectedThreshold: 'all',
      batchSize: 30,
      zombieData: null,
      lastPurgeResult: null,
      prePurgeStats: null,
      purgeTypeBreakdown: null,
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
      },
      currentEasterEgg: '',
      
      // Easter egg arrays - loaded from external JSON file
      firstPassEasterEggs: [],
      phase2EasterEggs: [],
      zombieEasterEggs: [],
      lastEasterEggIndex: -1,
      confirmModal: {
        show: false,
        title: '',
        message: '',
        type: 'warning',
        confirmText: 'OK',
        cancelText: 'Cancel',
        resolve: null
      },
      alertModal: {
        show: false,
        title: '',
        message: '',
        type: 'info'
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
      
      if (this.selectedThreshold === 'burned') {
        // Only show burned zombies (deleted accounts) - no date threshold
        zombies = burnedZombies.map(zombie => ({ ...zombie, type: 'burned' }));
      } else if (this.selectedThreshold === 'all') {
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
    // Easter Egg Methods
    
    updateEasterEgg() {
      const currentStage = this.scanProgress.stage || '';
      const processedCount = this.scanProgress.processed || 0;
      
      // Determine which phase we're in and use appropriate messages
      let messages = [];
      let threshold = 0;
      let interval = 0;
      
      // Zombie scan phase (final phase)
      if (currentStage.includes('Found') && (currentStage.includes('zombie') || currentStage.includes('burned') || currentStage.includes('ancient') || currentStage.includes('rotting') || currentStage.includes('fresh')) || currentStage.includes('Analyzing user activity') || currentStage.includes('Classifying zombie')) {
        messages = this.zombieEasterEggs;
        threshold = 50;
        interval = 50;
      }
      // Smart retry / enhanced verification phase
      else if (currentStage.includes('Smart retry') || currentStage.includes('Enhanced verification') || currentStage.includes('AGGRESSIVE RETRY')) {
        messages = this.zombieEasterEggs;
        threshold = 50;
        interval = 50;
      }
      // Batch scanning phase
      else if (currentStage.includes('Scanning batch') || currentStage.includes('Completed batch')) {
        messages = this.phase2EasterEggs;
        threshold = 200;
        interval = 200;
      }
      // First pass phases
      else if (currentStage.includes('Initial activity') || currentStage.includes('Fetching relay lists') || currentStage.includes('Fetching activity data')) {
        messages = this.firstPassEasterEggs;
        threshold = 300;
        interval = 300;
      }
      // Default to phase2 for any unrecognized stage
      else {
        messages = this.phase2EasterEggs;
        threshold = 200;
        interval = 200;
      }
      
      
      // Calculate and set the easter egg
      if (processedCount >= threshold && messages.length > 0) {
        const index = Math.floor((processedCount - threshold) / interval);
        if (index < messages.length) {
          this.currentEasterEgg = messages[index];
        } else {
          this.currentEasterEgg = messages[messages.length - 1];
        }
      } else {
        this.currentEasterEgg = '';
      }
    },
    
    // Confirmation Modal Methods
    showConfirm(title, message, type = 'warning', confirmText = 'OK', cancelText = 'Cancel') {
      return new Promise((resolve) => {
        this.confirmModal = {
          show: true,
          title,
          message,
          type,
          confirmText,
          cancelText,
          resolve
        };
      });
    },
    handleConfirm() {
      this.confirmModal.show = false;
      if (this.confirmModal.resolve) {
        this.confirmModal.resolve(true);
      }
    },
    handleCancel() {
      this.confirmModal.show = false;
      if (this.confirmModal.resolve) {
        this.confirmModal.resolve(false);
      }
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
    async handleConfirmPurge(confirmData) {
      const confirmed = await this.showConfirm(
        confirmData.title,
        confirmData.message,
        confirmData.type,
        confirmData.confirmText,
        confirmData.cancelText
      );
      
      if (confirmed) {
        this.purgeZombies(confirmData.zombies);
      }
    },

    formatPubkeyForProgress(pubkey) {
      if (!pubkey) return '';
      if (pubkey.length <= 16) return pubkey;
      return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8);
    },
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
      this.currentEasterEgg = '';
      
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
        
        // Get settings from localStorage
        const autoBackupSetting = localStorage.getItem('autoBackupOnScan');
        const shouldCreateBackup = autoBackupSetting !== null ? JSON.parse(autoBackupSetting) : true;
        
        const enhancedScanningSetting = localStorage.getItem('useEnhancedScanning');
        const useEnhancedScanning = enhancedScanningSetting !== null ? JSON.parse(enhancedScanningSetting) : false;
        
        // Choose scanning method based on user preference
        const scanMethod = useEnhancedScanning ? 'scanForZombiesEnhanced' : 'scanForZombies';
        console.log(`🔍 Using ${useEnhancedScanning ? 'Enhanced' : 'Standard'} zombie scanning method`);
        
        // Perform the scan with progress callback
        const result = await zombieService[scanMethod](true, (progress) => {
          // Check if scan was cancelled
          if (this.scanCancelled) {
            throw new Error('Scan cancelled by user');
          }
          
          this.scanProgress = {
            ...this.scanProgress,
            ...progress
          };
          
          // Update easter egg
          this.updateEasterEgg();
        }, shouldCreateBackup);
        
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
          this.showAlert('Scan Failed', `Failed to scan for zombies: ${result.message}`, 'error');
        }
      } catch (error) {
        if (error.message === 'Scan cancelled by user') {
          console.log('Scan cancelled by user');
        } else {
          console.error('Failed to scan for zombies:', error);
          this.showAlert('Scan Failed', 'Failed to scan for zombies. See console for details.', 'error');
        }
      } finally {
        this.currentEasterEgg = '';
        this.scanning = false;
      }
    },
    stopScan() {
      this.scanCancelled = true;
      this.scanning = false;
      this.resetEasterEggs();
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
        this.showAlert('No Selection', 'No zombies selected for purging', 'warning');
        return;
      }
      
      // Check if user has recent backups and prompt if not
      const shouldProceed = await this.checkBackupBeforePurge(selectedPubkeys.length);
      if (!shouldProceed) {
        return;
      }

      // Capture stats before purging for celebration
      this.capturePrePurgeStats(selectedPubkeys);
      
      this.purging = true;
      
      try {
        const result = await zombieService.unfollowZombieBatch(selectedPubkeys);
        
        if (result.success) {
          this.lastPurgeResult = result;
          
          // Update stats
          this.stats.zombiesPurged += result.removedCount;
          
          // Show celebration modal instead of simple success message
          this.showCelebration = true;
          
          // Remove purged zombies from current data instead of clearing everything
          this.updateZombieDataAfterPurge(result.removedPubkeys);
        } else {
          this.showAlert('Purge Failed', `Failed to purge zombies: ${result.message}`, 'error');
        }
      } catch (error) {
        console.error('Failed to purge zombies:', error);
        
        // Provide specific error messages based on the error type
        let errorMessage = 'Failed to purge zombies.';
        
        if (error.message.includes('timeout')) {
          errorMessage = 'Signing request timed out. Please check your Nostr extension and try again with a smaller batch of zombies.';
        } else if (error.message.includes('rejected')) {
          errorMessage = 'Signing was rejected. Please approve the signing request in your Nostr extension to update your follow list.';
        } else if (error.message.includes('too large') || error.message.includes('smaller batches')) {
          errorMessage = 'Your follow list is too large for this operation. Please try unfollowing fewer zombies at a time (try 10-15 instead of ' + selectedPubkeys.length + ').';
        } else if (error.message.includes('extension')) {
          errorMessage = 'Nostr extension issue: ' + error.message;
        } else if (error.message.includes('permission') || error.message.includes('authorized')) {
          errorMessage = 'Extension permissions not granted. Please check your Nostr extension settings for this site.';
        } else {
          errorMessage = error.message || 'Unknown error occurred. Check console for details.';
        }
        
        this.showAlert('Purge Error', errorMessage, 'error');
      } finally {
        this.purging = false;
      }
    },
    handleImmunityGranted(pubkey) {
      // Remove the zombie from the current list
      if (this.zombieData) {
        ['burned', 'fresh', 'rotting', 'ancient'].forEach(type => {
          const zombieArray = this.zombieData[type] || [];
          const index = zombieArray.findIndex(z => z.pubkey === pubkey);
          if (index > -1) {
            zombieArray.splice(index, 1);
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
          this.showAlert('No Immune Users', 'No immune users found.', 'info');
          return;
        }
        
        // Create a formatted list for display
        const immuneList = immuneRecords.map(record => {
          const npub = record.pubkey ? nip19.npubEncode(record.pubkey).substring(0, 16) + '...' : 'Invalid';
          const date = record.timestamp ? new Date(record.timestamp).toLocaleDateString() : 'Unknown';
          return `• ${npub} - ${record.reason} (${date})`;
        }).join('\n');
        
        this.showAlert(
          `Immune Users (${immuneRecords.length})`,
          immuneList,
          'info'
        );
      } catch (error) {
        console.error('Failed to view immune users:', error);
        this.showAlert('Load Failed', 'Failed to load immune users. See console for details.', 'error');
      }
    },
    updateZombieDataAfterPurge(removedPubkeys) {
      if (!this.zombieData || !removedPubkeys || removedPubkeys.length === 0) {
        return;
      }
      
      // Create a Set for faster lookup
      const removedSet = new Set(removedPubkeys);
      
      // Remove purged zombies from each category
      const updatedData = {
        active: this.zombieData.active.filter(z => !removedSet.has(z.pubkey || z)),
        burned: this.zombieData.burned ? this.zombieData.burned.filter(z => !removedSet.has(z.pubkey || z)) : [],
        fresh: this.zombieData.fresh.filter(z => !removedSet.has(z.pubkey || z)),
        rotting: this.zombieData.rotting.filter(z => !removedSet.has(z.pubkey || z)),
        ancient: this.zombieData.ancient.filter(z => !removedSet.has(z.pubkey || z))
      };
      
      // Update zombie data
      this.zombieData = updatedData;
      
      // Clear any selections for the purged zombies
      this.selectedZombies = this.selectedZombies.filter(pubkey => !removedSet.has(pubkey));
      
      console.log(`Updated zombie data after purge. Removed ${removedPubkeys.length} zombies from scan results.`);
    },
    async resetImmunity() {
      const count = this.stats.immuneUsers;
      
      if (count === 0) {
        this.showAlert('No Immune Users', 'No immune users to reset.', 'info');
        return;
      }
      
      const confirmed = await this.showConfirm(
        'Reset Immunity',
        `Are you sure you want to reset immunity for all ${count} users?\n\nThis will remove all immunity records and they may appear as zombies in future scans.`,
        'warning',
        'Reset All',
        'Cancel'
      );
      
      if (!confirmed) {
        return;
      }
      
      try {
        const result = await immunityService.resetAllImmunity();
        
        if (result.success) {
          this.stats.immuneUsers = 0;
          this.showAlert('Reset Complete', `Successfully reset immunity for ${result.clearedCount} users.`, 'success');
        } else {
          this.showAlert('Reset Failed', 'Failed to reset immunity.', 'error');
        }
      } catch (error) {
        console.error('Failed to reset immunity:', error);
        this.showAlert('Reset Error', 'Failed to reset immunity. See console for details.', 'error');
      }
    },
    capturePrePurgeStats(selectedPubkeys) {
      if (!this.zombieData) return;
      
      // Calculate current Zombie Score (percentage of zombies in follow list)
      const { active, burned, fresh, rotting, ancient } = this.zombieData;
      const burnedLength = burned?.length || 0;
      const totalFollows = active.length + burnedLength + fresh.length + rotting.length + ancient.length;
      const totalZombies = burnedLength + fresh.length + rotting.length + ancient.length;
      const zombieScore = totalFollows > 0 ? Math.round((totalZombies / totalFollows) * 100) : 0;
      
      this.prePurgeStats = {
        totalFollows,
        totalZombies,
        zombieScore,
        activeCount: active.length,
        burnedCount: burnedLength,
        freshCount: fresh.length,
        rottingCount: rotting.length,
        ancientCount: ancient.length
      };
      
      // Analyze the breakdown of selected zombies by type
      const breakdown = { burned: 0, fresh: 0, rotting: 0, ancient: 0 };
      
      // Find which zombies are being purged by matching pubkeys
      const allZombies = [
        ...(burned || []).map(z => ({ ...z, type: 'burned' })),
        ...fresh.map(z => ({ ...z, type: 'fresh' })),
        ...rotting.map(z => ({ ...z, type: 'rotting' })),
        ...ancient.map(z => ({ ...z, type: 'ancient' }))
      ];
      
      selectedPubkeys.forEach(pubkey => {
        const zombie = allZombies.find(z => z.pubkey === pubkey);
        if (zombie) {
          breakdown[zombie.type]++;
        }
      });
      
      this.purgeTypeBreakdown = breakdown;
      
      console.log('Pre-purge stats captured:', {
        zombieScore,
        totalFollows,
        breakdown
      });
    },
    closeCelebration() {
      this.showCelebration = false;
      this.purgeSuccess = false;
    },
    async checkBackupBeforePurge(zombieCount) {
      try {
        // Get user's backups
        const backups = await backupService.getBackups();
        
        // Check if user has any backups
        if (backups.length === 0) {
          const shouldContinue = await this.showConfirm(
            'No Backups Found!',
            `You're about to purge ${zombieCount} ${zombieCount === 1 ? 'zombie' : 'zombies'} from your follow list.\n\nWe strongly recommend creating a backup first to protect your follows.\n\nWould you like to go to the Backups page to create one now?`,
            'warning',
            'Go to Backups',
            'Proceed Without Backup'
          );
          
          if (shouldContinue) {
            // Navigate to backups page
            this.$parent.setActiveView('backups');
            return false;
          }
          
          // User chose to proceed without backup - final confirmation
          return await this.showConfirm(
            'Final Warning!',
            `You're proceeding without a backup. If you accidentally purge someone important, you won't be able to easily restore them.\n\nAre you absolutely sure you want to purge ${zombieCount} ${zombieCount === 1 ? 'zombie' : 'zombies'}?`,
            'error',
            'Purge Anyway',
            'Cancel'
          );
        }
        
        // Check if user has a recent backup (within last 7 days)
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const recentBackup = backups.find(backup => backup.createdAt > oneWeekAgo);
        
        if (!recentBackup) {
          const shouldContinue = await this.showConfirm(
            'Backup Recommendation',
            `Your last backup is older than 7 days.\n\nYou're about to purge ${zombieCount} ${zombieCount === 1 ? 'zombie' : 'zombies'} from your follow list.\n\nWould you like to create a fresh backup first?`,
            'warning',
            'Go to Backups',
            'Proceed Anyway'
          );
          
          if (shouldContinue) {
            // Navigate to backups page  
            this.$parent.setActiveView('backups');
            return false;
          }
        }
        
        // User has recent backup or chose to proceed - final confirmation
        return await this.showConfirm(
          'Confirm Purge',
          `Are you sure you want to purge ${zombieCount} ${zombieCount === 1 ? 'zombie' : 'zombies'} from your follow list?`,
          'warning',
          'Purge Zombies',
          'Cancel'
        );
        
      } catch (error) {
        console.error('Error checking backups:', error);
        
        // If there's an error checking backups, still ask for confirmation
        return await this.showConfirm(
          'Confirm Purge (No Backup Check)',
          `Unable to check backup status.\n\nAre you sure you want to purge ${zombieCount} ${zombieCount === 1 ? 'zombie' : 'zombies'} from your follow list?\n\nWe recommend creating a backup first in the Backups page.`,
          'warning',
          'Purge Anyway',
          'Cancel'
        );
      }
    }
  },
  mounted() {
    // Load easter egg messages from external file
    this.firstPassEasterEggs = easterEggData.firstPass;
    this.phase2EasterEggs = easterEggData.phase2;
    this.zombieEasterEggs = easterEggData.zombie;
    
    this.loadInitialData();
  }
};
</script>