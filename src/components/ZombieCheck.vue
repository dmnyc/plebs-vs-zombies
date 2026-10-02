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
           rather than relying on whatever's behind it on the page. The share
           actions and "Check another user" button below are deliberately
           outside this frame, so a screenshot of just this card — or the
           html2canvas capture of it — doesn't include them. -->
      <div
        ref="resultCard"
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

      <!-- Share actions: capture the card above as an image, upload it to
           Blossom, and hand the user a finished note / download / link.
           Share as Note is for signed-in users; everyone else gets the
           copy-and-post-yourself path. -->
      <div class="mt-4 grid grid-cols-2 gap-2">
        <button
          @click="shareAsNote"
          :disabled="shareBusy || !canPublishNotes"
          class="btn-primary rounded-lg px-4 py-2 flex items-center justify-center gap-2"
          :class="{ 'opacity-50 cursor-not-allowed': shareBusy || !canPublishNotes }"
        >
          <span v-if="shareBusy" class="spinner-sm inline-block"></span>
          <span>{{ shareBusy ? 'Sharing…' : '📤 Share as Note' }}</span>
        </button>
        <button
          @click="copyNoteText"
          :disabled="shareBusy"
          class="rounded-lg px-4 py-2 text-sm border border-gray-600 text-gray-300 hover:bg-gray-700/40 transition-colors"
          :class="{ 'opacity-50 cursor-not-allowed': shareBusy }"
        >
          {{ copiedNoteText ? '✅ Copied!' : '📋 Copy Note Text' }}
        </button>
        <button
          @click="downloadImage"
          :disabled="shareBusy"
          class="rounded-lg px-4 py-2 text-sm border border-gray-600 text-gray-300 hover:bg-gray-700/40 transition-colors"
          :class="{ 'opacity-50 cursor-not-allowed': shareBusy }"
        >
          ⬇️ Download Image
        </button>
        <button
          @click="copyImageLink"
          :disabled="shareBusy"
          class="rounded-lg px-4 py-2 text-sm border border-gray-600 text-gray-300 hover:bg-gray-700/40 transition-colors"
          :class="{ 'opacity-50 cursor-not-allowed': shareBusy }"
        >
          {{ copiedImageLink ? '✅ Link Copied!' : '🔗 Copy Image Link' }}
        </button>
      </div>
      <label
        class="mt-2 flex items-center justify-center gap-2 text-xs text-gray-400 cursor-pointer select-none"
      >
        <input v-model="shareIncludeImage" type="checkbox" class="accent-zombie-green" />
        Include image link in note
      </label>
      <p
        v-if="!canPublishNotes"
        class="mt-2 text-xs text-center text-gray-500"
      >
        Publishing needs a Nostr signer (NIP-07). Copy the note text to post
        it yourself — tick "Include image link" and the card image attaches
        at the end.
      </p>
      <p
        v-if="shareStatus"
        class="mt-2 text-xs text-center"
        :class="shareStatusKind === 'error' ? 'text-red-400' : 'text-green-400'"
      >
        {{ shareStatus }}
      </p>
      <a
        v-if="publishedNoteId"
        :href="`https://jumble.social/notes/${publishedNoteId}`"
        target="_blank"
        rel="noopener noreferrer"
        class="block mt-2 text-xs text-center text-zombie-green hover:text-green-300 underline"
      >
        View your note ↗
      </a>

      <button
        @click="reset"
        class="btn-secondary w-full mt-4 text-sm"
      >
        Check another user
      </button>
    </div>

    <!-- Off-screen share frame: the PVZ-branded outer shell that only exists
         for the shared PNG (html2canvas can't capture display:none elements,
         so it parks at -10000px). The visible result card above stays as-is;
         at capture time the card is cloned into the verdict slot. Mirrors
         #share-frame in public/zombiecheck.html. -->
    <div
      aria-hidden="true"
      style="position: absolute; top: -10000px; left: -10000px; width: 640px;"
    >
      <div
        ref="shareFrameCard"
        class="rounded-3xl overflow-hidden"
        style="border: 1px solid rgba(92, 219, 92, 0.22); background: radial-gradient(600px 420px at 12% 0%, rgba(92, 219, 92, 0.10), transparent 60%), radial-gradient(560px 400px at 100% 10%, rgba(142, 48, 235, 0.12), transparent 60%), linear-gradient(180deg, #0d1512 0%, #0a0f0c 100%);"
      >
        <div class="flex items-center justify-center gap-3 px-8 pt-7 pb-3">
          <img src="/logo.svg" alt="" class="w-12 h-12 flex-shrink-0" />
          <!-- top: -17px — html2canvas places Creepster text ~17px below the
               flex centerline (browser centers it correctly; measured from
               the captured PNG). The frame is capture-only, so correct it. -->
          <span
            class="font-horror text-zombie-green text-4xl leading-none"
            style="position: relative; top: -17px; text-shadow: 0 0 28px rgba(92, 219, 92, 0.35), 0 2px 12px rgba(0, 0, 0, 0.6); letter-spacing: 0.01em;"
          >Plebs vs. Zombies</span>
        </div>
        <div ref="shareVerdict" class="px-8"></div>
        <div class="px-8 pb-6 pt-5 text-center">
          <span class="text-sm text-gray-500 font-mono">plebsvszombies.cc/zombiecheck</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { nip19 } from 'nostr-tools';
