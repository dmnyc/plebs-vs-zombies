<template>
  <div class="flex items-start justify-between gap-3 py-2.5">
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-gray-100">
          {{ countLabel }}
        </span>
        <span v-if="candidate.itemCount.privateCount" class="text-xs text-gray-400">
          {{ candidate.itemCount.privateCount }} private
        </span>
        <span
          v-if="candidate.itemCount.privateEstimate"
          class="text-xs text-yellow-400"
          title="Estimated from the size of the encrypted private items, which weren't decrypted."
        >
          encrypted, estimated
        </span>
        <span
          v-if="candidate.itemCount.partial && !candidate.itemCount.privateEstimate"
          class="text-xs text-yellow-400"
          title="Private items couldn't be decrypted or sized, so this count may be higher."
        >
          partial count
        </span>
        <span v-if="decrypting" class="spinner-sm"></span>
        <span
          v-if="badge"
          class="rounded px-1.5 py-0.5 text-[11px] font-semibold"
          :class="badge.className"
        >
          {{ badge.text }}
        </span>
      </div>
      <div class="truncate text-xs text-gray-400">
        {{ dateLabel }}<template v-if="candidate.foundOn.length > 0"> · on {{ candidate.foundOn.length }} {{ candidate.foundOn.length === 1 ? "relay" : "relays" }}</template><template v-if="sourceLabel"> · {{ sourceLabel }}</template>
      </div>
      <div v-if="keys.length > 0" class="truncate font-mono text-xs text-gray-500">
        {{ keys.join(", ") }}
      </div>
      <div v-if="note === 'too-large'" class="text-xs text-gray-400">
        Too large for a remote signer to decrypt
      </div>
      <div v-if="note === 'unsupported'" class="text-xs text-gray-400">
        Your signer can't decrypt these private items (NIP-44)
      </div>
      <div v-if="note === 'failed'" class="text-xs text-gray-400">
        Couldn't decrypt the private items ·
        <button
          type="button"
          class="underline hover:text-gray-100"
          @click="$emit('retry-decrypt', candidate)"
        >
          try again
        </button>
      </div>
      <div v-if="tooLargeToRestore && note !== 'too-large'" class="text-xs text-gray-400">
        Too large to restore with a remote signer
      </div>
    </div>

    <div class="flex flex-shrink-0 items-center gap-1">
      <button
        type="button"
        class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-100"
        title="Download this version as JSON"
        aria-label="Download this version as JSON"
        @click="$emit('download', candidate)"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
      <button
        v-if="deletable"
        type="button"
        class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-900/20 hover:text-red-400"
        title="Remove from this device"
        aria-label="Remove from this device"
        @click="$emit('delete')"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
      <button
        v-if="restorable && !candidate.isCurrent"
        type="button"
        class="btn-secondary btn-sm inline-flex items-center gap-1.5"
        :disabled="preparing"
        @click="$emit('review', candidate)"
      >
        <span v-if="preparing" class="spinner-sm"></span>
        Review
      </button>
    </div>
  </div>
</template>

<script>
import {
  getLazarusItemRange,
  isLazarusSizeKnown,
  lazarusItemKey,
} from "../../lib/lazarus/index.js";
import { describeItem, formatCount, formatDateTime } from "./format.js";

export default {
  name: "LazarusVersionRow",
  props: {
    profile: { type: Object, required: true },
    candidate: { type: Object, required: true },
    // "too-large" | "failed" | "unsupported"
    note: { type: String, default: undefined },
    decrypting: { type: Boolean, default: false },
    tooLargeToRestore: { type: Boolean, default: false },
    restorable: { type: Boolean, default: false },
    preparing: { type: Boolean, default: false },
    sourceLabel: { type: String, default: undefined },
    deletable: { type: Boolean, default: false },
  },
  emits: ["review", "download", "retry-decrypt", "delete"],
  computed: {
    countLabel() {
      return formatCount(this.profile.kind, this.candidate.itemCount);
    },
    dateLabel() {
      return formatDateTime(this.candidate.event.created_at);
    },
    // Each version's encryption keys are shown, as the registry asks for
    // kind 10044, so versions can be told apart by more than a count.
    keys() {
      if (this.profile.kind !== 10044) return [];
      const seen = new Set();
      return this.candidate.event.tags
        .filter((tag) => {
          const key = lazarusItemKey(10044, tag);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(describeItem);
    },
    badge() {
      const range = getLazarusItemRange(this.candidate.itemCount);
      // A version that may hold more than nothing isn't empty.
      const empty = isLazarusSizeKnown(this.candidate.itemCount) && range.max === 0;
      if (this.candidate.isCurrent) {
        return { text: "Current", className: "bg-gray-700 text-gray-200" };
      }
      if (this.candidate.isRecommended) {
        return {
          text: "Recommended",
          className: "bg-zombie-green/20 text-zombie-green",
        };
      }
      if (empty && this.profile.meaningfulEmpty) {
        return { text: "Empty state", className: "bg-blue-900/40 text-blue-300" };
      }
      if (empty) {
        return { text: "Empty", className: "bg-yellow-900/40 text-yellow-300" };
      }
      return null;
    },
  },
};
</script>
