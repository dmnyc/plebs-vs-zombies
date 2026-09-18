<template>
  <div>
    <div class="text-center mb-6">
      <div class="text-4xl mb-3">🧟‍♀️☑️</div>
      <h3 class="text-xl mb-2 text-zombie-green">Zombie Check</h3>
      <p class="text-gray-400 text-sm">
        Check whether any Nostr user is a zombie and see how long they've been gone.
      </p>
    </div>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">
          Search for a user or paste an npub/hex pubkey:
        </label>
        <ProfileSearchInput
          ref="searchInput"
          placeholder="Search by username or paste npub/nprofile/hex..."
          @profile-selected="onProfileSelected"
          @input-changed="onInputChanged"
        />
      </div>

      <button
        @click="check()"
        :disabled="!inputValue || checking"
        class="btn-primary w-full flex items-center justify-center gap-2"
        :class="{ 'opacity-50 cursor-not-allowed': !inputValue || checking }"
      >
        <span v-if="checking" class="spinner-sm inline-block"></span>
        <span>{{ checking ? 'Checking…' : '🧟 Check for Zombie' }}</span>
      </button>

      <p v-if="progress" class="text-xs text-gray-400 text-center">{{ progress }}</p>
      <p v-if="error" class="text-red-400 text-xs text-center">{{ error }}</p>
    </div>

    <!-- Result -->
    <div v-if="result" class="mt-6">
      <!-- Self-contained frame: designed to be screenshotted and shared as-is,
           so it carries its own opaque background and a small brand mark
           rather than relying on whatever's behind it on the page. The
           "Check another user" button below is deliberately outside this
           frame, so a screenshot of just this card doesn't include it. -->
      <div
        class="rounded-2xl border-2 p-6"
        :class="result.borderClass"
      >
        <div class="flex items-center gap-4 mb-4">
          <img
            :src="result.profile.picture || '/default-avatar.svg'"
            :alt="result.displayName"
            class="w-14 h-14 rounded-full object-cover bg-gray-700 flex-shrink-0"
            @error="onAvatarError"
          />
          <div class="min-w-0 flex-1">
            <div class="font-bold text-white truncate">{{ result.displayName }}</div>
            <a
              :href="`https://jumble.social/users/${result.profile.npub}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-gray-400 hover:text-gray-200 font-mono truncate block"
            >
              {{ shortNpub(result.profile.npub) }}
            </a>
          </div>
        </div>

        <div class="text-center py-2">
          <div class="text-5xl mb-2 inline-block" :class="{ 'animate-heartbeat': result.beat }">
            <img
              v-if="result.iconSrc"
              :src="result.iconSrc"
              :alt="result.label"
              class="h-12 w-12 inline-block align-middle"
            />
            <template v-else>{{ result.emoji }}</template>
          </div>
          <div class="text-2xl font-bold" :class="result.textClass">{{ result.label }}</div>
          <p class="text-sm font-medium text-gray-200 mt-2">{{ result.detail }}</p>
          <p v-if="result.lastSeenDate" class="text-xs text-gray-500 mt-1">
            Last activity: {{ result.lastSeenDate }}
          </p>
          <p class="text-xs mt-2" :class="result.deletionStatus.textClass">
            {{ result.deletionStatus.icon }} {{ result.deletionStatus.text }}
          </p>
        </div>

        <!-- Brand watermark -->
        <div class="flex items-center justify-center mt-5 pt-4 border-t border-white/10">
          <span class="font-horror text-zombie-green text-lg [text-shadow:0_0_12px_rgb(92_219_92_/_0.35)]">
            Plebs vs. Zombies
          </span>
        </div>
      </div>

      <button
        @click="reset"
        class="btn-secondary w-full mt-4 text-sm"
      >
        Check another user
      </button>
    </div>
  </div>
</template>

<script>
import { format } from 'date-fns';
import nostrService from '../services/nostrService';
import zombieService from '../services/zombieService';
import ProfileSearchInput from './ProfileSearchInput.vue';

// U+1FAC0 (anatomical heart) arrived in Emoji 13.0 (2020). Every other emoji
// here predates 2017, so on a platform whose emoji font stopped before 13.0 —
// notably Windows 10, which never got it — the "Alive!" verdict renders as a
// blank box while everything around it is fine. Since that's the most common
// verdict, detect the gap once and swap in an SVG only for those users; anyone
// whose system has the glyph keeps their own native artwork.
let heartGlyphSupported = null;

function supportsAnatomicalHeart() {
  if (heartGlyphSupported !== null) return heartGlyphSupported;
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return (heartGlyphSupported = false);
    ctx.font = '32px sans-serif';
    const heart = ctx.measureText('\u{1FAC0}').width;
    const missing = ctx.measureText('￿').width; // permanently unassigned
    const present = ctx.measureText('\u{1F480}').width; // skull, Emoji 1.0
    // A glyph the font lacks collapses to the same notdef box as U+FFFF;
    // a real emoji matches the advance width of other emoji.
    heartGlyphSupported = heart !== missing && heart === present;
  } catch (_) {
    heartGlyphSupported = false; // fall back to the SVG, which always renders
  }
  return heartGlyphSupported;
}