import nostrService from '../services/nostrService';
import zombieService from '../services/zombieService';
import {
  uploadImageToBlossom,
  canvasToBlob,
  loadImageAsBase64,
} from '../services/imageUpload';
import { buildShareNote } from '../lib/sharing/noteText';
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
  none: { icon: '✅', textClass: 'text-gray-200 font-medium' },
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
      // Share flow state. uploadedImageUrl caches the Blossom URL for the
      // current result so repeated share actions don't re-upload.
      shareBusy: false,
      shareStatus: '',
      shareStatusKind: null, // 'success' | 'error' | null
      shareIncludeImage: true,
      copiedNoteText: false,
      uploadedImageUrl: null,
      copiedImageLink: false,
      publishedNoteId: null,
    };
  },
  computed: {
    canPublishNotes() {
      // Either a signing method is already live, or a NIP-07 extension is
      // present and can be connected on demand by publishTextNote().
      return (
        nostrService.isSigningReady() ||
        (nostrService.signingMethod === 'nip07' &&
          typeof window.nostr !== 'undefined')
      );
    },
  },
  mounted() {
    // Deep link: /zombiecheck?npub=… (or ?q=…) pre-fills the search and
    // auto-runs the check, so a shared link replays the check live.
    const query = this.$route?.query || {};
    const shared = String(query.npub || query.q || '').trim();
    if (shared) {
      this.inputValue = shared;
      this.$refs.searchInput?.setValue(shared);
      this.check();
    }
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
      this.clearShareState();
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
          pubkey: hex,
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
    clearShareState() {
      this.shareBusy = false;
      this.shareStatus = '';
      this.shareStatusKind = null;
      this.copiedNoteText = false;
      this.uploadedImageUrl = null;
      this.copiedImageLink = false;
      this.publishedNoteId = null;
    },
    // The shared PNG is built in the off-screen PVZ-branded frame (see the
    // shareFrameCard markup in the template), not captured from the live
    // card directly. The clone gets fixed up for capture-hostile styling:
    // `truncate` (overflow:hidden) clips text bottoms in html2canvas output,
    // and the in-card brand watermark is redundant under the frame's header.
    prepareCardClone() {
      const clone = this.$refs.resultCard.cloneNode(true);
      clone.removeAttribute('id');
      clone.classList.remove('mt-6');
      clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      const watermark = clone.querySelector('.border-t');
      if (watermark) watermark.remove();
      clone.querySelectorAll('.truncate').forEach((n) => {
        n.classList.remove('truncate');
        n.style.overflow = 'visible';
        n.style.whiteSpace = 'normal';
        n.style.overflowWrap = 'anywhere';
      });
      return clone;
    },
    async captureResultCard() {
      if (!this.$refs.resultCard) {
        throw new Error('Result card is not rendered.');
      }
      const verdictSlot = this.$refs.shareVerdict;
      verdictSlot.innerHTML = '';
      const clone = this.prepareCardClone();
      // Proxied data-URL avatar: html2canvas cannot read pixels back from a
      // cross-origin image, and a tainted canvas would fail later at toBlob
      // with no useful error. Falls back to the local default avatar.
      const picture = this.result.profile.picture;
      const proxied = picture ? await loadImageAsBase64(picture) : null;
      const avatarImg = clone.querySelector('img');
      if (avatarImg) avatarImg.src = proxied || '/default-avatar.svg';
      verdictSlot.appendChild(clone);
      // Let the avatar decode and layout settle before rasterizing.
      await this.$nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const canvas = await html2canvas(this.$refs.shareFrameCard, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      return await canvasToBlob(canvas);
    },
    async ensureShareImage() {
      if (this.uploadedImageUrl) return this.uploadedImageUrl;
      const blob = await this.captureResultCard();
      const filename = `zombie-check-${(this.result.profile.npub || 'result').slice(0, 20)}.png`;
      // Sign the BUD-01 upload auth with the user's identity when one is
      // ready; otherwise upload anonymously with a throwaway key — either
      // way the visitor is prompted at most once.
      const signer = nostrService.isSigningReady()
        ? { signEvent: (e) => nostrService.signEventWithCurrentMethod(e) }
        : undefined;
      const res = await uploadImageToBlossom({ blob, filename, signer });
      this.uploadedImageUrl = res.url;
      return res.url;
    },
    async shareAsNote() {
      if (!this.result || this.shareBusy) return;
      // Publishing is signed-in territory; unsigned visitors have the hint
      // and the Copy Note Text button instead.
      if (!this.canPublishNotes) return;
      this.shareBusy = true;
      this.shareStatus = 'Rendering image…';
      this.shareStatusKind = null;
      this.publishedNoteId = null;
      try {
        const imageUrl = this.shareIncludeImage ? await this.ensureShareImage() : null;
        const { content, tags } = buildShareNote(this.result, { imageUrl });

        this.shareStatus = 'Publishing note…';
        const res = await nostrService.publishTextNote(content, tags);
        if (!res.success) {
          throw new Error('Failed to publish to any relays. Try again.');
        }
        this.publishedNoteId = nip19.noteEncode(res.eventId);
        this.shareStatusKind = 'success';
        this.shareStatus = `Note published to ${res.publishedToRelays} relay${res.publishedToRelays === 1 ? '' : 's'}!`;
      } catch (e) {
        console.error('Share as note failed:', e);
        this.shareStatusKind = 'error';
        this.shareStatus = e?.message || 'Sharing failed. Try again.';
      } finally {
        this.shareBusy = false;
      }
    },
    async copyNoteText() {
      if (!this.result || this.shareBusy) return;
      // With "Include image link" on, the card is rendered, uploaded to
      // Blossom, and its URL attaches at the end of the text — so the pasted
      // note carries the image without any manual attaching. The upload is
      // cached and shared with the other share actions.
      this.shareBusy = true;
      this.shareStatusKind = null;
      this.publishedNoteId = null;
      if (this.shareIncludeImage) this.shareStatus = 'Uploading image…';
      try {
        const imageUrl = this.shareIncludeImage ? await this.ensureShareImage() : null;
        const { content } = buildShareNote(this.result, { imageUrl });
        await navigator.clipboard.writeText(content);
        this.copiedNoteText = true;
        this.shareStatus = '';
        setTimeout(() => {
          this.copiedNoteText = false;
        }, 2000);
      } catch (e) {
        console.error('Note text copy failed:', e);
        this.shareStatusKind = 'error';
        this.shareStatus = e?.message || 'Could not copy the note text. Try again.';
      } finally {
        this.shareBusy = false;
      }
    },
    async downloadImage() {
      if (!this.result || this.shareBusy) return;
      this.shareBusy = true;
      this.shareStatus = 'Rendering image…';
      this.shareStatusKind = null;
      try {
        const blob = await this.captureResultCard();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `zombie-check-${(this.result.profile.npub || 'result').slice(0, 20)}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        this.shareStatus = '';
      } catch (e) {
        console.error('Image download failed:', e);
        this.shareStatusKind = 'error';
        this.shareStatus = e?.message || 'Could not render the image. Try again.';
      } finally {
        this.shareBusy = false;
      }
    },
    async copyImageLink() {
      if (!this.result || this.shareBusy || this.copiedImageLink) return;
      this.shareBusy = true;
      this.shareStatus = 'Uploading image…';
      this.shareStatusKind = null;
      try {
        const url = await this.ensureShareImage();
        await navigator.clipboard.writeText(url);
        this.copiedImageLink = true;
        this.shareStatus = '';
        setTimeout(() => {
          this.copiedImageLink = false;
        }, 2000);
      } catch (e) {
        console.error('Image link copy failed:', e);
        this.shareStatusKind = 'error';
        this.shareStatus = e?.message || 'Upload failed. Try again.';
      } finally {
        this.shareBusy = false;
      }
    },
    reset() {
      this.result = null;
      this.error = null;
      this.selectedProfile = null;
      this.inputValue = '';
      this.clearShareState();
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
