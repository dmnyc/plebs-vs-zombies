<template>
  <Teleport to="body">
    <div v-if="active" aria-hidden="true" style="inset: 0; position: fixed; z-index: 45; pointer-events: none; overflow: hidden;">
      <span
        v-for="drop in drops"
        :key="drop.id"
        style="position: absolute; top: 0; animation: zombie-fall linear forwards;"
        :style="drop.style"
      >{{ drop.emoji }}</span>
    </div>
  </Teleport>
</template>

<script>
const RAIN_EMOJI = ['🧟', '🧟‍♂️', '🧟‍♀️', '🧠', '🪦', '⚔️', '🧟', '🧠'];

export default {
  name: 'ZombieRain',
  props: {
    // Milliseconds the rain lasts; 0 keeps it until `active` is toggled false
    duration: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 30
    }
  },
  data() {
    return {
      active: false,
      drops: [],
      timer: null,
      dropSeq: 0
    };
  },
  methods: {
    start(count = this.count) {
      clearTimeout(this.timer);
      const drops = [];
      for (let i = 0; i < count; i++) {
        drops.push(this.makeDrop(i));
      }
      this.drops = drops;
      this.active = true;
      if (this.duration > 0) {
        this.timer = setTimeout(() => this.stop(), this.duration);
      }
    },
    stop() {
      clearTimeout(this.timer);
      this.active = false;
      this.drops = [];
    },
    makeDrop(i) {
      const emoji = RAIN_EMOJI[Math.floor(Math.random() * RAIN_EMOJI.length)];
      const size = 18 + Math.random() * 26;
      const dur = 2.2 + Math.random() * 2.6;
      return {
        id: ++this.dropSeq,
        emoji,
        style: {
          left: `${Math.random() * 96}%`,
          'font-size': `${size}px`,
          'animation-duration': `${dur}s`,
          'animation-delay': `${(i % 10) * 0.12 + Math.random() * 0.4}s`,
          opacity: 0.85
        }
      };
    }
  },
  beforeUnmount() {
    clearTimeout(this.timer);
  }
};
</script>
