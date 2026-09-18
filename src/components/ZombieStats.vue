<template>
  <div class="card">
    <h3 class="section-title">{{ title }}</h3>
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <span class="text-gray-300">Total:</span>
        <span class="font-bold text-zombie-green"><AnimatedNumber :value="stats.total" /></span>
      </div>

      <div class="flex justify-between items-center">
        <span class="text-gray-300">Active:</span>
        <span class="font-bold text-pleb-purple"><AnimatedNumber :value="stats.active" /></span>
      </div>

      <div v-if="stats.burned > 0" class="flex justify-between items-center">
        <span class="text-gray-300">🔥 Burned Zombies:</span>
        <span class="font-bold text-amber-900"><AnimatedNumber :value="stats.burned" /></span>
      </div>

      <div class="flex justify-between items-center">
        <span class="text-gray-300">Fresh Zombies:</span>
        <span class="font-bold text-yellow-400"><AnimatedNumber :value="stats.fresh" /></span>
      </div>

      <div class="flex justify-between items-center">
        <span class="text-gray-300">Rotting Zombies:</span>
        <span class="font-bold text-orange-500"><AnimatedNumber :value="stats.rotting" /></span>
      </div>

      <div class="flex justify-between items-center">
        <span class="text-gray-300">Ancient Zombies:</span>
        <span class="font-bold text-red-500"><AnimatedNumber :value="stats.ancient" /></span>
      </div>

      <div class="pt-3 border-t border-gray-700">
        <div class="flex justify-between items-center">
          <span class="text-gray-300 font-medium">Total Zombies:</span>
          <span class="font-bold text-zombie-green text-lg"><AnimatedNumber :value="totalZombies" /></span>
        </div>
      </div>
    </div>

    <div class="mt-6 pt-4 border-t border-gray-700">
      <div class="relative pt-1">
        <div class="flex mb-2 items-center justify-between">
          <div>
            <span class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-zombie-green bg-zombie-dark">
              Zombie Score™
            </span>
          </div>
          <div class="text-right">
            <span class="text-xs font-semibold inline-block text-zombie-green">
              {{ zombiePercentage }}%
            </span>
          </div>
        </div>
        <div class="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-700">
          <div :style="barStyle(activePercentage, 0)" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-pleb-purple transition-all duration-700"></div>
          <div :style="barStyle(freshPercentage, 1)" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-yellow-400 transition-all duration-700"></div>
          <div :style="barStyle(rottingPercentage, 2)" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-orange-500 transition-all duration-700"></div>
          <div :style="barStyle(ancientPercentage, 3)" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-red-500 transition-all duration-700"></div>
          <div v-if="stats.burned > 0" :style="barStyle(burnedPercentage, 4)" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-amber-900 transition-all duration-700"></div>
        </div>
      </div>
    </div>

    <slot></slot>
  </div>
</template>

<script>
import AnimatedNumber from './AnimatedNumber.vue';

export default {
  name: 'ZombieStats',
  components: {
    AnimatedNumber
  },
  props: {
    title: {
      type: String,
      default: 'Zombie Statistics'
    },
    stats: {
      type: Object,
      required: true,
      default: () => ({
        total: 0,
        active: 0,
        burned: 0,
        fresh: 0,
        rotting: 0,
        ancient: 0
      })
    }
  },
  methods: {
    // Staggered width transition for the score bar segments
    barStyle(percentage, index) {
      return {
        width: `${percentage}%`,
        'transition-delay': `${index * 90}ms`
      };
    }
  },
  computed: {
    totalZombies() {
      return (this.stats.burned || 0) + (this.stats.fresh || 0) + (this.stats.rotting || 0) + (this.stats.ancient || 0);
    },
    activePercentage() {
      return this.stats.total ? Math.round((this.stats.active / this.stats.total) * 100) : 0;
    },
    burnedPercentage() {
      return this.stats.total ? Math.round((this.stats.burned / this.stats.total) * 100) : 0;
    },
    freshPercentage() {
      return this.stats.total ? Math.round((this.stats.fresh / this.stats.total) * 100) : 0;
    },
    rottingPercentage() {
      return this.stats.total ? Math.round((this.stats.rotting / this.stats.total) * 100) : 0;
    },
    ancientPercentage() {
      return this.stats.total ? Math.round((this.stats.ancient / this.stats.total) * 100) : 0;
    },
    zombiePercentage() {
      return this.stats.total ? Math.round(((this.stats.burned + this.stats.fresh + this.stats.rotting + this.stats.ancient) / this.stats.total) * 100) : 0;
    }
  }
};
</script>