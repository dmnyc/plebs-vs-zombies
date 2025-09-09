<template>
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="p-6 border-b border-gray-700">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-bold text-zombie-green flex items-center gap-2">
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
          <div class="text-4xl">🔪🧟‍♂️🧟‍♀️</div>
          <h3 class="text-xl font-bold text-gray-100">
            Successfully purged {{ totalPurged }} {{ totalPurged === 1 ? 'zombie' : 'zombies' }}!
          </h3>
          <p class="text-gray-400">
            Your follow list is now cleaner and more efficient
          </p>
        </div>

        <!-- Detailed Stats -->
        <div class="bg-gray-900 rounded-lg p-4">
          <h4 class="text-lg font-semibold mb-3 text-gray-200">Purge Breakdown:</h4>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div v-if="purgeStats.burned > 0" class="flex justify-between">
              <span class="text-red-300">🔥 Burned (deleted):</span>
              <span class="font-bold">{{ purgeStats.burned }}</span>
            </div>
            <div v-if="purgeStats.ancient > 0" class="flex justify-between">
              <span class="text-red-500">💀 Ancient (365+ days):</span>
              <span class="font-bold">{{ purgeStats.ancient }}</span>
            </div>
            <div v-if="purgeStats.rotting > 0" class="flex justify-between">
              <span class="text-orange-500">🧟‍♂️ Rotting (180+ days):</span>
              <span class="font-bold">{{ purgeStats.rotting }}</span>
            </div>
            <div v-if="purgeStats.fresh > 0" class="flex justify-between">
              <span class="text-yellow-400">🧟‍♀️ Fresh (90+ days):</span>
              <span class="font-bold">{{ purgeStats.fresh }}</span>
            </div>
          </div>
          
          <!-- Zombie Score -->
          <div class="mt-4 pt-4 border-t border-gray-700">
            <div class="flex justify-between items-center mb-2">
              <span class="text-gray-300">Previous Zombie Score:</span>
              <span class="text-lg font-bold text-zombie-green">{{ zombieScore }}%</span>
            </div>
            <!-- Visual Zombie Score bar -->
            <div class="flex gap-1">
              <span 
                v-for="(square, index) in scoreBarEmojis" 
                :key="index" 
                class="text-sm"
              >
                {{ square }}
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
              :class="posted ? 'btn-success' : 'btn-primary'"
              class="flex-1 flex items-center justify-center gap-2"
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

        <!-- Follow Recommendations -->
        <div class="bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg p-4">
          <h4 class="text-lg font-semibold mb-2 text-gray-200">
            Keep the community growing! 🌱
          </h4>
          <p class="text-sm text-gray-300 mb-3">
            Follow the Plebs vs Zombies updates and join other zombie hunters:
          </p>
          <div class="flex flex-wrap gap-2">
            <button 
              @click="followDeveloper"
              class="text-xs px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded-full transition-colors"
            >
              View on GitHub 👨‍💻
            </button>
            <a 
              href="https://jumble.social/users/npub1pvz2c9z4pau26xdwfya24d0qhn6ne8zp9vwjuyxw629wkj9vh5lsrrsd4h" 
              target="_blank"
              class="text-xs px-3 py-1 bg-orange-700 hover:bg-orange-600 rounded-full transition-colors inline-flex items-center gap-1"
            >
              Follow on Nostr 🟣
            </a>
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
  </div>
</template>

<script>
import nostrService from '../services/nostrService';

export default {
  name: 'ZombiePurgeCelebration',
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
    }
  },
  data() {
    return {
      posting: false,
      posted: false,
      copied: false,
      developerNpub: 'npub1pvz2c9z4pau26xdwfya24d0qhn6ne8zp9vwjuyxw629wkj9vh5lsrrsd4h'
    };
  },
  computed: {
    totalPurged() {
      return this.purgeResult.removedCount || 0;
    },
    shareMessage() {
      // Simple total count description
      const zombieDescription = this.totalPurged === 1 ? '1 Nostr zombie' : `${this.totalPurged} Nostr zombies`;

      // Fun variation based on number purged
      let action = 'slaughtered';
      if (this.totalPurged >= 50) action = 'massacred';
      else if (this.totalPurged >= 20) action = 'eliminated';
      else if (this.totalPurged >= 10) action = 'purged';
      else if (this.totalPurged >= 5) action = 'hunted down';

      const message = `I just ${action} ${zombieDescription} using #PlebsVsZombies! 🔪🧟‍♂️🧟‍♀️

My Zombie Score was ${this.zombieScore}%! What's yours?
${this.scoreBarEmojis.join('')}

Follow nostr:${this.developerNpub} and join the hunt at: 🏹
https://plebs-vs-zombies.vercel.app`;

      return message;
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
        
        for (let i = 0; i < healthyBars; i++) bars.push('🟦');
        for (let i = 0; i < zombieBars; i++) bars.push('🟥');
        
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

      // Add bars in order: active (blue), fresh (yellow), rotting (orange), ancient (red), burned (dark red-brown)
      for (let i = 0; i < activeBars; i++) bars.push('🟦');
      for (let i = 0; i < freshBars; i++) bars.push('🟨');
      for (let i = 0; i < rottingBars; i++) bars.push('🟧');
      for (let i = 0; i < ancientBars; i++) bars.push('🟥');
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
            ['t', 'PlebsVsZombies'],
            ['t', 'nostr'],
            ['t', 'zombiehunting']
          ],
          content: this.shareMessage
        };

        // Sign and publish the event
        const signedEvent = await window.nostr.signEvent(event);
        
        // Publish via our service
        await nostrService.initialize();
        const publishResults = await nostrService.publishEventToRelays(signedEvent);
        
        if (publishResults.successful > 0) {
          this.posted = true;
          alert(`🎉 Posted successfully to ${publishResults.successful} relays! Your zombie hunting victory is now public!`);
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
        
        alert(errorMessage);
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
          alert('Unable to copy to clipboard. Please copy the message manually.');
        }
        document.body.removeChild(textArea);
      }
    },
    
    followDeveloper() {
      // Open GitHub repository in new tab
      const githubUrl = 'https://github.com/dmnyc/plebs-vs-zombies';
      window.open(githubUrl, '_blank');
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