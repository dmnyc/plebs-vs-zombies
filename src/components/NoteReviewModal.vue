<template>
  <!-- Teleported to <body>: same reasoning as ConfirmModal — a caller inside
       a .card would make backdrop-filter size the fixed overlay to the card. -->
  <Teleport to="body">
    <Transition name="modal" :duration="300">
      <div
        v-if="show"
        class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
        @click="handleBackdrop"
      >
        <div
          class="bg-zombie-dark border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4 max-h-[85vh] overflow-y-auto"
          @click.stop
        >
          <p class="text-xs text-gray-500 mb-3">Nothing posts until you confirm.</p>

          <!-- The note as a client will show it: renders the same text that
               gets signed, so what people confirm is what gets posted. -->
          <div class="rounded-xl border border-gray-700 bg-gray-800 p-4 text-left">
            <div class="flex items-center gap-2.5 mb-2.5">
              <img
                v-if="authorPicture"
                :src="authorPicture"
                alt=""
                class="w-8 h-8 rounded-full object-cover bg-gray-700 flex-shrink-0"
                @error="$event.target.style.display = 'none'"
              />
              <div
                v-else
                class="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-gray-300 text-sm font-medium flex-shrink-0"
              >
                {{ (authorName || 'U').charAt(0).toUpperCase() }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-gray-200 truncate leading-tight">
                  {{ authorName || 'You' }}
                </p>
                <p class="text-xs text-gray-500 leading-tight">now · via Plebs vs. Zombies</p>
              </div>
            </div>

            <div class="text-[15px] leading-relaxed text-gray-200 whitespace-pre-wrap break-words">
              <template v-for="(part, i) in contentParts" :key="i">
                <span v-if="part.type === 'mention'" class="text-zombie-green font-medium">{{ part.value }}</span>
                <span v-else-if="part.type === 'hashtag'" class="text-zombie-green">{{ part.value }}</span>
                <span v-else-if="part.type === 'url'" class="text-zombie-green underline break-all">{{ part.value }}</span>
                <span v-else>{{ part.value }}</span>
              </template>
            </div>

            <img
              v-if="previewImageUrl"
              :src="previewImageUrl"
              alt="Card attached to the note"
              class="mt-3 w-full rounded-lg border border-gray-700"
            />
          </div>

          <div v-if="hashtagChips.length || footnotes.length" class="mt-3 space-y-2">
            <div v-if="hashtagChips.length" class="flex flex-wrap gap-1.5">
              <span
                v-for="tag in hashtagChips"
                :key="tag"
                class="px-2 py-px rounded-full bg-zombie-green/15 text-xs font-semibold text-zombie-green"
              >
                {{ tag }}
              </span>
            </div>
            <p v-if="footnotes.length" class="text-xs text-gray-500">
              {{ footnotes.join(' ') }}
            </p>
          </div>

          <p
            v-if="error"
            class="mt-3 p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300"
          >
            {{ error }}
          </p>

          <div class="flex gap-3 mt-4">
            <button
              type="button"
              :disabled="posting"
              class="btn-tertiary flex-1 flex items-center justify-center gap-2"
              @click="$emit('back')"
            >
              ← Back
            </button>
            <button
              type="button"
              :disabled="posting"
              class="btn-primary flex-1 flex items-center justify-center gap-2"
              @click="$emit('confirm')"
            >
              <span v-if="posting" class="spinner-sm inline-block"></span>
              <span>{{ posting ? (postingLabel || 'Posting…') : (confirmLabel || 'Post to Nostr') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
// Port of Mutable's NoteReview/NotePreview confirm step: the exact note text
// that will be signed, drawn the way a client shows it (mentions, hashtags,
// URLs, attached image), a summary of what rides along, and Back / Post.
// Nothing is signed or published until the host acts on `confirm`.
const SEGMENT_RE = /(nostr:[a-zA-Z0-9]+|https?:\/\/[^\s]+|#[A-Za-z0-9_]+)/g;

export default {
  name: 'NoteReviewModal',
  props: {
    show: { type: Boolean, default: false },
    content: { type: String, required: true },
    tags: { type: Array, default: () => [] },
    // Display name for the note's nostr: mention; unknown mentions fall
    // back to a shortened key.
    subjectNpub: { type: String, default: '' },
    subjectName: { type: String, default: '' },
    // Names for nostr:npub mentions found in the content; unknown ones fall
    // back to a shortened key.
    mentionNames: { type: Object, default: () => ({}) },
    authorName: { type: String, default: 'You' },
    authorPicture: { type: String, default: '' },
    // Local preview of the note's attached image; the real upload happens
    // on publish, so this never changes what gets signed.
    previewImageUrl: { type: String, default: '' },
    posting: { type: Boolean, default: false },
    postingLabel: { type: String, default: 'Posting…' },
    confirmLabel: { type: String, default: 'Post to Nostr' },
    footnote: { type: String, default: '' },
    error: { type: String, default: '' },
  },
  emits: ['back', 'confirm'],
  computed: {
    contentParts() {
      const parts = [];
      let last = 0;
      let match;
      SEGMENT_RE.lastIndex = 0;
      while ((match = SEGMENT_RE.exec(this.content)) !== null) {
        if (match.index > last) {
          parts.push({ type: 'text', value: this.content.slice(last, match.index) });
        }
        const token = match[0];
        if (token.startsWith('nostr:')) {
          const ref = token.slice(6);
          const label =
            this.mentionNames[ref] ||
            (ref === this.subjectNpub && this.subjectName) ||
            `${ref.slice(0, 10)}…${ref.slice(-4)}`;
          parts.push({ type: 'mention', value: `@${label}` });
        } else if (token.startsWith('#')) {
          parts.push({ type: 'hashtag', value: token });
        } else {
          parts.push({ type: 'url', value: token });
        }
        last = match.index + token.length;
      }
      if (last < this.content.length) {
        parts.push({ type: 'text', value: this.content.slice(last) });
      }
      return parts;
    },
    hashtagChips() {
      return [...new Set(this.tags.filter((t) => t[0] === 't').map((t) => `#${t[1]}`))];
    },
    footnotes() {
      const lines = [];
      if (this.tags.some((t) => t[0] === 'p')) lines.push('Notifies anyone mentioned.');
      if (this.footnote) lines.push(this.footnote);
      return lines;
    },
  },
  methods: {
    handleBackdrop() {
      if (!this.posting) this.$emit('back');
    },
  },
};
</script>
