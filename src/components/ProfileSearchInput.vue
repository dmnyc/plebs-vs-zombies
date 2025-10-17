<template>
  <div class="relative">
    <input
      ref="input"
      v-model="inputValue"
      type="text"
      :placeholder="placeholder"
      :class="inputClass"
      class="input w-full"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeydown"
      :disabled="disabled"
    />

    <!-- Validation feedback -->
    <div v-if="validationMessage" :class="validationMessageClass" class="text-xs mt-1">
      {{ validationMessage }}
    </div>

    <!-- Dropdown with suggestions -->
    <div
      v-if="showDropdown && (suggestions.length > 0 || searching)"
      class="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto"
      @mousedown.prevent
    >
      <!-- Loading state -->
      <div v-if="searching" class="p-3 text-center text-gray-400 text-sm">
        <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400 mr-2"></div>
        Searching...
      </div>

      <!-- Suggestions -->
      <div
        v-for="(profile, index) in suggestions"
        :key="profile.pubkey"
        @click="selectProfile(profile)"
        @mouseenter="highlightedIndex = index"
        :class="{
          'bg-gray-700': highlightedIndex === index,
          'hover:bg-gray-700': highlightedIndex !== index
        }"
        class="p-3 cursor-pointer transition-colors border-b border-gray-700 last:border-b-0"
      >
        <div class="flex items-center gap-3">
          <!-- Avatar -->
          <div class="flex-shrink-0">
            <img
              v-if="profile.picture"
              :src="profile.picture"
              :alt="profile.display_name || profile.name"
              class="w-10 h-10 rounded-full object-cover"
              @error="$event.target.style.display='none'"
            />
            <div
              v-else
              class="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-gray-300 text-sm font-medium"
            >
              {{ (profile.display_name || profile.name || 'U').charAt(0).toUpperCase() }}
            </div>
          </div>

          <!-- Profile info -->
          <div class="flex-grow min-w-0">
            <div class="font-medium text-white truncate">
              {{ profile.display_name || profile.name || 'Unknown Profile' }}
            </div>
            <div v-if="profile.nip05" class="text-xs text-gray-400 truncate">
              {{ profile.nip05 }}
            </div>
            <div v-else class="font-mono text-xs text-gray-500 truncate">
              {{ formatNpub(profile.npub) }}
            </div>
            <div v-if="!profile.name && !profile.display_name" class="text-xs text-yellow-400 mt-0.5">
              Profile metadata not available
            </div>
          </div>
        </div>
      </div>

      <!-- No results -->
      <div v-if="!searching && suggestions.length === 0 && inputValue.length >= 2" class="p-3 text-center text-gray-400 text-sm">
        No profiles found
      </div>
    </div>
  </div>
</template>

<script>
import profileSearchService from '../services/profileSearchService';

