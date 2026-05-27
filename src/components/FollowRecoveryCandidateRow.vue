<template>
  <div
    class="rounded-lg border p-3"
    :class="candidate.isRecommended
      ? 'border-zombie-green bg-green-900/10'
      : 'border-gray-700 bg-gray-800/50'"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-semibold text-gray-100">
            {{ candidate.followCount }} follow{{ candidate.followCount === 1 ? '' : 's' }}
          </span>
          <span
            v-if="candidate.isRecommended"
            class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-700 text-green-100"
          >⭐ Recommended</span>
          <span
            v-if="candidate.isCurrent"
            class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-700 text-blue-100"
          >Current</span>
          <span
            v-if="candidate.followCount === 0"
            class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-700 text-gray-300"
          >Empty</span>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          {{ formattedDate }} ({{ relativeAge }}) ·
          <span :title="candidate.eventId">event {{ candidate.eventId.slice(0, 8) }}…</span> ·
          found on {{ candidate.foundOnRelays.length }} relay{{ candidate.foundOnRelays.length === 1 ? '' : 's' }}
        </p>
      </div>
      <button
        @click="$emit('restore')"
        :disabled="disabled"
        class="rounded inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="[
          candidate.isRecommended
            ? 'bg-zombie-green text-zombie-dark hover:bg-green-400 font-bold text-base px-6 py-3 shadow-lg'
            : 'bg-gray-700 text-gray-200 hover:bg-gray-600 text-sm px-3 py-1.5',
          candidate.isRecommended && !disabled ? 'animate-pulse-glow' : ''
        ]"
        :title="buttonTitle"
      >
        <span v-if="isRestoring" class="spinner-sm inline-block"></span>
        <span>{{ candidate.isRecommended ? '🛟 Restore Now' : 'Restore' }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { format } from 'date-fns';

export default {
  name: 'FollowRecoveryCandidateRow',
  props: {
    candidate: { type: Object, required: true },
    restoring: { type: String, default: null }
  },
  emits: ['restore'],
  computed: {
    isRestoring() {
      return this.restoring === this.candidate.eventId;
    },
    disabled() {
      return (
        this.isRestoring ||
        this.candidate.followCount === 0 ||
        this.candidate.isCurrent ||
        (this.restoring !== null && this.restoring !== this.candidate.eventId)
      );
    },
    formattedDate() {
      return format(new Date(this.candidate.createdAt * 1000), 'PPpp');
    },
    relativeAge() {
      const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - this.candidate.createdAt);
      const days = Math.floor(ageSeconds / 86400);
      if (days >= 1) return `${days} day${days === 1 ? '' : 's'} ago`;
      const hours = Math.floor(ageSeconds / 3600);
      if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
      const minutes = Math.floor(ageSeconds / 60);
      if (minutes >= 1) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
      return 'just now';
    },
    buttonTitle() {
      if (this.candidate.followCount === 0) return 'This version has no follows — nothing to restore';
      if (this.candidate.isCurrent) return 'This is already your current follow list';
      return 'Republish this version as your follow list';
    }
  }
};
</script>