// Backgrounds are a colored tint fading into an opaque dark base, rather
// than a plain low-opacity tint alone — the result card is designed to be
// screenshotted, so it needs to look complete on its own regardless of
// whatever's showing through from the page behind it.
const CATEGORY_DISPLAY = {
  active: {
    emoji: '🫀',
    iconFallback: '/heart-anatomical.svg',
    label: 'Alive!',
    borderClass: 'border-zombie-green bg-gradient-to-br from-green-900/40 to-zombie-dark',
    textClass: 'text-zombie-green',
    beat: true,
  },
  infected: {
    emoji: '💛',
    label: 'Possible Infection',
    borderClass: 'border-yellow-500/50 bg-gradient-to-br from-yellow-900/40 to-zombie-dark',
    textClass: 'text-yellow-300',
  },
  fresh: {
    emoji: '🧟',
    label: 'Fresh Zombie',
    borderClass: 'border-yellow-600/50 bg-gradient-to-br from-yellow-900/40 to-zombie-dark',
    textClass: 'text-yellow-400',
  },
  rotting: {
    emoji: '🧟‍♂️',
    label: 'Rotting Zombie',
    borderClass: 'border-orange-600/50 bg-gradient-to-br from-orange-900/40 to-zombie-dark',
    textClass: 'text-orange-400',
  },
  ancient: {
    emoji: '💀',
    label: 'Ancient Zombie',
    borderClass: 'border-red-700/50 bg-gradient-to-br from-red-900/40 to-zombie-dark',
    textClass: 'text-red-400',
  },
  burned: {
    emoji: '🔥',
    label: 'Burned',
    borderClass: 'border-gray-600 bg-gradient-to-br from-gray-800/60 to-zombie-dark',
    textClass: 'text-gray-300',
  },
};

// Deletion-request status is tracked independently of the zombie verdict
// above — an account marked deleted and then reactivated still lands
// outside the 'burned' bucket, so without this it would show no trace of
// the deletion request ever having happened.
// Weight tracks how actionable each state is: a clean result is no more
// important than the "Last activity" line above it, so it stays at the
// same quiet weight — only the two states worth acting on get bumped up.
const DELETION_STATUS_STYLE = {
  current: { icon: '⚠️', textClass: 'text-red-400 font-medium' },
  past: { icon: '🩹', textClass: 'text-yellow-400 font-medium' },
  none: { icon: '☑️', textClass: 'text-gray-200 font-medium' },
};

