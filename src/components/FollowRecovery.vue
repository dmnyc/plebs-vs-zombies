<template>
  <div class="card">
    <div class="flex items-start gap-4 mb-4">
      <div class="text-3xl flex-shrink-0">🛟</div>
      <div class="flex-1 min-w-0">
        <h3 class="text-xl mb-1">Follow List Recovery</h3>
        <p class="text-sm text-gray-400">
          Scan your relays for older versions of your follow list and republish a previous one. Useful when another Nostr client wiped or shrank your follows.
        </p>
      </div>
    </div>

    <!-- Not signed in -->
    <div v-if="!pubkey" class="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-sm text-gray-400">
      Sign in to scan your relays for recoverable follow list versions.
    </div>

    <template v-else>
      <!-- Dev-only: publish an empty kind:3 to simulate a wipe. Rendered above the
           opt-in gate so a dev can wipe → opt in → scan → restore in one session. -->
      <div v-if="isDev" class="mb-4 p-4 border-2 border-dashed border-red-700 rounded-lg bg-red-900/10">
        <h4 class="text-sm font-semibold text-red-300 mb-2">⚠️ Dev only — Publish empty follow list</h4>
        <p class="text-xs text-red-200 mb-3">
          Publishes a real, signed kind:3 event with zero follows for the active account ({{ shortNpub }}). A local backup of your current list is saved first so you can recover from Backup History or by re-scanning. This is gated to {{ devGateLabel }} and will not appear in production builds.
        </p>
        <button
          @click="publishEmptyFollowList"
          :disabled="wiping || !pubkey"
          class="text-sm px-3 py-1.5 bg-red-700 hover:bg-red-600 text-red-100 rounded disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          <span v-if="wiping" class="spinner-sm inline-block"></span>
          <span>{{ wiping ? 'Publishing wipe…' : 'Publish empty kind:3' }}</span>
        </button>
        <p v-if="wipeError" class="text-xs mt-2 text-red-300">{{ wipeError }}</p>
        <p v-if="wipeSuccess" class="text-xs mt-2 text-red-200">{{ wipeSuccess }}</p>
      </div>
    </template>

    <!-- Opt-in gate -->
    <div v-if="pubkey && !optedIn" class="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
        </svg>
        <div class="text-sm text-blue-200">
          <p class="font-medium mb-2">Before you scan</p>
          <ul class="space-y-1 ml-4 list-disc text-blue-300">
            <li>Recovery is best-effort — relays only sometimes retain old versions of replaceable events.</li>
            <li>Restoring will overwrite your current follow list. A local backup of your current list is saved first.</li>
            <li>Your private key never leaves your signer; only a signed kind:3 event is published.</li>
          </ul>
          <button
            @click="optedIn = true"
            class="btn-primary mt-4 text-base"
          >
            I understand — enable scanning
          </button>
        </div>
      </div>
    </div>

    <!-- Scan UI -->
    <template v-if="pubkey && optedIn">
      <div class="flex flex-wrap gap-2 mb-4">
        <button
          @click="scan"
          :disabled="scanning"
          class="btn-primary inline-flex items-center justify-center gap-2"
        >
          <span v-if="scanning" class="spinner-sm inline-block"></span>
          <span>{{ scanning ? 'Scanning…' : (result ? 'Re-scan relays' : 'Scan for recoverable versions') }}</span>
        </button>
      </div>

      <p v-if="progress" class="text-sm text-gray-400 mb-3">{{ progress }}</p>

      <div v-if="error" class="mb-3 p-3 bg-red-900/20 border border-red-700/50 rounded">
        <p class="text-sm text-red-300">{{ error }}</p>
      </div>

      <!-- Detailed success panel after a successful restore -->
      <div v-if="restoreSuccess" class="mb-4 p-5 rounded-lg border-2 border-zombie-green bg-green-900/20 shadow-lg">
        <div class="flex items-start gap-4">
          <div class="text-5xl flex-shrink-0">✅</div>
          <div class="flex-1 min-w-0">
            <h4 class="text-xl font-bold text-green-300 mb-1">Follow list restored!</h4>
            <p class="text-sm text-green-200 mb-3">
              Republished <span class="font-bold text-green-100">{{ restoreSuccess.followCount }}</span> follow{{ restoreSuccess.followCount === 1 ? '' : 's' }}
              · accepted by <span class="font-semibold">{{ restoreSuccess.accepted.length }}/{{ restoreSuccess.total }}</span> relays
              · event <span class="font-mono text-xs">{{ restoreSuccess.eventId.slice(0, 12) }}…</span>
            </p>

            <details class="mt-2">
              <summary class="text-xs text-green-300 cursor-pointer hover:text-green-200">
                Per-relay results
              </summary>
              <div class="mt-2 space-y-1 text-xs font-mono">
                <div v-for="r in restoreSuccess.accepted" :key="r" class="text-green-300">
                  ✓ {{ r }}
                </div>
                <div v-for="r in restoreSuccess.rejected" :key="r.relay" class="text-red-300 break-all">
                  ✗ {{ r.relay }} — {{ r.reason }}
                </div>
              </div>
            </details>

            <p v-if="restoreSuccess.rejected.length" class="text-xs text-green-200/70 mt-3">
              {{ restoreSuccess.rejected.length }} relay{{ restoreSuccess.rejected.length === 1 ? '' : 's' }} rejected the event. Other clients reading from the accepting relays will see your restored follow list. Propagation may take a moment.
            </p>
          </div>
        </div>
      </div>

      <!-- Plain text fallback for non-restore success messages (e.g., the dev wipe) -->
      <div v-if="successMessage" class="mb-3 p-3 bg-green-900/20 border border-green-700/50 rounded">
        <p class="text-sm text-green-300">{{ successMessage }}</p>
      </div>

      <div v-if="result" class="space-y-4">
        <div class="text-sm text-gray-400">
          Scanned {{ result.queriedRelays.length }} relay{{ result.queriedRelays.length === 1 ? '' : 's' }} ·
          {{ result.respondingRelays.length }} returned data ·
          {{ result.candidates.length }} distinct version{{ result.candidates.length === 1 ? '' : 's' }} found
        </div>

        <!-- Recommended -->
        <div v-if="result.recommended">
          <h4 class="text-base font-semibold mb-2 flex items-center gap-2 text-green-400">
            <span>⭐</span>
            <span>Recommended recovery</span>
          </h4>
          <CandidateRow
            :candidate="result.recommended"
            :restoring="restoring"
            @restore="recover(result.recommended)"
          />
          <p v-if="result.current" class="text-xs text-gray-500 mt-2">
            {{ result.recommended.followCount - result.current.followCount }} more follow{{ result.recommended.followCount - result.current.followCount === 1 ? '' : 's' }} than your current list ({{ result.current.followCount }}).
          </p>
          <p v-else class="text-xs text-gray-500 mt-2">
            No current follow list was detected on your relays.
          </p>
        </div>

        <!-- No recoverable -->
        <div v-else-if="result.current" class="p-3 bg-blue-900/20 border border-blue-700/50 rounded">
          <p class="text-sm text-blue-200">
            No older version was found that's larger than your current follow list. Your current list of {{ result.current.followCount }} follow{{ result.current.followCount === 1 ? '' : 's' }} appears to already be the best available.
          </p>
        </div>

        <!-- Empty result -->
        <div v-else class="p-3 bg-gray-800/50 border border-gray-700 rounded">
          <p class="text-sm text-gray-400">
            No follow list events were returned by the queried relays. Try again or add more relays in Settings.
          </p>
        </div>

        <!-- All candidates -->
        <div v-if="result.candidates.length">
          <button
            @click="showAllCandidates = !showAllCandidates"
            class="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1"
          >
            <span>{{ showAllCandidates ? '▼' : '▶' }}</span>
            <span>{{ showAllCandidates ? 'Hide' : 'Show' }} all {{ result.candidates.length }} version{{ result.candidates.length === 1 ? '' : 's' }} found</span>
          </button>
          <div v-if="showAllCandidates" class="mt-3 space-y-2">
            <CandidateRow
              v-for="c in result.candidates"
              :key="c.eventId"
              :candidate="c"
              :restoring="restoring"
              @restore="recover(c)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { format } from 'date-fns';