export default {
  name: 'ProfileSearchInput',
  props: {
    placeholder: {
      type: String,
      default: 'Search by username or paste npub/nprofile...'
    },
    disabled: {
      type: Boolean,
      default: false
    },
    autoFocus: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      inputValue: '',
      suggestions: [],
      highlightedIndex: -1,
      showDropdown: false,
      searching: false,
      validationMessage: '',
      validationState: null, // 'valid', 'error', null
      selectedProfile: null
    };
  },
  watch: {
    // Emit input value changes so parent can enable/disable buttons
    inputValue(newValue) {
      this.$emit('input-changed', newValue.trim());
    }
  },
  computed: {
    inputClass() {
      if (this.validationState === 'valid') {
        return 'border-green-500';
      } else if (this.validationState === 'error') {
        return 'border-red-500';
      }
      return '';
    },
    validationMessageClass() {
      if (this.validationState === 'valid') {
        return 'text-green-400';
      } else if (this.validationState === 'error') {
        return 'text-red-400';
      }
      return 'text-gray-400';
    }
  },
  methods: {
    async handleInput() {
      const value = this.inputValue.trim();

      // Reset state
      this.validationMessage = '';
      this.validationState = null;
      this.selectedProfile = null;

      // Empty input
      if (!value) {
        this.suggestions = [];
        this.showDropdown = false;
        return;
      }

      // Check if it's an npub or nprofile (instant validation)
      if (value.startsWith('npub1') || value.startsWith('nprofile1')) {
        const parsed = profileSearchService.parseIdentifier(value);

        if (parsed) {
          // Valid format, try to fetch profile
          this.searching = true;
          this.showDropdown = true;

          try {
            const profile = await profileSearchService.fetchProfile(parsed.pubkey, parsed.relays);

            if (profile) {
              this.suggestions = [profile];
              this.validationMessage = '✅ Valid profile identifier';
              this.validationState = 'valid';
            } else {
              // Profile metadata not found, but npub is valid - create minimal profile
              const { nip19 } = await import('nostr-tools');
              const minimalProfile = {
                pubkey: parsed.pubkey,
                npub: nip19.npubEncode(parsed.pubkey),
                name: null,
                display_name: null,
                picture: null,
                nip05: null,
                about: null
              };
              this.suggestions = [minimalProfile];
              this.validationMessage = '✅ Valid npub (profile metadata not found, but you can still proceed)';
              this.validationState = 'valid';
            }
          } catch (error) {
            console.error('Failed to fetch profile:', error);
            // Even on error, if we have a valid npub format, allow proceeding
            const { nip19 } = await import('nostr-tools');
            const minimalProfile = {
              pubkey: parsed.pubkey,
              npub: nip19.npubEncode(parsed.pubkey),
              name: null,
              display_name: null,
              picture: null,
              nip05: null,
              about: null
            };
            this.suggestions = [minimalProfile];
            this.validationMessage = '✅ Valid npub format (could not fetch metadata, but you can still proceed)';
            this.validationState = 'valid';
          } finally {
            this.searching = false;
          }
        } else if (value.length >= 63) {
          // Looks like an npub but invalid format
          this.validationMessage = '❌ Invalid npub/nprofile format';
          this.validationState = 'error';
          this.suggestions = [];
          this.showDropdown = false;
        }
      } else if (value.length >= 2) {
        // Username search with progressive results
        this.searching = true;
        this.showDropdown = true;
        this.suggestions = []; // Clear previous results

        try {
          // Progressive callback to show results as they arrive
          const onResult = (profile) => {
            // Add profile to suggestions as soon as it's found
            this.suggestions.push(profile);
          };

          const results = await profileSearchService.debouncedSearch(value, 15, onResult);

          // Update with final results (in case any were added after callback)
          this.suggestions = results;

          if (results.length === 0) {
            this.validationMessage = 'No profiles found - try entering an npub';
            this.validationState = null;
          }
        } catch (error) {
          console.error('Search failed:', error);
          this.suggestions = [];
        } finally {
          this.searching = false;
        }
      }
    },
    handleFocus() {
      if (this.inputValue.trim().length >= 2) {
        this.showDropdown = true;
      }
    },
    handleBlur() {
      // Delay hiding dropdown to allow click events to fire
      setTimeout(() => {
        this.showDropdown = false;
      }, 200);
    },
    handleKeydown(event) {
      if (!this.showDropdown || this.suggestions.length === 0) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.highlightedIndex = Math.min(
            this.highlightedIndex + 1,
            this.suggestions.length - 1
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
          break;
        case 'Enter':
          event.preventDefault();
          if (this.highlightedIndex >= 0 && this.suggestions[this.highlightedIndex]) {
            this.selectProfile(this.suggestions[this.highlightedIndex]);
          }
          break;
        case 'Escape':
          this.showDropdown = false;
          this.highlightedIndex = -1;
          break;
      }
    },
    selectProfile(profile) {
      this.selectedProfile = profile;
      // Show npub if no name/display_name (don't truncate - we need the full npub for validation)
      const displayText = profile.display_name || profile.name || profile.npub;
      this.inputValue = displayText;
      this.showDropdown = false;
      this.highlightedIndex = -1;
      this.validationMessage = '✅ Profile selected';
      this.validationState = 'valid';

      // Emit the selected profile
      this.$emit('profile-selected', profile);
    },
    formatNpub(npub) {
      if (!npub) return '';
      if (npub.length <= 20) return npub;
      return npub.substring(0, 12) + '...' + npub.substring(npub.length - 8);
    },
    clear() {
      this.inputValue = '';
      this.suggestions = [];
      this.highlightedIndex = -1;
      this.showDropdown = false;
      this.validationMessage = '';
      this.validationState = null;
      this.selectedProfile = null;
    },
    focus() {
      this.$refs.input?.focus();
    },
    getValue() {
      return this.inputValue.trim();
    },
    getSelectedProfile() {
      return this.selectedProfile;
    },
    async validateAndFetch() {
      const value = this.inputValue.trim();

      if (!value) {
        return { valid: false, error: 'Please enter a username or npub' };
      }

      // Check if it's an npub or nprofile
      if (value.startsWith('npub1') || value.startsWith('nprofile1')) {
        const parsed = profileSearchService.parseIdentifier(value);

        if (!parsed) {
          return { valid: false, error: 'Invalid npub/nprofile format' };
        }

        // Valid format, try to fetch profile
        try {
          const profile = await profileSearchService.fetchProfile(parsed.pubkey, parsed.relays);

          if (profile) {
            return { valid: true, profile };
          } else {
            // Create minimal profile
            const { nip19 } = await import('nostr-tools');
            const minimalProfile = {
              pubkey: parsed.pubkey,
              npub: nip19.npubEncode(parsed.pubkey),
              name: null,
              display_name: null,
              picture: null,
              nip05: null,
              about: null
            };
            return { valid: true, profile: minimalProfile };
          }
        } catch (error) {
          console.error('Failed to fetch profile:', error);
          // Still return minimal profile on error
          const { nip19 } = await import('nostr-tools');
          const minimalProfile = {
            pubkey: parsed.pubkey,
            npub: nip19.npubEncode(parsed.pubkey),
            name: null,
            display_name: null,
            picture: null,
            nip05: null,
            about: null
          };
          return { valid: true, profile: minimalProfile };
        }
      }

      // Not an npub, must be a username - user should select from dropdown
      return { valid: false, error: 'Please select a profile from the search results or enter a valid npub/nprofile' };
    }
  },
  mounted() {
    if (this.autoFocus) {
      this.$nextTick(() => {
        this.focus();
      });
    }
  }
};
</script>

<style scoped>
/* Ensure dropdown scrollbar styling */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #1f2937;
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}
</style>
