<template>
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="p-6 border-b border-gray-700">
        <div class="flex items-center justify-between">
          <h2 v-if="isNuclearPurge" class="text-2xl font-bold text-yellow-400 flex items-center gap-2">
            ☢️ NUCLEAR STRIKE COMPLETE! 
          </h2>
          <h2 v-else class="text-2xl font-bold text-zombie-green flex items-center gap-2">
            🎉 Zombie Purge Complete! 
          </h2>
          <button 
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>
      </div>

      <!-- Purge Stats -->
      <div class="p-6 space-y-4">
        <!-- Victory Message -->
        <div class="text-center space-y-2">
          <div v-if="isNuclearPurge" class="text-4xl">☢️</div>
          <div v-else class="text-4xl">🔪🧟‍♂️🧟‍♀️</div>
          
          <h3 v-if="isNuclearPurge" class="text-xl font-bold text-gray-100">
            💀 MAXIMUM CARNAGE ACHIEVED! 💀
          </h3>
          <h3 v-else class="text-xl font-bold text-gray-100">
            Successfully purged {{ totalPurged }} {{ totalPurged === 1 ? 'zombie' : 'zombies' }}!
          </h3>
          
          <p v-if="isNuclearPurge" class="text-yellow-300">
            🚨 Collateral damage assessment: COMPLETE ANNIHILATION 🚨
          </p>
          <p v-else class="text-gray-400">
            Your follow list is now cleaner and more efficient
          </p>
        </div>

        <!-- Detailed Stats -->
        <div class="bg-gray-900 rounded-lg p-4">
          <h4 class="text-lg font-semibold mb-3 text-gray-200">Purge Breakdown:</h4>
          <div class="space-y-2 text-sm">
            <div v-if="purgeStats.burned > 0" class="flex justify-between items-center">
              <span class="text-red-300">🔥 Burned (deleted):</span>
              <span class="font-bold text-lg">{{ purgeStats.burned }}</span>
            </div>
            <div v-if="purgeStats.ancient > 0" class="flex justify-between items-center">
              <span class="text-red-500">💀 Ancient (365+ days):</span>
              <span class="font-bold text-lg">{{ purgeStats.ancient }}</span>
            </div>
            <div v-if="purgeStats.rotting > 0" class="flex justify-between items-center">
              <span class="text-orange-500">🧟‍♂️ Rotting (180+ days):</span>
              <span class="font-bold text-lg">{{ purgeStats.rotting }}</span>
            </div>
            <div v-if="purgeStats.fresh > 0" class="flex justify-between items-center">
              <span class="text-yellow-400">🧟‍♀️ Fresh (90+ days):</span>
              <span class="font-bold text-lg">{{ purgeStats.fresh }}</span>
            </div>
          </div>
          
          <!-- Zombie Score -->
          <div class="mt-4 pt-4 border-t border-gray-700">
            <div class="flex justify-between items-center mb-2">
              <span class="text-gray-300">Zombie Score:</span>
              <span class="text-lg font-bold text-zombie-green">{{ zombieScore }}%</span>
            </div>
            <!-- Visual Zombie Score bar -->
            <div class="flex gap-1">
              <span 
                v-for="(square, index) in scoreBarSquares" 
                :key="index" 
                class="text-sm"
                v-html="square"
              >
              </span>
            </div>
          </div>
        </div>

        <!-- Social Share Message -->
        <div class="bg-gray-900 rounded-lg p-4">
          <h4 class="text-lg font-semibold mb-3 text-gray-200 flex items-center gap-2">
            📢 Share Your Victory!
          </h4>
          
          <!-- Generated Message -->
          <div class="bg-gray-800 border border-gray-600 rounded-lg p-4 mb-4">
            <div class="text-sm font-mono leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">{{ shareMessage }}</div>
          </div>
          
          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-3">
            <button 
              @click="postToNostr"
              :disabled="posting || posted"
              :class="posted ? 'btn-success' : ''"
              class="flex-1 flex items-center justify-center gap-2"
              :style="!posted ? 'background-color: #8e30eb; color: white;' : ''"
              :onmouseover="!posted ? 'this.style.backgroundColor=\'#7a2bc7\'' : ''"
              :onmouseout="!posted ? 'this.style.backgroundColor=\'#8e30eb\'' : ''"
            >
              <span v-if="posting">⏳</span>
              <span v-else-if="posted">✅</span>
              <span v-else>🚀</span>
              {{ posting ? 'Posting...' : posted ? 'Posted to Nostr!' : 'Post to Nostr' }}
            </button>
            
            <button 
              @click="copyToClipboard"
              :class="copied ? 'btn-success' : 'btn-secondary'"
              class="flex-1 flex items-center justify-center gap-2"
            >
              <span v-if="copied">✅</span>
              <span v-else>📋</span>
              {{ copied ? 'Copied!' : 'Copy Message' }}
            </button>
          </div>
          
          <p class="text-xs text-gray-500 mt-2 text-center">
            <span v-if="!posted">Posting will create a public note on Nostr using your connected account</span>
            <span v-else>Your victory has been shared! You can still copy the message to share elsewhere.</span>
          </p>
        </div>

        <!-- [TEMPORARY - October 2025 Competition] START -->
        <!-- Competition Announcement Banner (shown after posting) -->
        <div v-if="posted" class="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-2 border-yellow-600/50 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <div class="text-2xl flex-shrink-0">🏆</div>
            <div class="flex-1 min-w-0">
              <h3 class="text-yellow-400 font-bold text-sm mb-1">You're Entered in the Top Zombie Challenge!</h3>
              <p class="text-gray-300 text-xs mb-2">
                Your {{ totalPurged }} zombie kills count toward October's competition. 100,100 sats in prizes across top 10 hunters!
              </p>
              <a
                href="/competition.html"
                target="_blank"
                class="text-xs text-yellow-400 hover:text-yellow-300 underline font-semibold"
              >
                View Competition Details & Prizes →
              </a>
            </div>
          </div>
        </div>
        <!-- [TEMPORARY - October 2025 Competition] END -->

        <!-- Follow Recommendations -->
        <div class="bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg p-4">
          <h4 class="text-lg font-semibold mb-2 text-gray-200">
            Keep the community growing! 🌱
          </h4>
          <p class="text-sm text-gray-300 mb-3">
            Follow the Plebs vs Zombies updates and join other zombie hunters:
          </p>
          <div class="flex flex-wrap gap-2">
            <a 
              href="https://jumble.social/users/npub1pvz2c9z4pau26xdwfya24d0qhn6ne8zp9vwjuyxw629wkj9vh5lsrrsd4h" 
              target="_blank"
              class="text-xs px-3 py-1 rounded-full transition-colors inline-flex items-center gap-1"
              style="background-color: #8e30eb;"
              onmouseover="this.style.backgroundColor='#7a2bc7'"
              onmouseout="this.style.backgroundColor='#8e30eb'"
            >
              Follow on Nostr 🟣
            </a>
            <button 
              @click="showZapModal"
              class="text-xs px-3 py-1 bg-yellow-600 hover:bg-yellow-500 rounded-full transition-colors inline-flex items-center gap-1"
            >
              ⚡ Zap Creator
            </button>
            <button 
              @click="followDeveloper"
              class="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-full transition-colors"
            >
              View on GitHub 🤓
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-6 border-t border-gray-700 flex justify-between items-center">
        <div class="text-sm text-gray-400">
          Happy hunting! 🏹
        </div>
        <button 
          @click="$emit('close')"
          class="btn-secondary"
        >
          Close
        </button>
      </div>
    </div>

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
        
        <p class="text-sm text-gray-300 mb-4">
          Support the development of Plebs vs Zombies! Send sats via Lightning Network.
        </p>
        
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
            class="flex-1 text-white px-4 py-2 rounded transition-colors text-sm"
            style="background-color: #8e30eb;"
            onmouseover="this.style.backgroundColor='#7a2bc7'"
            onmouseout="this.style.backgroundColor='#8e30eb'"
          >
            Zap on Nostr
          </button>
          <button 
            @click="closeZapModal"
            class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Status Modal -->
    <ConfirmModal
      :show="statusModal.show"
      :title="statusModal.title"
      :message="statusModal.message"
      :type="statusModal.type"
      confirmText="OK"
      @confirm="closeStatusModal"
      @cancel="closeStatusModal"
    />
  </div>
