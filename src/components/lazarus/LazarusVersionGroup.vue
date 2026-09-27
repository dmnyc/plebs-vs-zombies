<template>
  <div>
    <button
      type="button"
      :aria-expanded="expanded"
      class="flex w-full items-center justify-between gap-2 py-2 text-left text-xs text-gray-400 hover:text-gray-100"
      @click="$emit('toggle')"
    >
      <span class="min-w-0 truncate">
        {{ candidates.length }} versions · {{ size }} ·
        <span v-if="clobbered" class="font-semibold text-yellow-400">sudden drops · </span>{{ dateRange }}
      </span>
      <span class="flex-shrink-0" aria-hidden="true">{{ expanded ? "▴" : "▾" }}</span>
    </button>
    <div v-if="expanded" class="border-l-2 border-gray-700 pl-3">
      <slot></slot>
    </div>
  </div>
</template>

<script>
import { getLazarusItemRange } from "../../lib/lazarus/index.js";
import { formatDate, itemNoun } from "./format.js";

export default {
  name: "LazarusVersionGroup",
  props: {
    kind: { type: Number, required: true },
    candidates: { type: Array, required: true },
    clobbered: { type: Boolean, default: false },
    expanded: { type: Boolean, default: false },
  },
  emits: ["toggle"],
  computed: {
    size() {
      const ranges = this.candidates.map((c) => getLazarusItemRange(c.itemCount));
      const min = Math.min(...ranges.map((r) => r.min));
      const max = Math.max(...ranges.map((r) => r.max));
      const estimated = this.candidates.some((c) => !!c.itemCount.privateEstimate);
      if (min === max) return `${min} ${itemNoun(this.kind, min)}`;
      const range = `${min}–${max} ${itemNoun(this.kind, max)}`;
      return estimated ? `≈ ${range}` : range;
    },
    dateRange() {
      const newest = formatDate(this.candidates[0].event.created_at);
      const oldest = formatDate(
        this.candidates[this.candidates.length - 1].event.created_at,
      );
      return oldest === newest ? newest : `${oldest} to ${newest}`;
    },
  },
};
</script>
