<template>
  <nav ref="nav" class="glide-tabs" role="tablist" :aria-label="label">
    <button
      v-for="tab in tabs"
      :id="`tab-${tab.id}`"
      :key="tab.id"
      :ref="setTabRef"
      role="tab"
      :aria-selected="modelValue === tab.id"
      :aria-controls="`panel-${tab.id}`"
      :tabindex="modelValue === tab.id ? 0 : -1"
      class="glide-tab"
      :class="{ 'glide-tab-active': modelValue === tab.id }"
      @click="select(tab.id)"
      @keydown="handleTabKeydown($event, tab.id)"
    >
      <span v-if="tab.icon" class="mr-2">{{ tab.icon }}</span>{{ tab.label }}
    </button>
    <span class="glide-indicator" :style="indicatorStyle" aria-hidden="true"></span>
  </nav>
</template>

<script>
// Tab bar with a single underline that glides between the active tabs.
// Replaces per-button border-b + focus rings (which showed on mouse clicks)
// and avoids overflow-x scrolling on focus.
export default {
  name: 'GlideTabs',
  props: {
    modelValue: {
      type: [String, Number],
      required: true
    },
    tabs: {
      type: Array,
      required: true
    },
    label: {
      type: String,
      default: 'Sections'
    }
  },
  emits: ['update:modelValue'],
  data() {
    return {
      indicator: { width: '0px', transform: 'translateX(0px)' },
      tabRefs: [],
      resizeHandler: null
    };
  },
  computed: {
    indicatorStyle() {
      return {
        width: this.indicator.width,
        transform: this.indicator.transform
      };
    }
  },
  watch: {
    modelValue: {
      immediate: true,
      handler() {
        this.$nextTick(() => this.updateIndicator());
      }
    }
  },
  mounted() {
    this.updateIndicator();
    // Re-measure once webfonts settle (they change tab widths)
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => this.updateIndicator());
    }
    this.resizeHandler = () => this.updateIndicator();
    window.addEventListener('resize', this.resizeHandler);
  },
  beforeUpdate() {
    // Function refs run on every render — reset so the array doesn't accumulate
    this.tabRefs = [];
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.resizeHandler);
  },
  methods: {
    setTabRef(el) {
      if (el) this.tabRefs.push(el);
    },
    select(tabId) {
      this.$emit('update:modelValue', tabId);
    },
    handleTabKeydown(event, tabId) {
      const idx = this.tabs.findIndex((t) => t.id === tabId);
      if (idx === -1) return;
      let nextIdx = null;
      if (event.key === 'ArrowRight') nextIdx = (idx + 1) % this.tabs.length;
      else if (event.key === 'ArrowLeft') nextIdx = (idx - 1 + this.tabs.length) % this.tabs.length;
      else if (event.key === 'Home') nextIdx = 0;
      else if (event.key === 'End') nextIdx = this.tabs.length - 1;
      if (nextIdx === null) return;
      event.preventDefault();
      const next = this.tabs[nextIdx];
      this.select(next.id);
      this.$nextTick(() => {
        const btn = this.tabRefs[nextIdx];
        btn?.focus();
      });
    },
    updateIndicator() {
      const idx = this.tabs.findIndex((t) => t.id === this.modelValue);
      const btn = this.tabRefs[idx];
      if (!btn) return;
      this.indicator = {
        width: `${btn.offsetWidth}px`,
        transform: `translateX(${btn.offsetLeft}px)`
      };
    }
  }
};
</script>

<style scoped>
.glide-tabs {
  position: relative;
  display: flex;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.glide-tab {
  position: relative;
  padding: 0.75rem 1.1rem;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  color: #9ca3af;
  background: transparent;
  border: 0;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s ease, transform 0.2s ease;
  outline: none;
}
.glide-tab:hover {
  color: #e5e7eb;
}
.glide-tab:active {
  transform: translateY(1px);
}
/* Keyboard users get a color cue; the underline itself marks the active tab,
   so no focus ring is needed on pointer clicks. */
.glide-tab:focus-visible {
  color: var(--zombie-green, #5cdb5c);
}
.glide-tab-active {
  color: var(--zombie-green, #5cdb5c);
  font-weight: 600;
}

.glide-indicator {
  position: absolute;
  bottom: -1px;
  left: 0;
  height: 3px;
  border-radius: 999px 999px 0 0;
  background: linear-gradient(90deg, #5cdb5c, #a3e635);
  box-shadow:
    0 0 12px rgba(92, 219, 92, 0.8),
    0 0 28px rgba(92, 219, 92, 0.4);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  will-change: transform, width;
}
</style>
