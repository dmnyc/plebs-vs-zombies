<template>
  <div>
    <h2 class="text-2xl mb-6">Dashboard</h2>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div class="card">
        <h3 class="text-xl mb-4">Follow List Overview</h3>
        <div v-if="loading" class="text-center py-4">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zombie-green"></div>
          <p class="mt-2 text-gray-400">Loading follow data...</p>
        </div>
        <div v-else>
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-gray-300">Total follows:</span>
              <span class="font-bold">{{ followStats.total || 0 }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-300">Immune users:</span>
              <span class="font-bold text-green-400">🛡️ {{ followStats.immune || 0 }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-300">Last scan:</span>
              <span v-if="lastScanDate" class="font-bold">{{ formatDate(lastScanDate) }}</span>
              <span v-else class="text-gray-400">Never</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-300">Zombie Score:</span>
              <span 
                class="font-bold"
                :class="{
                  'text-green-500': zombieScore < 20,
                  'text-yellow-400': zombieScore >= 20 && zombieScore < 50,
                  'text-orange-500': zombieScore >= 50 && zombieScore < 80,
                  'text-red-500': zombieScore >= 80
                }"
              >
                {{ zombieScore }}%
              </span>
            </div>
          </div>
          
          <div class="mt-6">
            <button @click="scanForZombies" class="btn-primary w-full" :disabled="scanning">
              {{ scanning ? 'Scanning...' : 'Scan for Zombies' }}
            </button>
            
            <!-- Real-time Progress Feedback (matching Hunt Zombies page) -->
            <div v-if="scanning" class="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-600 h-32">
              <div class="flex flex-col h-full justify-between">
                <div class="flex justify-between items-center">
                  <span class="text-sm font-medium text-gray-300 truncate">{{ scanProgress.stage || 'Initializing...' }}</span>
                  <span class="text-xs text-gray-400 flex-shrink-0 ml-2">{{ scanProgress.processed || 0 }} / {{ scanProgress.total || 0 }}</span>
                </div>
                
                <!-- Progress Bar -->
                <div class="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    class="bg-zombie-green h-2 rounded-full transition-all duration-300"
                    :style="{ width: scanProgress.total > 0 ? (scanProgress.processed / scanProgress.total * 100) + '%' : '0%' }"
                  ></div>
                </div>
                
                <!-- Current Processing Info -->
                <div class="text-xs text-gray-400 font-mono break-all h-4 flex items-center">
                  <span v-if="scanProgress.currentNpub">
                    <span class="text-gray-400">Processing: </span>
                    <span class="font-mono text-xs">{{ formatPubkeyForProgress(scanProgress.currentNpub) }}</span>
                  </span>
                  <span v-else>&nbsp;</span>
                </div>
                
                <!-- Live Stats -->
                <div class="flex justify-between text-sm">
                  <div>
                    <span class="text-blue-400 font-bold">{{ scanProgress.processed || 0 }}</span>
                    <span class="text-gray-400"> users processed</span>
                  </div>
                  <div>
                    <span class="text-gray-400 font-bold">{{ scanProgress.total || 0 }}</span>
                    <span class="text-gray-400"> total follows</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Stop Scan Button -->
            <button 
              v-if="scanning"
              @click="stopScan" 
              class="btn-danger w-full mt-2"
            >
              Stop Scan
            </button>
            
            <!-- Easter Egg / Patience Message -->
            <div v-if="scanning" class="text-center mt-3">
              <p class="text-sm text-gray-400">{{ currentEasterEgg || 'This may take time, please be patient.' }}</p>
            </div>
          </div>
        </div>
      </div>
      
      <ZombieStats
        v-if="zombieStatsReady"
        title="Zombie Statistics"
        :stats="zombieStats"
      >
        <div class="mt-6">
          <button @click="goToZombieHunting" class="btn-danger w-full">
            Start Zombie Hunt
          </button>
        </div>
      </ZombieStats>
      
      <div class="card">
        <h3 class="text-xl mb-4">Hunt Status</h3>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-gray-300">Zombies purged:</span>
            <span class="font-bold text-zombie-green">{{ huntStats.totalPurged || 0 }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-300">Purge events:</span>
            <span class="font-bold">{{ huntStats.purgeEvents || 0 }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-300">Bandwidth saved:</span>
            <span class="font-bold text-pleb-blue">{{ formatBytes(huntStats.estimatedBandwidthSaved || 0) }}</span>
          </div>
        </div>
        <div class="mt-6 space-y-2">
          <button @click="goToBackups" class="btn-secondary w-full">
            Manage Backups
          </button>
          <button 
            @click="resetImmunity" 
            class="btn-danger w-full text-sm"
            :disabled="followStats.immune === 0"
          >
            Reset Immunity ({{ followStats.immune }})
          </button>
        </div>
      </div>
    </div>
    
    <div class="mt-8">
      <h3 class="text-xl mb-4">Recent Activity</h3>
      <div class="card">
        <div v-if="recentActivity.length === 0" class="text-center py-4">
          <p class="text-gray-400">No recent activity</p>
        </div>
        <div v-else>
          <ul class="space-y-2">
            <li 
              v-for="(activity, index) in recentActivity" 
              :key="index"
              class="p-3 border border-gray-700 rounded-lg"
            >
              <div class="flex items-center">
                <div 
                  class="w-8 h-8 rounded-full flex items-center justify-center mr-3"
                  :class="{
                    'bg-zombie-green text-zombie-dark': activity.type === 'scan',
                    'bg-red-600': activity.type === 'purge',
                    'bg-pleb-blue': activity.type === 'backup'
                  }"
                >
                  <span v-if="activity.type === 'scan'">🔍</span>
                  <span v-else-if="activity.type === 'purge'">💀</span>
                  <span v-else-if="activity.type === 'backup'">💾</span>
                </div>
                <div>
                  <div class="font-medium">{{ activity.title }}</div>
                  <div class="text-sm text-gray-400">{{ formatDate(activity.timestamp) }}</div>
                </div>
              </div>
              <div v-if="activity.details" class="mt-2 text-sm text-gray-400">
                {{ activity.details }}
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Welcome Modal -->
    <WelcomeModal
      v-if="showWelcomeModal"
      @close="closeWelcomeModal"
      @go-to-backups="handleGoToBackups"
      @skip-backup="handleSkipBackup"
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
import { format } from 'date-fns';
import ZombieStats from '../components/ZombieStats.vue';
import WelcomeModal from '../components/WelcomeModal.vue';
import ConfirmModal from '../components/ConfirmModal.vue';
import nostrService from '../services/nostrService';
import zombieService from '../services/zombieService';
import immunityService from '../services/immunityService';
import backupService from '../services/backupService';
import easterEggData from '../data/easterEggs.js';

export default {
  name: 'DashboardView',
  components: {
    ZombieStats,
    WelcomeModal,
    ConfirmModal
  },
  data() {
    return {
      loading: true,
      scanning: false,
      scanCancelled: false,
      followStats: {
        total: 0,
        immune: 0,
      },
      zombieStats: {
        total: 0,
        active: 0,
        fresh: 0,
        rotting: 0,
        ancient: 0
      },
      scanProgress: {
        total: 0,
        processed: 0,
        currentNpub: '',
        stage: 'initializing'
      },
      huntStats: {
        totalPurged: 0,
        purgeEvents: 0,
        estimatedBandwidthSaved: 0
      },
      lastScanDate: null,
      recentActivity: [],
      showWelcomeModal: false,
      alertModal: {
        show: false,
        title: '',
        message: '',
        type: 'info'
      },
      currentEasterEgg: '',
      
      // Easter egg arrays - loaded from external JSON file
      firstPassEasterEggs: [],
      phase2EasterEggs: [],
      zombieEasterEggs: [],
      aggressiveEasterEggs: []
    };
  },
  computed: {
    zombieStatsReady() {
      return this.zombieStats.total > 0;
    },
    zombieScore() {
      if (this.zombieStats.total === 0) return 0;
      
      const zombieCount = this.zombieStats.burned + this.zombieStats.fresh + this.zombieStats.rotting + this.zombieStats.ancient;
      return Math.round((zombieCount / this.zombieStats.total) * 100);
    }
  },
  methods: {
    // Simple Easter Egg Methods
    updateEasterEgg() {
      const currentStage = this.scanProgress.stage || '';
      const processedCount = this.scanProgress.processed || 0;
      
      console.log(`DEBUG: processed=${processedCount}, stage="${currentStage}"`);
      
      // Debug: Log stage and processed count
      if (processedCount >= 300) {
        console.log(`DEBUG Easter Egg: processed=${processedCount}, stage="${currentStage}"`);
      }
      
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
      else if (currentStage.includes('Smart retry') || currentStage.includes('Enhanced verification')) {
        messages = this.aggressiveEasterEggs;
        threshold = 50;
        interval = 80;
      }
      // Aggressive retry phase
      else if (currentStage.includes('Aggressive retry')) {
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
    
    // Alert Modal Methods
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
    formatDate(timestamp) {
      if (!timestamp) return '';
      return format(new Date(timestamp), 'MMM d, yyyy, HH:mm');
    },
    formatPubkeyForProgress(pubkey) {
      if (!pubkey) return '';
      if (pubkey.length <= 16) return pubkey;
      return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8);
    },
    formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    async loadDashboardData() {
      this.loading = true;
      
      try {
        // Initialize immunity service
        await immunityService.init();
        
        // Get follow list and immune count
        const followList = await nostrService.getFollowList();
        this.followStats.total = followList.length;
        this.followStats.immune = immunityService.getImmunePubkeys().length;
        
        // Get zombie statistics
        const scanResults = await zombieService.getLatestScanResults();
        if (scanResults) {
          this.lastScanDate = scanResults.timestamp;
          
          const { data } = scanResults;
          this.zombieStats = {
            total: data.active.length + (data.burned?.length || 0) + data.fresh.length + data.rotting.length + data.ancient.length,
            active: data.active.length,
            burned: data.burned?.length || 0,
            fresh: data.fresh.length,
            rotting: data.rotting.length,
            ancient: data.ancient.length
          };
        }
        
        // Get hunt statistics
        this.huntStats = await zombieService.getZombieStatistics();
        
        // Load recent activity
        await this.loadRecentActivity();
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        this.loading = false;
      }
    },
    async scanForZombies() {
      this.scanning = true;
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
        // Get settings from localStorage
        const autoBackupSetting = localStorage.getItem('autoBackupOnScan');
        const shouldCreateBackup = autoBackupSetting !== null ? JSON.parse(autoBackupSetting) : true;
        
        const enhancedScanningSetting = localStorage.getItem('useEnhancedScanning');
        const useEnhancedScanning = enhancedScanningSetting !== null ? JSON.parse(enhancedScanningSetting) : false;
        
        // Choose scanning method based on user preference
        const scanMethod = useEnhancedScanning ? 'scanForZombiesEnhanced' : 'scanForZombies';
        console.log(`🔍 Using ${useEnhancedScanning ? 'Enhanced' : 'Standard'} zombie scanning method`);
        
        const result = await zombieService[scanMethod](true, (progress) => {
          console.log('DEBUG: Progress callback called with:', progress);
          // Check if scan was cancelled
          if (this.scanCancelled) {
            throw new Error('Scan cancelled by user');
          }
          
          this.scanProgress = {
            ...this.scanProgress,
            ...progress
          };
          
          console.log('DEBUG: About to call updateEasterEgg');
          // Update easter egg
          this.updateEasterEgg();
        }, shouldCreateBackup);
        
        if (result.success) {
          this.lastScanDate = Date.now();
          
          this.zombieStats = {
            total: result.totalFollows,
            active: result.zombieData.active.length,
            burned: result.zombieData.burned?.length || 0,
            fresh: result.zombieData.fresh.length,
            rotting: result.zombieData.rotting.length,
            ancient: result.zombieData.ancient.length
          };
          
          // Update immune count after scan
          this.followStats.immune = result.immuneCount || 0;
          
          // Add scan activity
          this.addActivity({
            type: 'scan',
            title: 'Zombie Scan Completed',
            timestamp: Date.now(),
            details: `Found ${result.zombieCount} zombies out of ${result.totalFollows} follows`
          });
          
          this.showAlert('Scan Complete', 'Scan completed successfully!', 'success');
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
      this.currentEasterEgg = '';
      console.log('Zombie scan stopped by user');
    },
    async loadRecentActivity() {
      try {
        // Combine scan history, purge history, and backup history
        const scanHistory = await zombieService.getScanHistory();
        const purgeHistory = await zombieService.getPurgeHistory();
        
        const activity = [];
        
        // Add scan activities
        scanHistory.forEach(scan => {
          activity.push({
            type: 'scan',
            title: 'Zombie Scan Completed',
            timestamp: scan.timestamp,
            details: `Found ${scan.freshCount + scan.rottingCount + scan.ancientCount} zombies`
          });
        });
        
        // Add purge activities
        purgeHistory.forEach(purge => {
          activity.push({
            type: 'purge',
            title: 'Zombies Purged',
            timestamp: purge.timestamp,
            details: `Removed ${purge.count} zombie follows`
          });
        });
        
        // Sort by timestamp (newest first)
        activity.sort((a, b) => b.timestamp - a.timestamp);
        
        // Keep only the 10 most recent activities
        this.recentActivity = activity.slice(0, 10);
      } catch (error) {
        console.error('Failed to load recent activity:', error);
      }
    },
    addActivity(activity) {
      this.recentActivity.unshift(activity);
      
      // Keep only the 10 most recent activities
      if (this.recentActivity.length > 10) {
        this.recentActivity = this.recentActivity.slice(0, 10);
      }
    },
    goToZombieHunting() {
      this.$parent.setActiveView('hunting');
    },
    goToBackups() {
      this.$parent.setActiveView('backups');
    },
    async resetImmunity() {
      const count = this.followStats.immune;
      
      if (count === 0) {
        this.showAlert('No Immune Users', 'No immune users to reset.', 'info');
        return;
      }
      
      const confirmed = confirm(`Are you sure you want to reset immunity for all ${count} users?\n\nThis will remove all immunity records and they may appear as zombies in future scans.`);
      
      if (!confirmed) {
        return;
      }
      
      try {
        const result = await immunityService.resetAllImmunity();
        
        if (result.success) {
          this.followStats.immune = 0;
          
          // Add reset activity
          this.addActivity({
            type: 'purge',
            title: 'Immunity Reset',
            timestamp: Date.now(),
            details: `Reset immunity for ${result.clearedCount} users`
          });
          
          this.showAlert('Reset Complete', `Successfully reset immunity for ${result.clearedCount} users.`, 'success');
        } else {
          this.showAlert('Reset Failed', 'Failed to reset immunity.', 'error');
        }
      } catch (error) {
        console.error('Failed to reset immunity:', error);
        this.showAlert('Reset Error', 'Failed to reset immunity. See console for details.', 'error');
      }
    },
    async checkFirstTimeUser() {
      try {
        // Check if user has seen welcome modal
        const welcomeSeen = localStorage.getItem('pvz-welcome-seen');
        
        if (!welcomeSeen) {
          // Check if user has any backups or scan history
          const backups = await backupService.getBackups();
          const scanHistory = await zombieService.getScanHistory();
          
          // If no backups and no scan history, show welcome modal
          if (backups.length === 0 && scanHistory.length === 0) {
            this.showWelcomeModal = true;
            return;
          }
        }
        
        this.showWelcomeModal = false;
      } catch (error) {
        console.error('Error checking first-time user status:', error);
        this.showWelcomeModal = false;
      }
    },
    closeWelcomeModal() {
      localStorage.setItem('pvz-welcome-seen', 'true');
      this.showWelcomeModal = false;
    },
    handleGoToBackups() {
      localStorage.setItem('pvz-welcome-seen', 'true');
      this.showWelcomeModal = false;
      this.$parent.setActiveView('backups');
    },
    handleSkipBackup() {
      this.showWelcomeModal = false;
      // Skip backup logic is handled in the modal component
    }
  },
  async mounted() {
    // Load easter egg messages from external file
    this.firstPassEasterEggs = easterEggData.firstPass;
    this.phase2EasterEggs = easterEggData.phase2;
    this.zombieEasterEggs = easterEggData.zombie;
    this.aggressiveEasterEggs = easterEggData.aggressive;
    
    // Check if first-time user before loading dashboard data
    await this.checkFirstTimeUser();
    await this.loadDashboardData();
  }
};
</script>