export default {
  name: 'ZombieCheck',
  components: { ProfileSearchInput },
  data() {
    return {
      inputValue: '',
      selectedProfile: null,
      checking: false,
      progress: '',
      error: null,
      result: null,
    };
  },
  methods: {
    onInputChanged(value) {
      this.inputValue = value;
    },
    onProfileSelected(profile) {
      this.selectedProfile = profile;
      // A dropdown selection is a deliberate pick — run the check immediately.
      this.check(profile);
    },
    async check(profileArg = null) {
      this.error = null;
      this.result = null;
      this.checking = true;
      this.progress = 'Resolving profile…';

      try {
        let profile = profileArg || this.selectedProfile;

        // No dropdown selection — validate/fetch from the raw input (npub paste).
        if (!profile) {
          const res = await this.$refs.searchInput.validateAndFetch();
          if (!res.valid) {
            this.error = res.error;
            return;
          }
          profile = res.profile;
        }

        const hex = profile.pubkey;
        this.progress = 'Scanning relays for activity…';

        const [activity, profileMap] = await Promise.all([
          nostrService.getProfileActivityDeep(hex, 10, (stage) => {
            this.progress = stage;
          }),
          nostrService.getProfileMetadata([hex]),
        ]);

        // No relay answered — that's a network failure, not a dead account.
        // Reporting a zombie here would be a false positive.
        if (!activity.reachable) {
          this.error =
            "Could not reach any relay to check this user. Check your connection and try again.";
          return;
        }

        const activityMap = new Map([[hex, activity.events]]);
        const zombies = zombieService.classifyZombies(activityMap, profileMap);

        // Find which bucket this pubkey landed in.
        let category = null;
        let info = null;
        for (const cat of ['burned', 'ancient', 'rotting', 'fresh', 'active']) {
          const entry = (zombies[cat] || []).find((z) => z.pubkey === hex);
          if (entry) {
            category = cat;
            info = entry;
            break;
          }
        }

        if (!category) {
          this.error = 'Could not classify this user. Try again.';
          return;
        }

        // Prefer freshly-fetched metadata for display, fall back to search result.
        const meta = profileMap.get(hex) || {};
        const displayProfile = {
          npub: profile.npub || meta.npub,
          picture: meta.picture || profile.picture,
          name: meta.name || profile.name,
          display_name: meta.display_name || profile.display_name,
        };

        this.result = this.buildResult(category, info, displayProfile, meta);
      } catch (e) {
        console.error('Zombie Check failed:', e);
        this.error = e?.message || 'Failed to check this user. Try again.';
      } finally {
        this.checking = false;
        this.progress = '';
      }
    },
    buildResult(category, info, profile, meta = {}) {
      const days = info.daysSinceActivity;

      // Display-only refinement: the core classifier (used by the hunt) lumps
      // everyone under 120 days into "active". For the wellness check we split
      // that bucket — anyone quiet for 2+ months gets a softer "possible
      // infection" warning rather than a clean bill of health. The underlying
      // zombie thresholds are untouched.
      let displayCategory = category;
      if (category === 'active' && days != null && days >= 60) {
        displayCategory = 'infected';
      }

      const display = CATEGORY_DISPLAY[displayCategory] || CATEGORY_DISPLAY.ancient;

      let detail;
      if (category === 'burned') {
        detail = 'This account has been marked as deleted.';
      } else if (displayCategory === 'infected') {
        detail = `Quiet for ${this.formatGone(days)}. Has anyone done a wellness visit lately?`;
      } else if (category === 'active') {
        detail = days != null
          ? `Active — last seen ${this.formatGone(days)} ago.`
          : 'Active recently.';
      } else if (days == null) {
        // The lookup is no longer capped at a year, so this really does mean
        // nothing turned up anywhere we looked.
        detail = 'No activity found on any relay we checked.';
      } else {
        detail = `Gone for ${this.formatGone(days)}.`;
      }

      return {
        ...display,
        // Only set when this platform can't render the emoji itself.
        iconSrc:
          display.iconFallback && !supportsAnatomicalHeart()
            ? display.iconFallback
            : null,
        detail,
        deletionStatus: this.buildDeletionStatus(meta),
        profile,
        displayName: profile.display_name || profile.name || 'Anonymous',
        lastSeenDate: info.lastActivity
          ? format(new Date(info.lastActivity * 1000), 'PP')
          : null,
      };
    },
    buildDeletionStatus(meta) {
      if (meta.deleted) {
        const markedAt = meta.deletionTimeline?.markedDeletedAt ?? meta.firstMarkedDeletedAt;
        const deletedDays = markedAt != null
          ? Math.floor((Date.now() / 1000 - markedAt) / 86400)
          : null;
        return {
          ...DELETION_STATUS_STYLE.current,
          text: deletedDays != null
            ? `This profile is currently flagged as deleted (marked deleted ${this.formatGone(deletedDays)} ago).`
            : 'This profile is currently flagged as deleted.',
        };
      }
      if (meta.everMarkedDeleted) {
        return {
          ...DELETION_STATUS_STYLE.past,
          text: 'A past deletion request was found in this profile\'s history, but it looks like it has since been restored.',
        };
      }
      return {
        ...DELETION_STATUS_STYLE.none,
        text: 'No deletion request found.',
      };
    },
    formatGone(days) {
      if (days == null) return null;
      if (days < 1) return 'less than a day';
      if (days < 30) return `${days} day${days === 1 ? '' : 's'}`;
      if (days < 365) {
        const months = Math.floor(days / 30);
        return `${months} month${months === 1 ? '' : 's'}`;
      }
      const years = Math.floor(days / 365);
      const remMonths = Math.floor((days % 365) / 30);
      const yearStr = `${years} year${years === 1 ? '' : 's'}`;
      return remMonths > 0
        ? `${yearStr}, ${remMonths} month${remMonths === 1 ? '' : 's'}`
        : yearStr;
    },
    shortNpub(npub) {
      if (!npub) return '';
      return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
    },
    onAvatarError(event) {
      event.target.src = '/default-avatar.svg';
    },
    reset() {
      this.result = null;
      this.error = null;
      this.selectedProfile = null;
      this.inputValue = '';
      this.$refs.searchInput?.clear();
    },
  },
};
</script>

<style scoped>
/* "lub-dub" heartbeat — two quick beats, then a rest */
@keyframes heartbeat {
  0%   { transform: scale(1); }
  14%  { transform: scale(1.12); }
  28%  { transform: scale(1); }
  42%  { transform: scale(1.12); }
  56%  { transform: scale(1); }
  100% { transform: scale(1); }
}
.animate-heartbeat {
  animation: heartbeat 1.5s ease-in-out infinite;
  transform-origin: center;
}
@media (prefers-reduced-motion: reduce) {
  .animate-heartbeat { animation: none; }
}
</style>
