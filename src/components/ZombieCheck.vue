<template>
  <div>
    <div class="text-center mb-6">
      <div class="text-4xl mb-3">🧟‍♀️🔍</div>
      <h3 class="text-xl mb-2 text-zombie-green">Zombie Check</h3>
      <p class="text-gray-400 text-sm">
        Check whether any Nostr user is a zombie and see how long they've been gone.
      </p>
    </div>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">
          Search for a user or paste an npub:
        </label>
        <ProfileSearchInput
          ref="searchInput"
          placeholder="Search by username or paste npub/nprofile..."
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
    <div
      v-if="result"
      class="mt-6 rounded-lg border-2 p-5"
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
            :href="`https://njump.me/${result.profile.npub}`"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-gray-400 hover:text-gray-200 font-mono truncate block"
          >
            {{ shortNpub(result.profile.npub) }}
          </a>
        </div>
      </div>

      <div class="text-center py-2">
        <div class="text-5xl mb-2">{{ result.emoji }}</div>
        <div class="text-2xl font-bold" :class="result.textClass">{{ result.label }}</div>
        <p class="text-sm text-gray-300 mt-2">{{ result.detail }}</p>
        <p v-if="result.lastSeenDate" class="text-xs text-gray-500 mt-1">
          Last activity: {{ result.lastSeenDate }}
        </p>
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

const CATEGORY_DISPLAY = {
  active: {
    emoji: '🫀',
    label: 'Alive!',
    borderClass: 'border-zombie-green bg-green-900/10',
    textClass: 'text-zombie-green',
  },
  infected: {
    emoji: '💛',
    label: 'Possible Infection',
    borderClass: 'border-yellow-500/50 bg-yellow-900/10',
    textClass: 'text-yellow-300',
  },
  fresh: {
    emoji: '🧟',
    label: 'Fresh Zombie',
    borderClass: 'border-yellow-600/50 bg-yellow-900/10',
    textClass: 'text-yellow-400',
  },
  rotting: {
    emoji: '🧟‍♂️',
    label: 'Rotting Zombie',
    borderClass: 'border-orange-600/50 bg-orange-900/10',
    textClass: 'text-orange-400',
  },
  ancient: {
    emoji: '💀',
    label: 'Ancient Zombie',
    borderClass: 'border-red-700/50 bg-red-900/10',
    textClass: 'text-red-400',
  },
  burned: {
    emoji: '🔥',
    label: 'Burned',
    borderClass: 'border-gray-600 bg-gray-800/40',
    textClass: 'text-gray-300',
  },
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

        const [activityMap, profileMap] = await Promise.all([
          nostrService.getProfilesActivity([hex]),
          nostrService.getProfileMetadata([hex]),
        ]);

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

        this.result = this.buildResult(category, info, displayProfile);
      } catch (e) {
        console.error('Zombie Check failed:', e);
        this.error = e?.message || 'Failed to check this user. Try again.';
      } finally {
        this.checking = false;
        this.progress = '';
      }
    },
    buildResult(category, info, profile) {
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
        detail = 'No activity found in the past year.';
      } else {
        detail = `Gone for ${this.formatGone(days)}.`;
      }

      return {
        ...display,
        detail,
        profile,
        displayName: profile.display_name || profile.name || 'Anonymous',
        lastSeenDate: info.lastActivity
          ? format(new Date(info.lastActivity * 1000), 'PP')
          : null,
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