import { SimplePool } from 'nostr-tools';
import nostrService from '../services/nostrService';
import backupService from '../services/backupService';
import { scanFollowListHistory, recoverFollowList } from '../lib/followRecovery';
import CandidateRow from './FollowRecoveryCandidateRow.vue';

export default {
  name: 'FollowRecovery',
  components: { CandidateRow },
  data() {
    return {
      optedIn: false,
      scanning: false,
      progress: '',
      result: null,
      error: null,
      restoring: null,
      successMessage: null,
      restoreSuccess: null,
      showAllCandidates: false,
      wiping: false,
      wipeError: null,
      wipeSuccess: null
    };
  },
  computed: {
    pubkey() {
      return nostrService.pubkey;
    },
    isDev() {
      return import.meta.env.DEV;
    },
    devGateLabel() {
      return 'import.meta.env.DEV';
    },
    shortNpub() {
      if (!this.pubkey) return '(not signed in)';
      try {
        const npub = nostrService.hexToNpub
          ? nostrService.hexToNpub(this.pubkey)
          : null;
        if (npub) return `${npub.slice(0, 12)}…${npub.slice(-4)}`;
      } catch {
        // fall through
      }
      return `${this.pubkey.slice(0, 8)}…${this.pubkey.slice(-4)}`;
    }
  },
  methods: {
    async scan() {
      if (!this.pubkey) {
        this.error = 'Sign in before scanning.';
        return;
      }
      this.scanning = true;
      this.error = null;
      this.result = null;
      this.progress = 'Connecting to relays…';
      try {
        this.result = await scanFollowListHistory(
          this.pubkey,
          nostrService.relays,
          { onProgress: (m) => { this.progress = m; } }
        );
      } catch (err) {
        this.error = err?.message || 'Failed to scan follow list history.';
      } finally {
        this.scanning = false;
        this.progress = '';
      }
    },
    async publishEmptyFollowList() {
      if (!this.pubkey) return;
      const confirmMsg =
        `DEV WIPE TEST\n\n` +
        `This will publish a SIGNED kind:3 with ZERO follows for ${this.shortNpub}.\n\n` +
        `Other clients will see your follow list as empty until you restore it.\n\n` +
        `A local backup of your current list is saved first. Continue?`;
      if (!window.confirm(confirmMsg)) return;

      this.wiping = true;
      this.wipeError = null;
      this.wipeSuccess = null;

      try {
        const snapshot = await backupService.createBackup(
          'Dev wipe test — pre-wipe snapshot'
        );
        if (!snapshot.success) {
          throw new Error(`Could not save snapshot: ${snapshot.message || 'unknown error'}`);
        }

        const emptyEvent = {
          kind: 3,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: ''
        };
        const signed = await nostrService.signEventWithCurrentMethod(emptyEvent);
        console.log('[FollowRecovery dev wipe] Signed empty kind:3', signed.id);

        // Publish via SimplePool so we read OK responses (matches recoverFollowList).
        const pool = new SimplePool();
        const publishRelays = [...nostrService.relays];
        const settled = await Promise.allSettled(pool.publish(publishRelays, signed));
        try { pool.close(publishRelays); } catch { /* best-effort */ }

        const accepted = [];
        const rejected = [];
        settled.forEach((r, i) => {
          if (r.status === 'fulfilled') accepted.push(publishRelays[i]);
          else rejected.push({ relay: publishRelays[i], reason: String(r.reason?.message || r.reason || 'unknown') });
        });
        console.log('[FollowRecovery dev wipe] Publish results', { accepted, rejected });

        if (accepted.length === 0) {
          const sample = rejected.slice(0, 3).map((r) => `${r.relay}: ${r.reason}`).join(' | ');
          throw new Error(`No relays accepted the empty kind:3. Sample errors: ${sample}`);
        }

        this.wipeSuccess =
          `Published empty kind:3 — accepted by ${accepted.length}/${publishRelays.length} relays` +
          (rejected.length ? ` (${rejected.length} rejected)` : '') +
          `. Click "Scan for recoverable versions" to find prior versions.`;

        // Auto-rescan so the new "current" (empty) state shows up immediately.
        await this.scan();
      } catch (err) {
        this.wipeError = err?.message || 'Failed to publish empty follow list.';
      } finally {
        this.wiping = false;
      }
    },
    async recover(candidate) {
      if (!this.pubkey) return;
      if (candidate.followCount === 0) return;
      if (candidate.isCurrent) return;

      const when = format(new Date(candidate.createdAt * 1000), 'PPpp');
      const msg =
        `Restore this follow list with ${candidate.followCount} follow${candidate.followCount === 1 ? '' : 's'} from ${when}?\n\n` +
        `This will REPLACE your current follow list on relays and publish immediately. A local backup of your current list will be saved first so you can roll back.`;
      if (!window.confirm(msg)) return;

      this.restoring = candidate.eventId;
      this.error = null;
      this.successMessage = null;
      this.restoreSuccess = null;

      try {
        const snapshot = await backupService.createBackup(
          `Auto-snapshot before Follow Recovery (event ${candidate.eventId.slice(0, 8)})`
        );
        if (!snapshot.success) {
          throw new Error(`Could not save local snapshot before restore: ${snapshot.message || 'unknown error'}`);
        }

        const publishResults = await recoverFollowList(candidate, nostrService.relays);

        this.restoreSuccess = {
          followCount: candidate.followCount,
          eventId: publishResults.eventId,
          accepted: publishResults.accepted,
          rejected: publishResults.rejected,
          total: publishResults.total
        };

        // Re-scan so the UI reflects the new current state.
        await this.scan();
      } catch (err) {
        this.error = err?.message || 'Failed to publish recovered follow list.';
      } finally {
        this.restoring = null;
      }
    }
  }
};
</script>