</template>

<script>
import nostrService from '../services/nostrService';
import ConfirmModal from './ConfirmModal.vue';

export default {
  name: 'ZombiePurgeCelebration',
  components: {
    ConfirmModal
  },
  props: {
    purgeResult: {
      type: Object,
      required: true
    },
    zombieScore: {
      type: Number,
      required: true
    },
    purgeStats: {
      type: Object,
      required: true,
      default: () => ({
        burned: 0,
        fresh: 0,
        rotting: 0,
        ancient: 0
      })
    },
    isNuclearPurge: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      posting: false,
      posted: false,
      copied: false,
      developerNpub: 'npub1pvz2c9z4pau26xdwfya24d0qhn6ne8zp9vwjuyxw629wkj9vh5lsrrsd4h',
      zapModal: {
        show: false,
        lightningAddress: 'plebsvszombies@rizful.com',
        qrCode: ''
      },
      statusModal: {
        show: false,
        title: '',
        message: '',
        type: 'success'
      }
    };
  },
  computed: {
    totalPurged() {
      return this.purgeResult.removedCount || 0;
    },
    shareMessage() {
      // Simple total count description
      const zombieDescription = this.totalPurged === 1 ? '1 Nostr zombie' : `${this.totalPurged} Nostr zombies`;
      
      // Nuclear purge gets special messaging
      if (this.isNuclearPurge) {
        const nuclearActions = ['nuked', 'obliterated', 'vaporized', 'annihilated'];
        const action = nuclearActions[Math.floor(Math.random() * nuclearActions.length)];
        
        const message = `I just ${action} ${zombieDescription} from orbit using the NUCLEAR OPTION in #PlebsVsZombies! ☢️🧟‍♂️🧟‍♀️

💀 MAXIMUM CARNAGE ACHIEVED! 💀

My Zombie Score was ${this.zombieScore}%! What's yours?
${this.scoreBarEmojis.join('')}

Follow nostr:${this.developerNpub} and join the hunt at: 🏹
https://plebsvszombies.cc`;

        return message;
      }

      // Regular purge messaging
      // Fun variation based on number purged with multiple options per tier
      let actionOptions = ['slaughtered'];
      if (this.totalPurged >= 50) actionOptions = ['massacred', 'obliterated', 'annihilated'];
      else if (this.totalPurged >= 20) actionOptions = ['eliminated', 'eradicated', 'demolished'];
      else if (this.totalPurged >= 10) actionOptions = ['purged', 'destroyed', 'terminated'];
      else if (this.totalPurged >= 5) actionOptions = ['hunted down', 'slaughtered'];

      // Randomly select action from the tier
      const action = actionOptions[Math.floor(Math.random() * actionOptions.length)];

      // Randomize weapon side and zombie positions
      const leftWeapons = ['🔪', '🏹', '⚔️'];
      const rightWeapons = ['🗡️', '🪓', '🔨'];
      const zombies = ['🧟‍♂️', '🧟‍♀️'];

      // Randomly choose left or right side
      const useLeftSide = Math.random() < 0.5;
      const weapon = useLeftSide
        ? leftWeapons[Math.floor(Math.random() * leftWeapons.length)]
        : rightWeapons[Math.floor(Math.random() * rightWeapons.length)];

      const zombie1 = zombies[Math.floor(Math.random() * zombies.length)];
      const zombie2 = zombies[Math.floor(Math.random() * zombies.length)];

      const message = useLeftSide
        ? `I just ${action} ${zombieDescription} using #PlebsVsZombies! ${weapon}${zombie1}${zombie2}`
        : `I just ${action} ${zombieDescription} using #PlebsVsZombies! ${zombie1}${zombie2}${weapon}`;

      return `${message}

My Zombie Score was ${this.zombieScore}%! What's yours?
${this.scoreBarEmojis.join('')}

Follow nostr:${this.developerNpub} and join the hunt at: 🏹
https://plebsvszombies.cc`;
    },
    scoreBarSquares() {
      // Create HTML-based colored squares for the UI display
      const squares = [];
      const totalSquares = 14;
      
      if (!this.prePurgeStats) {
        const healthySquares = Math.floor((100 - this.zombieScore) / 100 * totalSquares);
        const zombieSquares = totalSquares - healthySquares;
        
        for (let i = 0; i < healthySquares; i++) squares.push('<span class="inline-block w-3 h-3 rounded-sm" style="background-color: #8e30eb;"></span>');
        for (let i = 0; i < zombieSquares; i++) squares.push('<span class="inline-block w-3 h-3 rounded-sm bg-zombie-green"></span>');
        
        return squares.slice(0, totalSquares);
      }
      
      const totalFollows = this.prePurgeStats.totalFollows;
      const activeCount = this.prePurgeStats.activeCount || (totalFollows - this.prePurgeStats.totalZombies);
      const burnedCount = this.prePurgeStats.burnedCount || 0;
      const freshCount = this.prePurgeStats.freshCount || 0;
      const rottingCount = this.prePurgeStats.rottingCount || 0;
      const ancientCount = this.prePurgeStats.ancientCount || 0;
      
      const activeSquares = Math.round((activeCount / totalFollows) * totalSquares);
      const freshSquares = Math.round((freshCount / totalFollows) * totalSquares);
      const rottingSquares = Math.round((rottingCount / totalFollows) * totalSquares);
      const ancientSquares = Math.round((ancientCount / totalFollows) * totalSquares);
      const burnedSquares = totalSquares - activeSquares - freshSquares - rottingSquares - ancientSquares;

      for (let i = 0; i < activeSquares; i++) squares.push('<span class="inline-block w-3 h-3 rounded-sm" style="background-color: #8e30eb;"></span>');
      for (let i = 0; i < freshSquares; i++) squares.push('<span class="inline-block w-3 h-3 rounded-sm bg-yellow-400"></span>');
      for (let i = 0; i < rottingSquares; i++) squares.push('<span class="inline-block w-3 h-3 rounded-sm bg-orange-500"></span>');
      for (let i = 0; i < ancientSquares; i++) squares.push('<span class="inline-block w-3 h-3 rounded-sm bg-zombie-green"></span>');
      for (let i = 0; i < Math.max(0, burnedSquares); i++) squares.push('<span class="inline-block w-3 h-3 rounded-sm" style="background-color: #92400e;"></span>');

      return squares.slice(0, totalSquares);
    },
    scoreBarEmojis() {
      // Create visual score bar matching the UI display
      const bars = [];
      const totalBars = 14; // Shorter for better mobile display
      
      // Get the pre-purge stats to calculate accurate percentages
      if (!this.prePurgeStats) {
        // Fallback to simple percentage bar if no pre-purge data
        const healthyBars = Math.floor((100 - this.zombieScore) / 100 * totalBars);
        const zombieBars = totalBars - healthyBars;
        
        for (let i = 0; i < healthyBars; i++) bars.push('🟪');
        for (let i = 0; i < zombieBars; i++) bars.push('🟩');
        
        return bars.slice(0, totalBars);
      }
      
      // Calculate actual type percentages from pre-purge data
      const totalFollows = this.prePurgeStats.totalFollows;
      
      // Use the full zombie data counts from pre-purge state
      // This represents the original follow list composition before purging
      const activeCount = this.prePurgeStats.activeCount || (totalFollows - this.prePurgeStats.totalZombies);
      const burnedCount = this.prePurgeStats.burnedCount || 0;
      const freshCount = this.prePurgeStats.freshCount || 0;
      const rottingCount = this.prePurgeStats.rottingCount || 0;
      const ancientCount = this.prePurgeStats.ancientCount || 0;
      
      // Calculate bars for each type proportionally
      const activeBars = Math.round((activeCount / totalFollows) * totalBars);
      const freshBars = Math.round((freshCount / totalFollows) * totalBars);
      const rottingBars = Math.round((rottingCount / totalFollows) * totalBars);
      const ancientBars = Math.round((ancientCount / totalFollows) * totalBars);
      const burnedBars = totalBars - activeBars - freshBars - rottingBars - ancientBars;

      // Add bars in order: active (purple), fresh (yellow), rotting (orange), ancient (red), burned (dark red-brown)
      for (let i = 0; i < activeBars; i++) bars.push('🟪');
      for (let i = 0; i < freshBars; i++) bars.push('🟨');
      for (let i = 0; i < rottingBars; i++) bars.push('🟧');
      for (let i = 0; i < ancientBars; i++) bars.push('🟩');
      for (let i = 0; i < Math.max(0, burnedBars); i++) bars.push('🟫'); // Dark red-brown for burned

      return bars.slice(0, totalBars); // Ensure exact length
    }
  },
  methods: {
    async postToNostr() {
      this.posting = true;
      
      try {
        // Ensure extension is ready
        if (!nostrService.isExtensionReady()) {
          await nostrService.connectExtension();
        }

        // Create note event
        const event = {
          kind: 1, // Note
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['client', 'Plebs vs. Zombies', '31990:acd7818ead75a59d18a96ed87c8c0db56c98785c7df34eaeb9ab11fc7add70e7:1736530923', 'wss://relay.damus.io'],
            ['t', 'PlebsVsZombies'],
            ['t', 'nostr'],
            ['t', 'zombiehunting']
          ],
          content: this.shareMessage
        };

        // Sign and publish the event
        const signedEvent = await window.nostr.signEvent(event);
        
        // Publish via our service using user's preferred relays
        await nostrService.initialize();
        
        // Ensure user's relay list is loaded for optimal publishing
        if (!nostrService.userRelayList) {
          await nostrService.fetchUserRelayList();
        }
        
        const publishResults = await nostrService.publishEventToRelays(signedEvent);
        
        if (publishResults.successful > 0) {
          this.posted = true;
          this.showStatusModal('Success!', `🎉 Posted successfully to ${publishResults.successful} relays! Your zombie hunting victory is now public!`, 'success');
        } else {
          throw new Error('Failed to publish to any relays');
        }
        
      } catch (error) {
        console.error('Failed to post to Nostr:', error);
        let errorMessage = 'Failed to post to Nostr: ' + error.message;
        
        if (error.message.includes('rejected')) {
          errorMessage = 'Posting was cancelled. You can still copy the message to post manually.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Posting timed out. Please try again or copy the message to post manually.';
        }
        
        this.showStatusModal('Error', errorMessage, 'error');
      } finally {
        this.posting = false;
      }
    },
    
    async copyToClipboard() {
      try {
        await navigator.clipboard.writeText(this.shareMessage);
        this.copied = true;
        
        setTimeout(() => {
          this.copied = false;
        }, 3000);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
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
          this.showStatusModal('Error', 'Unable to copy to clipboard. Please copy the message manually.', 'error');
        }
        document.body.removeChild(textArea);
      }
    },
    
    followDeveloper() {
      // Open GitHub repository in new tab
      const githubUrl = 'https://github.com/dmnyc/plebs-vs-zombies';
      window.open(githubUrl, '_blank');
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
      
      // Use jumble.social consistently
      window.open(`https://jumble.social/users/${creatorNpub}`, '_blank');
    },

    showStatusModal(title, message, type = 'info') {
      this.statusModal.title = title;
      this.statusModal.message = message;
      this.statusModal.type = type;
      this.statusModal.show = true;
    },

    closeStatusModal() {
      this.statusModal.show = false;
    }
  },
  emits: ['close']
};
</script>

<style scoped>
/* Add some celebration animations */
@keyframes bounce {
  0%, 20%, 53%, 80%, 100% {
    transform: translateY(0);
  }
  40%, 43% {
    transform: translateY(-8px);
  }
  70% {
    transform: translateY(-4px);
  }
  90% {
    transform: translateY(-2px);
  }
}

.celebration-emoji {
  animation: bounce 2s infinite;
}
</style>