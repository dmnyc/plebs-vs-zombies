<template>
  <button
    @click="copyToClipboard"
    :class="[
      'inline-flex items-center justify-center w-4 h-4 ml-1 opacity-60 hover:opacity-100 transition-opacity',
      copied ? 'text-green-500' : 'text-gray-400 hover:text-white'
    ]"
    :title="copied ? 'Copied!' : 'Copy npub'"
  >
    <svg v-if="!copied" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
    </svg>
    <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
    </svg>
  </button>
</template>

<script>
import { nip19 } from 'nostr-tools';

export default {
  name: 'CopyButton',
  props: {
    pubkey: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      copied: false
    }
  },
  methods: {
    async copyToClipboard() {
      try {
        // Validate pubkey format first
        if (!this.pubkey || typeof this.pubkey !== 'string' || this.pubkey.length !== 64 || !/^[0-9a-fA-F]+$/i.test(this.pubkey)) {
          console.error('Invalid pubkey format:', this.pubkey, 'length:', this.pubkey?.length);
          alert(`Cannot copy: Invalid pubkey format`);
          return;
        }
        
        const npub = nip19.npubEncode(this.pubkey);
        await navigator.clipboard.writeText(npub);
        this.copied = true;
        setTimeout(() => {
          this.copied = false;
        }, 2000);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        console.error('Pubkey that failed:', this.pubkey, 'type:', typeof this.pubkey, 'length:', this.pubkey?.length);
      }
    }
  }
}
</script>