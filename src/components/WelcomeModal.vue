<template>
  <Transition name="modal">
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" @click.self="$emit('close')">
    <div class="modal-panel card max-w-lg w-full">
      <!-- Header -->
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <span class="text-3xl">🧟‍♂️</span>
          <h2 class="text-2xl">Welcome to Plebs vs. Zombies!</h2>
        </div>
        <button
          @click="$emit('close')"
          class="text-gray-500 hover:text-gray-300 text-2xl leading-none shrink-0"
        >
          ×
        </button>
      </div>

      <!-- Step content -->
      <div :key="step" class="animate-fade-in">
        <div v-if="step === 1">
          <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
            🎯 What are "Zombies"?
          </h3>
          <p class="text-gray-300 text-sm mb-4">
            Nostr accounts you follow that have gone inactive or been deleted.
          </p>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2.5">
              <span>🧟‍♀️</span>
              <span><strong class="text-gray-100">Fresh</strong> <span class="text-gray-500">90+ days</span></span>
            </div>
            <div class="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2.5">
              <span>🧟‍♂️</span>
              <span><strong class="text-gray-100">Rotting</strong> <span class="text-gray-500">180+ days</span></span>
            </div>
            <div class="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2.5">
              <span>💀</span>
              <span><strong class="text-gray-100">Ancient</strong> <span class="text-gray-500">365+ days</span></span>
            </div>
            <div class="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2.5">
              <span>🔥</span>
              <span><strong class="text-gray-100">Burned</strong> <span class="text-gray-500">deleted</span></span>
            </div>
          </div>
        </div>

        <div v-else-if="step === 2">
          <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
            ⚔️ How Zombie Hunting Works
          </h3>
          <div class="space-y-2.5 text-sm text-gray-300">
            <div class="flex items-center gap-3">
              <span class="shrink-0 w-6 h-6 rounded-full bg-zombie-green text-zombie-dark font-bold text-xs flex items-center justify-center">1</span>
              <span>Scan your follows across relays</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="shrink-0 w-6 h-6 rounded-full bg-zombie-green text-zombie-dark font-bold text-xs flex items-center justify-center">2</span>
              <span>Review zombies by category</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="shrink-0 w-6 h-6 rounded-full bg-zombie-green text-zombie-dark font-bold text-xs flex items-center justify-center">3</span>
              <span>Grant immunity to protect VIPs</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="shrink-0 w-6 h-6 rounded-full bg-zombie-green text-zombie-dark font-bold text-xs flex items-center justify-center">4</span>
              <span>Purge safely in small batches</span>
            </div>
          </div>
        </div>

        <div v-else-if="step === 3">
          <h3 class="text-lg font-semibold mb-2 flex items-center gap-2 text-amber-300">
            ⚠️ Create a Backup First
          </h3>
          <p class="text-gray-300 text-sm mb-5">
            Strongly recommended before purging, so you can restore your follows if anything goes wrong.
          </p>
          <div class="flex flex-col sm:flex-row gap-3">
            <button
              @click="goToBackups"
              class="btn-primary flex-1 inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span>💾</span><span>Create Backup</span>
            </button>
            <button
              @click="skipBackup"
              class="btn-tertiary flex-1 inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span>⏭️</span><span>Skip for Now</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Step nav -->
      <div class="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
        <div class="flex gap-1.5" aria-hidden="true">
          <span
            v-for="n in 3"
            :key="n"
            class="w-1.5 h-1.5 rounded-full transition-colors"
            :class="n === step ? 'bg-zombie-green' : 'bg-gray-600'"
          ></span>
        </div>
        <div class="flex gap-2">
          <button v-if="step > 1" @click="step--" class="btn-tertiary btn-sm">Back</button>
          <button v-if="step < 3" @click="step++" class="btn-primary btn-sm">Next</button>
        </div>
      </div>
    </div>
  </div>
  </Transition>
</template>

<script>
export default {
  name: 'WelcomeModal',
  emits: ['close', 'go-to-backups', 'skip-backup'],
  data() {
    return {
      step: 1
    };
  },
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
