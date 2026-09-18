<template>
  <span>{{ formatted }}</span>
</template>

<script>
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default {
  name: 'AnimatedNumber',
  props: {
    value: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      default: 800
    },
    // Insert thousands separators (12,345 instead of 12345)
    format: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      displayValue: this.value,
      raf: null
    };
  },
  computed: {
    formatted() {
      return this.format
        ? this.displayValue.toLocaleString()
        : String(this.displayValue);
    }
  },
  watch: {
    value: {
      immediate: true,
      handler(newValue, oldValue) {
        this.animate(oldValue || 0, newValue || 0);
      }
    }
  },
  methods: {
    animate(from, to) {
      cancelAnimationFrame(this.raf);
      if (from === to || prefersReducedMotion()) {
        this.displayValue = to;
        return;
      }
      const start = performance.now();
      const step = (now) => {
        const t = Math.min((now - start) / this.duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        this.displayValue = Math.round(from + (to - from) * eased);
        if (t < 1) {
          this.raf = requestAnimationFrame(step);
        }
      };
      this.raf = requestAnimationFrame(step);
    }
  },
  beforeUnmount() {
    cancelAnimationFrame(this.raf);
  }
};
</script>
