<template>
  <div class="flex items-start gap-2 rounded-lg border p-3 text-sm" :class="toneClass">
    <span class="mt-px flex-shrink-0" aria-hidden="true">{{ tone === "blue" ? "ℹ️" : "⚠️" }}</span>
    <div class="min-w-0"><slot></slot></div>
  </div>
</template>

<script>
const TONES = {
  amber: "border-yellow-700/60 bg-yellow-900/20 text-yellow-200",
  red: "border-red-700/60 bg-red-900/20 text-red-200",
  blue: "border-blue-700/60 bg-blue-900/20 text-blue-200",
};

export default {
  name: "LazarusNotice",
  props: {
    tone: { type: String, default: "amber" },
  },
  computed: {
    toneClass() {
      return TONES[this.tone] || TONES.amber;
    },
  },
};
</script>
