<template>
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-w-3xl w-full mx-4 max-h-[95vh] overflow-y-auto">
      <!-- Header -->
      <div class="p-6 border-b border-gray-700">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="text-4xl">🧟‍♂️</div>
            <div>
              <h2 class="text-3xl font-bold text-zombie-green">Welcome to Plebs vs. Zombies!</h2>
              <p class="text-gray-400 mt-1">The ultimate Nostr follow list cleanup tool</p>
            </div>
          </div>
          <button 
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6">
        <!-- What is this? -->
        <div class="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg p-6">
          <h3 class="text-xl font-bold mb-3 flex items-center gap-2">
            🎯 What are "Zombies"?
          </h3>
          <p class="text-gray-300 mb-3">
            Zombies are Nostr accounts you follow that have been inactive for a long time or have been deleted. 
            Over time, your follow list can become cluttered with these dormant accounts.
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div class="flex items-center gap-2">
              <span class="text-yellow-400">🧟‍♀️</span>
              <span><strong>Fresh:</strong> 90+ days inactive</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-orange-500">🧟‍♂️</span>
              <span><strong>Rotting:</strong> 180+ days inactive</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-red-500">💀</span>
              <span><strong>Ancient:</strong> 365+ days inactive</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-red-700">🔥</span>
              <span><strong>Burned:</strong> Deleted accounts</span>
            </div>
          </div>
        </div>

        <!-- How it works -->
        <div class="bg-gradient-to-r from-green-900/50 to-teal-900/50 rounded-lg p-6">
          <h3 class="text-xl font-bold mb-3 flex items-center gap-2">
            ⚔️ How Zombie Hunting Works
          </h3>
          <div class="space-y-3 text-gray-300">
            <div class="flex items-start gap-3">
              <span class="text-2xl">1️⃣</span>
              <div>
                <strong class="text-white">Scan Your Follows:</strong> We analyze your follow list across multiple Nostr relays to find inactive accounts.
              </div>
            </div>
            <div class="flex items-start gap-3">
              <span class="text-2xl">2️⃣</span>
              <div>
                <strong class="text-white">Review Zombies:</strong> Browse your zombies by category and decide which ones to keep or remove.
              </div>
            </div>
            <div class="flex items-start gap-3">
              <span class="text-2xl">3️⃣</span>
              <div>
                <strong class="text-white">Grant Immunity:</strong> Protect important accounts from being marked as zombies.
              </div>
            </div>
            <div class="flex items-start gap-3">
              <span class="text-2xl">4️⃣</span>
              <div>
                <strong class="text-white">Purge Safely:</strong> Remove unwanted zombies in small, manageable batches.
              </div>
            </div>
          </div>
        </div>

        <!-- Backup Warning -->
        <div class="bg-gradient-to-r from-amber-900/50 to-red-900/50 rounded-lg p-6 border border-amber-700/50">
          <h3 class="text-xl font-bold mb-3 flex items-center gap-2">
            ⚠️ Important: Create a Backup First!
          </h3>
          <p class="text-gray-300 mb-4">
            Before hunting zombies, we <strong class="text-amber-300">strongly recommend</strong> creating a backup of your follow list. 
            This ensures you can restore your follows if something goes wrong.
          </p>
          <div class="bg-amber-900/30 rounded-lg p-4 mb-4">
            <div class="flex items-start gap-3">
              <span class="text-xl">💾</span>
              <div>
                <strong class="text-amber-200">Backups Include:</strong>
                <ul class="list-disc list-inside text-gray-300 text-sm mt-1 ml-2 space-y-1">
                  <li>Your complete follow list</li>
                  <li>Timestamps and metadata</li>
                  <li>Easy export and import</li>
                  <li>Local browser storage</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="flex flex-col sm:flex-row gap-3">
            <button 
              @click="goToBackups"
              class="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <span>💾</span>
              Create My First Backup
            </button>
            <button 
              @click="skipBackup"
              class="btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              <span>⏭️</span>
              Skip for Now
            </button>
          </div>
        </div>

        <!-- Features -->
        <div class="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 rounded-lg p-6">
          <h3 class="text-xl font-bold mb-3 flex items-center gap-2">
            ✨ Key Features
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div class="flex items-center gap-2">
              <span class="text-green-400">🛡️</span>
              <span>Immunity system for VIPs</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-blue-400">📊</span>
              <span>Detailed zombie statistics</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-purple-400">🔄</span>
              <span>Safe batch processing</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-yellow-400">💾</span>
              <span>Backup & restore tools</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-pink-400">🎉</span>
              <span>Social sharing of victories</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-cyan-400">🌐</span>
              <span>Multi-relay support</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-6 border-t border-gray-700">
        <div class="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div class="text-sm text-gray-400">
            Happy hunting! Remember to backup first for maximum safety. 🏹
          </div>
          <div class="flex gap-3">
            <button 
              @click="$emit('close')"
              class="btn-secondary px-6"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'WelcomeModal',
  emits: ['close', 'go-to-backups', 'skip-backup'],
  methods: {
    goToBackups() {
      this.$emit('go-to-backups');
    },
    skipBackup() {
      // Mark that user has seen welcome and chosen to skip backup
      localStorage.setItem('pvz-welcome-seen', 'true');
      localStorage.setItem('pvz-backup-skipped', 'true');
      this.$emit('skip-backup');
      this.$emit('close');
    }
  }
};
</script>