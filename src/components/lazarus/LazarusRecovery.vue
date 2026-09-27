<template>
  <!-- text-pretty is inherited: the global rule covers only p and li, and
       most text here sits in labels, spans, and notices. -->
  <div v-if="pubkey" id="lazarus-recovery" class="card text-pretty">
    <div class="flex items-start gap-4">
      <div class="flex-shrink-0 text-3xl" aria-hidden="true">🛟</div>
      <div class="min-w-0 flex-1">
        <h3 class="mb-1 text-xl">Recover from relay history</h3>
        <p class="text-sm text-gray-300">
          Relays often keep older versions of your lists and profile after a client
          overwrites them. Scan for those versions and restore one. Unlike relay
          backups, this needs no backup made in advance. Scans are read-only:
          nothing is published until you review the change and confirm.
        </p>
        <p class="mt-1 text-xs text-gray-500">
          Follows the
          <a
            href="https://github.com/dmnyc/lazarus"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-gray-300"
          >Lazarus</a>
          recovery spec (0.6.2-draft).
        </p>

        <!-- Dev only: stands in for a client that clobbers the follow list, so
             a scan and restore can be tried end to end. -->
        <div v-if="isDev" class="mt-4 rounded-lg border-2 border-dashed border-red-700 bg-red-900/10 p-4">
          <h4 class="mb-2 text-sm font-semibold text-red-300">⚠️ Dev only: publish an empty follow list</h4>
          <p class="mb-3 text-xs text-red-200">
            Publishes a real, signed kind:3 with zero follows for the active account to
            your write relays, the way a clobbering client would. A local backup of your
            current list is saved first. This never appears in production builds.
          </p>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded bg-red-700 px-3 py-1.5 text-sm text-red-100 hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="wiping"
            @click="publishEmptyFollowList"
          >
            <span v-if="wiping" class="spinner-sm"></span>
            {{ wiping ? "Publishing wipe…" : "Publish empty kind:3" }}
          </button>
          <p v-if="wipeResult" class="mt-2 text-xs text-red-200">{{ wipeResult }}</p>
        </div>

        <div
          v-if="banner"
          class="mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm"
          :class="banner.tone === 'success'
            ? 'border-zombie-green/40 bg-zombie-green/10 text-gray-100'
            : 'border-red-700/60 bg-red-900/20 text-red-200'"
        >
          <span aria-hidden="true">{{ banner.tone === "success" ? "✅" : "✗" }}</span>
          <span class="min-w-0 flex-1">{{ banner.text }}</span>
          <button type="button" class="text-xs underline" @click="banner = null">
            Dismiss
          </button>
        </div>

        <div class="mt-4 rounded-lg border border-gray-700 p-4">
          <div class="text-sm font-medium text-gray-100">Your events as JSON</div>
          <p class="mt-1 text-xs text-gray-400">
            Download the newest signed version of each list below to keep offline.
            Import a file later to review and restore any version it holds. Imports
            are checked: only versions signed by this account are kept.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="btn-primary inline-flex items-center gap-2"
              :disabled="exporting"
              @click="exportData"
            >
              <span v-if="exporting" class="spinner-sm"></span>
              {{ exporting ? "Collecting your data…" : "Download my data" }}
            </button>
            <label class="btn-secondary inline-flex cursor-pointer items-center gap-2">
              Import JSON
              <input
                type="file"
                accept=".json,application/json"
                class="hidden"
                data-testid="lazarus-import"
                @change="importFile"
              />
            </label>
          </div>
        </div>

        <div v-if="usesRemoteSigner()" class="mt-4 flex items-start gap-2 rounded-lg border border-gray-700 p-3 text-xs text-gray-400">
          <span aria-hidden="true">ℹ️</span>
          You're signed in with a remote signer. Lists over 64 KB, like a mute list
          with many private items or a big follow list, can't be decrypted or
          restored through NIP-46. Use a browser extension (NIP-07) for those.
        </div>
        <div v-if="!canRestore()" class="mt-4 flex items-start gap-2 rounded-lg border border-gray-700 p-3 text-xs text-gray-400">
          <span aria-hidden="true">ℹ️</span>
          Your signer isn't connected, so you can scan and download versions but not
          restore them yet.
        </div>

        <div class="mt-5">
          <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Choose what to recover
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="kindProfile in primaryKinds"
              :key="kindProfile.kind"
              type="button"
              :aria-pressed="kindProfile.kind === selectedKind"
              :class="chipClass(kindProfile)"
              @click="selectKind(kindProfile.kind)"
            >
              {{ kindProfile.name }}
              <span
                v-if="hasFix(kindProfile.kind)"
                class="h-2 w-2 rounded-full"
                :class="kindProfile.kind === selectedKind ? 'bg-zombie-dark' : 'bg-zombie-green'"
                title="A restore is recommended"
              ></span>
              <span
                v-if="savedCount(kindProfile.kind) > 0"
                class="rounded px-1 text-[11px]"
                :class="kindProfile.kind === selectedKind ? 'bg-black/20' : 'bg-gray-700'"
                :title="`${savedCount(kindProfile.kind)} saved on this device`"
              >
                {{ savedCount(kindProfile.kind) }}
              </span>
            </button>
            <button
              type="button"
              :aria-expanded="showAdvanced"
              class="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:text-gray-100"
              @click="showAdvanced = !showAdvanced"
            >
              Advanced
              <span aria-hidden="true">{{ showAdvanced ? "▴" : "▾" }}</span>
            </button>
          </div>
          <div v-if="showAdvanced" class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="kindProfile in advancedKinds"
              :key="kindProfile.kind"
              type="button"
              :aria-pressed="kindProfile.kind === selectedKind"
              :class="chipClass(kindProfile)"
              @click="selectKind(kindProfile.kind)"
            >
              {{ kindProfile.name }}
              <span
                v-if="hasFix(kindProfile.kind)"
                class="h-2 w-2 rounded-full"
                :class="kindProfile.kind === selectedKind ? 'bg-zombie-dark' : 'bg-zombie-green'"
                title="A restore is recommended"
              ></span>
              <span
                v-if="savedCount(kindProfile.kind) > 0"
                class="rounded px-1 text-[11px]"
                :class="kindProfile.kind === selectedKind ? 'bg-black/20' : 'bg-gray-700'"
                :title="`${savedCount(kindProfile.kind)} saved on this device`"
              >
                {{ savedCount(kindProfile.kind) }}
              </span>
            </button>
          </div>
        </div>

        <div class="mt-4 rounded-lg border border-gray-700 p-4">
          <div class="font-medium text-gray-100">{{ profile.name }}</div>
          <div class="text-xs text-gray-400">{{ kindDescription }}</div>

          <p v-if="profile.tier === 3" class="mt-2 text-xs text-yellow-400">
            Advanced: an old relay list can point at relays that no longer exist and
            quietly break delivery.
          </p>

          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              class="btn-primary inline-flex items-center gap-2"
              :disabled="kindState.phase === 'scanning'"
              @click="runScan(selectedKind)"
            >
              <span v-if="kindState.phase === 'scanning'" class="spinner-sm"></span>
              {{ scanButtonLabel }}
            </button>
            <span v-if="kindState.phase === 'idle'" class="text-sm text-gray-400">
              Checks your relays, Plebs vs. Zombies' default relays, and archival
              relays for every version that survives.
            </span>
            <span v-if="kindState.phase === 'scanning'" class="text-sm text-gray-400">
              Asking your relays, the defaults, and archival relays…
            </span>
          </div>

          <LazarusNotice v-if="kindState.phase === 'error'" tone="red" class="mt-3">
            The scan failed: no relay answered. Check your connection and scan again.
          </LazarusNotice>

          <div v-if="kindState.phase === 'done' && scan" class="mt-3 space-y-3">
            <div v-if="scan.relayOutcomes" class="text-xs text-gray-400">
              <div class="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  :aria-expanded="showRelays"
                  class="flex items-center gap-1 hover:text-gray-100"
                  @click="showRelays = !showRelays"
                >
                  {{ answeredCount }} of {{ scan.queriedRelays.length }} relays answered
                  <span aria-hidden="true">{{ showRelays ? "▴" : "▾" }}</span>
                </button>
                <button
                  v-if="unansweredCount > 0"
                  type="button"
                  class="flex items-center gap-1 underline hover:text-gray-100 disabled:opacity-50"
                  :disabled="kindState.retrying"
                  @click="retryFailedRelays(selectedKind)"
                >
                  <span :class="{ 'animate-spin': kindState.retrying }" aria-hidden="true">⟳</span>
                  Retry {{ unansweredCount }} {{ unansweredCount === 1 ? "relay" : "relays" }}
                </button>
              </div>
              <ul v-if="showRelays" class="mt-2 space-y-0.5">
                <li v-for="url in scan.queriedRelays" :key="url" class="flex justify-between gap-3">
                  <span class="min-w-0 truncate">
                    {{ shortRelay(url) }}
                    <span
                      v-if="writeSet.has(url)"
                      class="ml-1.5 rounded bg-gray-700 px-1 text-[10px] font-semibold uppercase"
                    >
                      {{ scan.relayList === "missing" ? "default write" : "write" }}
                    </span>
                  </span>
                  <span
                    class="flex-shrink-0"
                    :class="{ 'text-zombie-green': outcomes[url] === 'answered' }"
                  >
                    {{ outcomeLabel(outcomes[url]) }}
                  </span>
                </li>
              </ul>
            </div>

            <LazarusNotice v-if="reachedNoRelay">
              No relay finished answering, so these versions may be incomplete. Scan
              again to retry.
            </LazarusNotice>
            <LazarusNotice v-else-if="!scan.currentConfirmed">
              {{ scan.relayList === "unknown"
                ? "Couldn't fetch your relay list, so the newest version found may not be current and nothing is recommended. Scan again to retry."
                : "None of your write relays answered, so the newest version found may not be current and nothing is recommended. Retry them, or scan again." }}
            </LazarusNotice>
            <LazarusNotice v-if="scan.relayList === 'missing'">
              No relay list was found for your account, so Plebs vs. Zombies' default
              relays stand in as your write relays.
            </LazarusNotice>

            <p v-if="scan.candidates.length === 0" class="text-sm text-gray-400">
              No versions found. The relays that answered hold no history of this list.
            </p>
            <template v-else>
              <LazarusNotice v-if="scan.requiresIntentConfirmation">
                An empty list can be intentional here, so nothing is recommended.
                Choose the version you actually want.
              </LazarusNotice>
              <p v-if="decryptingIds.size > 0" class="flex items-center gap-2 text-xs text-gray-400">
                <span class="spinner-sm"></span>
                Decrypting private items…
              </p>

              <div
                v-if="scan.recommended"
                class="rounded-lg border border-zombie-green/40 bg-zombie-green/5 px-3"
              >
                <div class="pt-2 text-xs font-semibold text-zombie-green">
                  Your current version looks clobbered. This is the fullest version
                  from before the damage:
                </div>
                <LazarusVersionRow v-bind="rowProps(scan.recommended)" v-on="rowHandlers()" />
              </div>
              <p
                v-else-if="sortable && scan.currentConfirmed"
                class="text-sm text-gray-400"
              >
                No recoverable improvement found: your current version doesn't look
                clobbered.
              </p>

              <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                <span>
                  {{ scan.candidates.length }}
                  {{ scan.candidates.length === 1 ? "version" : "versions" }} found
                </span>
                <div class="flex items-center gap-3">
                  <label v-if="sortable && scan.candidates.length > 1" class="flex items-center gap-1.5">
                    Sort by
                    <select
                      v-model="sortBy"
                      class="rounded border border-gray-600 bg-transparent px-1.5 py-0.5"
                    >
                      <option value="date" class="bg-zombie-dark">Date</option>
                      <option value="size" class="bg-zombie-dark">Size</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    class="underline hover:text-gray-100"
                    @click="downloadVersions(`${profile.name} all versions`, scan.candidates.map((c) => c.event))"
                  >
                    Download all versions
                  </button>
                </div>
              </div>

              <div class="divide-y divide-gray-700/60">
                <template v-if="bySize">
                  <LazarusVersionRow
                    v-for="candidate in bySize"
                    :key="candidate.event.id"
                    v-bind="rowProps(candidate)"
                    v-on="rowHandlers()"
                  />
                </template>
                <template v-else>
                  <template v-for="item in listItems" :key="itemKey(item)">
                    <LazarusVersionRow
                      v-if="item.type === 'version'"
                      v-bind="rowProps(item.candidate)"
                      v-on="rowHandlers()"
                    />
                    <LazarusVersionGroup
                      v-else
                      :kind="profile.kind"
                      :candidates="item.candidates"
                      :clobbered="item.clobbered"
                      :expanded="expandedGroups.has(item.candidates[0].event.id)"
                      @toggle="toggleGroup(item.candidates[0].event.id)"
                    >
                      <LazarusVersionRow
                        v-for="candidate in item.candidates"
                        :key="candidate.event.id"
                        v-bind="rowProps(candidate)"
                        v-on="rowHandlers()"
                      />
                    </LazarusVersionGroup>
                  </template>
                </template>
              </div>

              <button
                v-if="pastEmptyCount > 0"
                type="button"
                class="text-xs text-gray-400 underline hover:text-gray-100"
                @click="showEmpty = !showEmpty"
              >
                {{ showEmpty
                  ? "Hide empty versions"
                  : `Show ${pastEmptyCount} empty ${pastEmptyCount === 1 ? "version" : "versions"}` }}
              </button>
              <button
                v-if="Object.keys(scan.olderCursors || {}).length > 0"
                type="button"
                class="btn-tertiary flex w-full items-center justify-center gap-2"
                :disabled="kindState.loadingOlder"
                @click="loadOlder"
              >
                <span v-if="kindState.loadingOlder" class="spinner-sm"></span>
                Load older versions
              </button>
            </template>
          </div>

          <div v-if="archiveForKind.length > 0" class="mt-4 border-t border-gray-700 pt-3">
            <div class="text-sm font-medium text-gray-100">
              Saved on this device ({{ archiveForKind.length }})
            </div>
            <p class="text-xs text-gray-400">
              Snapshots taken before each restore, and versions you imported.
              Reviewing one compares it with your current version on relays.
            </p>
            <div class="divide-y divide-gray-700/60">
              <LazarusVersionRow
                v-for="entry in archiveForKind"
                :key="`saved-${entry.event.id}`"
                v-bind="rowProps(savedCandidate(entry))"
                :source-label="savedSourceLabel(entry)"
                deletable
                @review="(c) => openReview(selectedKind, c, `Saved on this device: ${savedOrigin(entry)}`)"
                @download="downloadOne"
                @retry-decrypt="retryDecrypt"
                @delete="deleteSaved(entry)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <LazarusReviewDialog
      v-if="review"
      :key="review.key"
      :review="review"
      @close="closeReview"
      @confirm="confirmRestore"
    />
  </div>
</template>

<script>
import { markRaw } from "vue";
import { verifyEvent } from "nostr-tools";
import backupService from "../../services/backupService.js";
import nostrService from "../../services/nostrService.js";
import {
  applyLazarusPrivateTags,
  buildExportBundle,
  buildLazarusRecoveryDraft,
  checkLazarusCurrent,
  computeLazarusDelta,
  computeLazarusProfileChanges,
  countLazarusItems,
  createLazarusRelaySource,
  downloadJson,
  fetchLatestVersions,
  fetchLazarusVersionsFrom,
  fitsLazarusRemoteRestore,
  fitsNip46Request,
  getContentEncryption,
  getDeliberateEditIds,
  getLazarusKindProfile,
  getLazarusKindProfiles,
  getLazarusScanPlan,
  groupLazarusCandidates,
  isPastEmptyVersion,
  LAZARUS_ARCHIVAL_RELAYS,
  lazarusFileName,
  lazarusScanReachedNoRelay,
  listArchive,
  loadOlderLazarusVersions,
  markDeliberateEdit,
  mergeLazarusRetry,
  parseImportedEvents,
  parsePrivateTags,
  parseRelayListEvent,
  publishLazarusRecovery,
  readLazarusCurrent,
  removeFromArchive,
  resolveLazarusRelays,
  saveToArchive,
  scanLazarusKind,
  sortLazarusCandidates,
} from "../../lib/lazarus/index.js";
import * as signer from "../../lib/lazarus/signer.js";
import {
  applyRestoreLocally,
  snapshotFollowListToBackups,
} from "../../lib/lazarus/local.js";
import LazarusNotice from "./LazarusNotice.vue";
import LazarusReviewDialog from "./LazarusReviewDialog.vue";
import LazarusVersionGroup from "./LazarusVersionGroup.vue";
import LazarusVersionRow from "./LazarusVersionRow.vue";
import { formatDate, shortRelay } from "./format.js";

const KIND_PROFILES = getLazarusKindProfiles();
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const HEX_PUBKEY = /^[0-9a-f]{64}$/;
// Defaults that can't hold the user's newest version, so they never stand in
// as write relays: nostr.wine takes posts only from paying members, and
// purplepag.es stores only a few kinds.
const READ_ONLY_DEFAULTS = new Set(["wss://nostr.wine", "wss://purplepag.es"]);

const KIND_DESCRIPTIONS = {
  3: "Who you follow",
  10000: "Accounts, words, hashtags, and threads you mute",
  0: "Your name, picture, bio, and other profile fields",
  10003: "Notes and articles you saved",
  10044: "Keys clients use to encrypt DMs to you (NIP-4e)",
  10002: "Where clients read and publish your notes (NIP-65)",
  10050: "Where you receive private DMs (NIP-17)",
  10006: "Relays you chose to block",
};

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}

export default {
  name: "LazarusRecovery",
  components: {
    LazarusNotice,
    LazarusReviewDialog,
    LazarusVersionGroup,
    LazarusVersionRow,
  },
  emits: ["backups-changed"],
  data() {
    return {
      pubkey: signer.sessionPubkey(),
      selectedKind: 3,
      showAdvanced: false,
      // kind -> { phase: "idle" | "scanning" | "done" | "error", scan, error,
      // loadingOlder, retrying }
      kinds: {},
      // event id -> why its private items couldn't be read.
      privateNotes: {},
      // Bumped whenever `privateTags` changes, so rows re-render.
      privateVersion: 0,
      decryptingIds: new Set(),
      expandedGroups: new Set(),
      sortBy: "date",
      showEmpty: false,
      showRelays: false,
      archive: [],
      review: null,
      preparingId: null,
      banner: null,
      exporting: false,
      wiping: false,
      wipeResult: null,
    };
  },
  computed: {
    isDev() {
      return import.meta.env.DEV;
    },
    profile() {
      return getLazarusKindProfile(this.selectedKind) || KIND_PROFILES[0];
    },
    kindState() {
      return this.kinds[this.selectedKind] || { phase: "idle" };
    },
    scan() {
      return this.kindState.scan;
    },
    sortable() {
      return this.profile.ranking === "count";
    },
    kindDescription() {
      return KIND_DESCRIPTIONS[this.profile.kind];
    },
    scanButtonLabel() {
      if (this.kindState.phase === "scanning") return "Scanning…";
      return this.kindState.phase === "idle" ? "Scan relays" : "Scan again";
    },
    primaryKinds() {
      return KIND_PROFILES.filter((p) => p.tier < 3);
    },
    advancedKinds() {
      return KIND_PROFILES.filter((p) => p.tier === 3);
    },
    listItems() {
      return this.scan
        ? groupLazarusCandidates(this.scan, this.profile, { hidePastEmpty: !this.showEmpty })
        : [];
    },
    bySize() {
      if (!this.scan || !this.sortable || this.sortBy !== "size") return undefined;
      return sortLazarusCandidates(this.scan.candidates, "size").filter(
        (candidate) => this.showEmpty || !isPastEmptyVersion(candidate, this.profile),
      );
    },
    pastEmptyCount() {
      return this.scan
        ? this.scan.candidates.filter((c) => isPastEmptyVersion(c, this.profile)).length
        : 0;
    },
    archiveForKind() {
      return this.archive.filter((entry) => entry.event.kind === this.selectedKind);
    },
    outcomes() {
      return this.scan?.relayOutcomes || {};
    },
    answeredCount() {
      return Object.values(this.outcomes).filter((o) => o === "answered").length;
    },
    unansweredCount() {
      return Object.keys(this.outcomes).length - this.answeredCount;
    },
    writeSet() {
      return new Set(this.scan?.writeRelays || []);
    },
    reachedNoRelay() {
      return this.scan ? lazarusScanReachedNoRelay(this.scan) : false;
    },
  },
  watch: {
    // Decrypt what's on screen: single rows, expanded groups (except over
    // NIP-46, where each is a signer prompt), the recommendation, and saved
    // versions.
    listItems() {
      this.decryptShown();
    },
    expandedGroups() {
      this.decryptShown();
    },
    archiveForKind() {
      this.decryptShown();
    },
  },
  created() {
    // Bookkeeping that never drives rendering stays outside reactivity.
    this.source = null;
    this.sourceList = null;
    this.scanIds = {};
    // event id -> decrypted private tags; scans are re-ranked from it.
    this.privateTags = new Map();
    this.decryptQueue = Promise.resolve();
    this.queued = new Set();
    this.restoreFits = new Map();
    this.reviewKey = 0;
    this.reloadArchive();
  },
  methods: {
    shortRelay,

    // --- signer and relays ---

    // nostrService isn't reactive, so these are read fresh on every use.
    usesRemoteSigner() {
      return signer.usesRemoteSigner();
    },
    canRestore() {
      return signer.isSignerReady();
    },
    relayConfig() {
      const list = nostrService.userRelayList;
      return {
        defaultRelays: nostrService.relays,
        defaultWriteRelays: nostrService.relays.filter((url) => !READ_ONLY_DEFAULTS.has(url)),
        archivalRelays: LAZARUS_ARCHIVAL_RELAYS,
        ownRelayList: list
          ? {
              read: [...(list.bothRelays || []), ...(list.readRelays || [])],
              write: [...(list.bothRelays || []), ...(list.writeRelays || [])],
              createdAt: list.lastUpdated || 0,
            }
          : undefined,
      };
    },
    // The source caches relay plans, so it's rebuilt when the relay list
    // changes, such as after restoring one.
    relaySource() {
      const list = nostrService.userRelayList;
      if (!this.source || this.sourceList !== list) {
        this.source = createLazarusRelaySource(this.relayConfig());
        this.sourceList = list;
      }
      return this.source;
    },

    // --- state helpers ---

    updateKind(kind, patch) {
      const current = this.kinds[kind] || { phase: "idle" };
      const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
      if (next.scan) markRaw(next.scan);
      this.kinds = { ...this.kinds, [kind]: next };
    },
    reloadArchive() {
      this.archive = markRaw(this.pubkey ? listArchive(this.pubkey) : []);
    },
    deliberateIds() {
      return this.pubkey ? getDeliberateEditIds(this.pubkey) : new Set();
    },
    hasFix(kind) {
      return !!this.kinds[kind]?.scan?.recommended;
    },
    savedCount(kind) {
      return this.archive.filter((e) => e.event.kind === kind).length;
    },
    chipClass(kindProfile) {
      const active = kindProfile.kind === this.selectedKind;
      return [
        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-zombie-green bg-zombie-green text-zombie-dark"
          : "border-gray-600 text-gray-200 hover:bg-white/5",
      ];
    },
    selectKind(kind) {
      this.selectedKind = kind;
      this.expandedGroups = new Set();
      this.showEmpty = false;
      this.showRelays = false;
      this.sortBy = "date";
    },
    toggleGroup(key) {
      const next = new Set(this.expandedGroups);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      this.expandedGroups = next;
    },
    itemKey(item) {
      return item.type === "version"
        ? item.candidate.event.id
        : `group-${item.candidates[0].event.id}`;
    },
    outcomeLabel(outcome) {
      if (outcome === "answered") return "Answered";
      if (outcome === "timed-out") return "Timed out";
      return "Failed";
    },

    // --- item counts and size limits ---

    itemCountFor(kindProfile, event) {
      return countLazarusItems(kindProfile, event, this.privateTags.get(event.id));
    },
    isTooLargeToRestore(event) {
      if (!this.usesRemoteSigner() || !this.pubkey) return false;
      let fits = this.restoreFits.get(event.id);
      if (fits === undefined) {
        fits = fitsLazarusRemoteRestore(event, this.pubkey);
        this.restoreFits.set(event.id, fits);
      }
      return !fits;
    },

    // --- rows ---

    rowProps(candidate) {
      // Read so rows re-render when decryption lands.
      void this.privateVersion;
      return {
        profile: this.profile,
        candidate,
        note: this.privateNotes[candidate.event.id],
        decrypting:
          this.decryptingIds.has(candidate.event.id) &&
          !this.privateTags.has(candidate.event.id),
        tooLargeToRestore: this.isTooLargeToRestore(candidate.event),
        restorable: this.canRestore() && !isPastEmptyVersion(candidate, this.profile),
        preparing: this.preparingId === candidate.event.id,
      };
    },
    rowHandlers() {
      return {
        review: (c) => this.openReview(this.selectedKind, c),
        download: this.downloadOne,
        "retry-decrypt": this.retryDecrypt,
      };
    },
    savedCandidate(entry) {
      return {
        event: entry.event,
        foundOn: [],
        itemCount: this.itemCountFor(this.profile, entry.event),
        isCurrent: false,
        isRecommended: false,
      };
    },
    savedOrigin(entry) {
      return entry.source === "snapshot"
        ? `saved before a restore, ${formatDate(entry.savedAt / 1000)}`
        : `imported from ${entry.label}`;
    },
    savedSourceLabel(entry) {
      const onRelays = this.scan?.candidates.some((c) => c.event.id === entry.event.id);
      const origin = this.savedOrigin(entry);
      return onRelays ? `${origin} · also on relays` : origin;
    },

    // --- decryption ---

    async readPrivateTags(event) {
      const encryption = getContentEncryption(event.content);
      if (!encryption) return undefined;
      // Without a signer yet, leave it undecrypted and try again once connected.
      if (!signer.isSignerReady()) return undefined;
      const method = encryption === "nip04" ? "nip04_decrypt" : "nip44_decrypt";
      if (this.usesRemoteSigner() && !fitsNip46Request(method, [event.pubkey, event.content])) {
        return "too-large";
      }
      if (!signer.canDecrypt(encryption)) return "unsupported";
      const plainText = await signer.decrypt(event.pubkey, event.content, encryption);
      if (typeof plainText !== "string") return "failed";
      return parsePrivateTags(plainText) ?? "failed";
    },
    isUndecrypted(event) {
      return (
        !!getContentEncryption(event.content) &&
        !this.privateTags.has(event.id) &&
        !this.privateNotes[event.id]
      );
    },
    mergePrivate(decrypted, notes) {
      if (decrypted.size === 0 && Object.keys(notes).length === 0) return;
      this.privateTags = new Map([...this.privateTags, ...decrypted]);
      this.privateNotes = { ...this.privateNotes, ...notes };
      this.privateVersion += 1;
      const next = { ...this.kinds };
      for (const [key, state] of Object.entries(this.kinds)) {
        const kindProfile = getLazarusKindProfile(Number(key));
        if (state.scan && kindProfile?.privateItemTypes) {
          next[key] = {
            ...state,
            scan: markRaw(applyLazarusPrivateTags(kindProfile, state.scan, this.privateTags)),
          };
        }
      }
      this.kinds = next;
    },
    // One decryption at a time, so a signer that prompts never gets two
    // requests at once.
    decryptVersions(events) {
      const pending = events.filter(
        (event) => this.isUndecrypted(event) && !this.queued.has(event.id),
      );
      if (pending.length === 0) return this.decryptQueue;
      const ids = pending.map((event) => event.id);
      ids.forEach((id) => this.queued.add(id));
      this.decryptingIds = new Set([...this.decryptingIds, ...ids]);
      const job = this.decryptQueue.then(async () => {
        const decrypted = new Map();
        const notes = {};
        for (const event of pending) {
          if (!this.isUndecrypted(event)) continue;
          try {
            const result = await this.readPrivateTags(event);
            if (result === undefined) continue;
            if (typeof result === "string") notes[event.id] = result;
            else decrypted.set(event.id, result);
          } catch {
            notes[event.id] = "failed";
          }
        }
        this.mergePrivate(decrypted, notes);
      });
      const settled = job
        .catch(() => {})
        .finally(() => {
          ids.forEach((id) => this.queued.delete(id));
          const next = new Set(this.decryptingIds);
          ids.forEach((id) => next.delete(id));
          this.decryptingIds = next;
        });
      this.decryptQueue = settled;
      return settled;
    },
    retryDecrypt(candidate) {
      const notes = { ...this.privateNotes };
      delete notes[candidate.event.id];
      this.privateNotes = notes;
      this.decryptVersions([candidate.event]);
    },
    decryptShown() {
      if (!this.profile.privateItemTypes || !signer.isSignerReady()) return;
      const shown = this.listItems.flatMap((item) => {
        if (item.type === "version") return [item.candidate.event];
        if (this.usesRemoteSigner() || !this.expandedGroups.has(item.candidates[0].event.id)) {
          return [];
        }
        return item.candidates.map((c) => c.event);
      });
      if (this.scan?.recommended) shown.push(this.scan.recommended.event);
      this.archiveForKind.forEach((entry) => shown.push(entry.event));
      this.decryptVersions(shown);
    },

    // --- scanning ---

    async runScan(kind) {
      if (!this.pubkey) return undefined;
      const scanId = (this.scanIds[kind] || 0) + 1;
      this.scanIds[kind] = scanId;
      this.updateKind(kind, { phase: "scanning", error: undefined });
      try {
        const result = await scanLazarusKind(
          kind,
          this.pubkey,
          this.relaySource(),
          this.deliberateIds(),
        );
        if (this.scanIds[kind] !== scanId) return undefined;
        const ranked = applyLazarusPrivateTags(
          getLazarusKindProfile(kind),
          result,
          this.privateTags,
        );
        this.updateKind(kind, { phase: "done", scan: ranked });
        return ranked;
      } catch (error) {
        if (this.scanIds[kind] === scanId) {
          this.updateKind(kind, { phase: "error", error: errorMessage(error) });
        }
        return undefined;
      }
    },
    async retryFailedRelays(kind) {
      const state = this.kinds[kind];
      if (!state?.scan || !this.pubkey) return;
      const failed = Object.entries(state.scan.relayOutcomes || {})
        .filter(([, outcome]) => outcome !== "answered")
        .map(([url]) => url);
      if (failed.length === 0) return;
      const scanId = this.scanIds[kind];
      this.updateKind(kind, { retrying: true });
      try {
        const retry = await fetchLazarusVersionsFrom(
          kind,
          this.pubkey,
          failed,
          this.relayConfig(),
        );
        if (this.scanIds[kind] !== scanId) return;
        const kindProfile = getLazarusKindProfile(kind);
        this.updateKind(kind, (prev) => ({
          ...prev,
          retrying: false,
          scan: prev.scan
            ? mergeLazarusRetry(kindProfile, prev.scan, retry, this.privateTags)
            : prev.scan,
        }));
      } catch {
        this.updateKind(kind, { retrying: false });
      }
    },
    async loadOlder() {
      const kind = this.selectedKind;
      const state = this.kinds[kind];
      if (!state?.scan || !this.pubkey) return;
      const scanId = this.scanIds[kind];
      this.updateKind(kind, { loadingOlder: true });
      try {
        const kindProfile = getLazarusKindProfile(kind);
        const result = await loadOlderLazarusVersions(
          kindProfile,
          state.scan,
          this.pubkey,
          this.relaySource(),
          this.privateTags,
        );
        if (this.scanIds[kind] !== scanId) return;
        this.updateKind(kind, {
          loadingOlder: false,
          scan: applyLazarusPrivateTags(kindProfile, result, this.privateTags),
        });
      } catch (error) {
        this.updateKind(kind, { loadingOlder: false });
        this.banner = {
          tone: "error",
          text: `Couldn't load older versions: ${errorMessage(error)}`,
        };
      }
    },

    // --- review ---

    restoreBlockers(event) {
      const blockers = [];
      if (!signer.isSignerReady()) {
        blockers.push("Connect your signer to restore. Scanning works without it.");
      }
      if (event.pubkey !== this.pubkey) {
        blockers.push("This version belongs to another account.");
      }
      if (this.isTooLargeToRestore(event)) {
        blockers.push(
          "This version is too large to sign with a remote signer: NIP-46 requests are limited to 64 KB. Sign in with a browser extension (NIP-07) to restore it.",
        );
      }
      return blockers;
    },
    // Whether a purge this client made sits between the chosen version and
    // current: restoring then re-follows accounts the user removed on purpose.
    predatesPurge(chosen, current, kindScan) {
      if (chosen.kind !== 3 || !current) return false;
      const deliberate = kindScan.deliberateIds || new Set();
      return kindScan.candidates.some(
        (c) =>
          deliberate.has(c.event.id) &&
          c.event.created_at > chosen.created_at &&
          c.event.created_at <= current.created_at,
      );
    },
    malformedFollows(chosen) {
      if (chosen.kind !== 3) return 0;
      return chosen.tags.filter((t) => t[0] === "p" && !HEX_PUBKEY.test(t[1] || ""))
        .length;
    },
    buildReview(kindProfile, chosen, current, kindScan, extras) {
      const fromScan = kindScan.candidates.find((c) => c.event.id === chosen.id);
      const candidate = {
        event: chosen,
        foundOn: fromScan?.foundOn || [],
        itemCount: this.itemCountFor(kindProfile, chosen),
        isCurrent: false,
        isRecommended: fromScan?.isRecommended || false,
      };
      this.reviewKey += 1;
      return {
        key: this.reviewKey,
        profile: kindProfile,
        candidate,
        originLabel: extras.originLabel,
        current,
        currentItemCount: current ? this.itemCountFor(kindProfile, current) : undefined,
        delta: computeLazarusDelta(chosen, current, this.privateTags),
        profileChanges:
          kindProfile.kind === 0 ? computeLazarusProfileChanges(chosen, current) : undefined,
        changedSinceReview: extras.changedSinceReview,
        blockers: this.restoreBlockers(chosen),
        writeRelaysAreDefaults: kindScan.relayList === "missing",
        predatesPurge: this.predatesPurge(chosen, current, kindScan),
        malformedFollows: this.malformedFollows(chosen),
        status: "review",
        attempts: 0,
      };
    },
    async openReview(kind, candidate, originLabel) {
      if (!this.pubkey || this.preparingId) return;
      const kindProfile = getLazarusKindProfile(kind);
      this.preparingId = candidate.event.id;
      try {
        let kindScan = this.kinds[kind]?.scan;
        if (!kindScan) {
          // A saved version is compared against what's on relays now.
          kindScan = await this.runScan(kind);
          if (!kindScan) {
            this.banner = {
              tone: "error",
              text: "Couldn't scan your relays to find your current version, so this version can't be reviewed yet.",
            };
            return;
          }
        }
        const current = kindScan.current?.event;
        if (kindProfile.privateItemTypes) {
          await this.decryptVersions(current ? [candidate.event, current] : [candidate.event]);
        }
        this.review = this.buildReview(kindProfile, candidate.event, current, kindScan, {
          originLabel,
          changedSinceReview: false,
        });
      } finally {
        this.preparingId = null;
      }
    },
    async reviewAgainst(open, newer) {
      const kindProfile = open.profile;
      if (kindProfile.privateItemTypes) await this.decryptVersions([newer]);
      const kindScan = this.kinds[kindProfile.kind]?.scan;
      if (!kindScan) return;
      this.review = this.buildReview(kindProfile, open.candidate.event, newer, kindScan, {
        originLabel: open.originLabel,
        changedSinceReview: true,
      });
    },
    patchReview(key, update) {
      if (this.review && this.review.key === key) {
        this.review = { ...this.review, ...update };
      }
    },
    closeReview() {
      if (this.review?.status === "working") return;
      this.review = null;
    },

    // --- restore ---

    async snapshotBeforeRestore(event) {
      saveToArchive([
        { event, source: "snapshot", label: "Saved before a restore", savedAt: Date.now() },
      ]);
      // The list being replaced also goes into Backup History, so it can be
      // restored the familiar way too.
      if (event.kind === 3) {
        try {
          await snapshotFollowListToBackups(event);
        } catch (error) {
          console.warn("[Lazarus] Backup History snapshot failed:", errorMessage(error));
        }
      }
      this.reloadArchive();
      this.$emit("backups-changed");
    },
    async confirmRestore(override) {
      const open = this.review;
      if (!open || !this.pubkey) return;
      const pubkey = this.pubkey;
      const kind = open.profile.kind;
      const kindScan = this.kinds[kind]?.scan;
      const chosen = open.candidate.event;
      const patch = (update) => this.patchReview(open.key, update);

      patch({ status: "working", step: "Checking your account…", error: undefined });
      try {
        if (!signer.isSignerReady()) {
          throw new Error("Your signer isn't connected. Reconnect it and try again.");
        }
        // Asked of the signer itself: an account switched inside the extension
        // must stop the restore here, before anything is signed.
        const signerPubkey = await signer.getSignerPublicKey();
        if (signerPubkey !== pubkey || chosen.pubkey !== pubkey) {
          throw new Error(
            "This version belongs to another account. Switch back to it to restore.",
          );
        }

        let writeRelays = kindScan?.writeRelays || [];
        let replacing = open.current;
        if (!override) {
          patch({ step: "Confirming your current version on your write relays…" });
          if (writeRelays.length === 0) {
            writeRelays = (await resolveLazarusRelays(pubkey, this.relayConfig())).write;
          }
          const answers = await readLazarusCurrent(kind, pubkey, writeRelays);
          // Re-read from the local copy too: a purge this session made may be
          // newer than anything the write relays have yet.
          const check = checkLazarusCurrent(
            open.current,
            nostrService.newestWithOwnCopy(kind, []),
            answers,
          );
          if (check.status === "unconfirmed") {
            if (this.review && this.review.key === open.key) {
              this.review = {
                ...this.review,
                status: "unconfirmed",
                step: undefined,
                attempts: this.review.attempts + 1,
                rereadAnswers: answers,
              };
            }
            return;
          }
          if (check.status === "changed") {
            await this.reviewAgainst(open, check.current);
            return;
          }
          replacing = check.current;
        }

        patch({ step: "Waiting for your signer…" });
        // Dated after the newest version known, the relays' or this session's
        // own, so the restore outranks both.
        const draft = buildLazarusRecoveryDraft(chosen, {
          current: nostrService.newestWithOwnCopy(kind, replacing ? [replacing] : []),
        });
        const signed = await signer.signEvent(draft);
        if (
          !signed ||
          signed.pubkey !== pubkey ||
          signer.sessionPubkey() !== pubkey ||
          !verifyEvent(signed)
        ) {
          throw new Error(
            "The signed event doesn't match this account, so it wasn't published.",
          );
        }

        if (writeRelays.length === 0) {
          writeRelays = (await resolveLazarusRelays(pubkey, this.relayConfig())).write;
        }
        let successRelays = writeRelays;
        let extraRelays = kindScan?.respondingRelays || [];
        if (kind === 10002) {
          const restoredWrite = parseRelayListEvent(signed).write;
          if (restoredWrite.length > 0) {
            successRelays = restoredWrite;
            extraRelays = [...extraRelays, ...writeRelays];
          }
        }
        if (successRelays.length === 0) {
          throw new Error(
            "No write relays are known for your account, so there's nowhere to publish. Scan again once your relays answer.",
          );
        }

        // Signed and ready: the version about to be replaced is saved first.
        if (replacing) await this.snapshotBeforeRestore(replacing);

        patch({ step: "Publishing to your write relays…" });
        const outcome = await publishLazarusRecovery(signed, successRelays, extraRelays);
        if (!outcome.accepted) {
          patch({
            status: "failed",
            step: undefined,
            writeResults: outcome.write,
            error: "No write relay accepted the restore, so nothing changed.",
          });
          return;
        }

        applyRestoreLocally(signed);
        // The user chose this version; it must not read as a clobber later.
        markDeliberateEdit(pubkey, signed.id);
        patch({
          status: "published",
          step: undefined,
          writeResults: outcome.write,
          extraPending: true,
        });
        outcome.extra
          .then((results) => patch({ extraResults: results, extraPending: false }))
          .catch(() => patch({ extraPending: false }));
        this.reloadArchive();
        this.runScan(kind);
      } catch (error) {
        patch({
          status: open.status === "unconfirmed" ? "unconfirmed" : "review",
          step: undefined,
          error: errorMessage(error),
        });
      }
    },

    // --- export, import, and saved versions ---

    downloadVersions(label, events) {
      if (!this.pubkey || events.length === 0) return;
      downloadJson(lazarusFileName(label, this.pubkey), buildExportBundle(this.pubkey, events));
    },
    downloadOne(candidate) {
      this.downloadVersions(
        `${this.profile.name} ${formatDate(candidate.event.created_at)}`,
        [candidate.event],
      );
    },
    async exportData() {
      if (!this.pubkey) return;
      this.exporting = true;
      this.banner = null;
      try {
        const plan = await getLazarusScanPlan(this.pubkey, this.relayConfig());
        const { events } = await fetchLatestVersions(
          this.pubkey,
          KIND_PROFILES.map((p) => p.kind),
          plan.relays,
        );
        if (events.length === 0) {
          this.banner = { tone: "error", text: "No data found on the relays that answered." };
          return;
        }
        this.downloadVersions("nostr data", events);
        const found = events.map((e) => getLazarusKindProfile(e.kind)?.name).join(", ");
        const missing = KIND_PROFILES.filter((p) => !events.some((e) => e.kind === p.kind)).map(
          (p) => p.name,
        );
        this.banner = {
          tone: "success",
          text: `Downloaded ${events.length} signed ${events.length === 1 ? "event" : "events"}: ${found}.${
            missing.length > 0 ? ` Not found: ${missing.join(", ")}.` : ""
          }`,
        };
      } catch (error) {
        this.banner = { tone: "error", text: `Couldn't export your data: ${errorMessage(error)}` };
      } finally {
        this.exporting = false;
      }
    },
    async importFile(event) {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !this.pubkey) return;
      if (file.size > MAX_IMPORT_BYTES) {
        this.banner = { tone: "error", text: `${file.name} is larger than 10 MB.` };
        return;
      }
      try {
        const result = parseImportedEvents(await file.text(), this.pubkey);
        const added = saveToArchive(
          result.events.map((imported) => ({
            event: imported,
            source: "import",
            label: file.name,
            savedAt: Date.now(),
          })),
        );
        this.reloadArchive();
        const skipped = [
          result.foreign > 0 && `${result.foreign} from other accounts`,
          result.invalid > 0 && `${result.invalid} invalid or tampered`,
          result.unsupported > 0 && `${result.unsupported} of kinds this can't restore`,
        ].filter(Boolean);
        const skippedText = skipped.length > 0 ? ` Skipped ${skipped.join(", ")}.` : "";
        if (result.events.length === 0) {
          this.banner = {
            tone: "error",
            text: `No restorable versions for this account in ${file.name}.${skippedText}`,
          };
          return;
        }
        const counts = new Map();
        result.events.forEach((e) => {
          const name = getLazarusKindProfile(e.kind)?.name || `kind ${e.kind}`;
          counts.set(name, (counts.get(name) || 0) + 1);
        });
        const summary = Array.from(counts, ([name, count]) => `${name} ${count}`).join(", ");
        const already = result.events.length - added;
        this.banner = {
          tone: "success",
          text: `Imported ${added} new ${added === 1 ? "version" : "versions"} from ${file.name} (${summary}).${
            already > 0 ? ` ${already} ${already === 1 ? "was" : "were"} already saved.` : ""
          }${skippedText} Find them under "Saved on this device" for each list.`,
        };
        const firstKind = result.events[0].kind;
        this.selectedKind = firstKind;
        if (getLazarusKindProfile(firstKind)?.tier === 3) this.showAdvanced = true;
      } catch (error) {
        this.banner = { tone: "error", text: errorMessage(error) };
      }
    },
    deleteSaved(entry) {
      if (!window.confirm("Remove this saved version from this device?")) return;
      removeFromArchive(entry.event.id);
      this.reloadArchive();
    },

    // --- dev only ---

    async publishEmptyFollowList() {
      if (!this.pubkey) return;
      const confirmMsg =
        "DEV WIPE TEST\n\n" +
        "This publishes a SIGNED kind:3 with ZERO follows for this account. Other " +
        "clients will see an empty follow list until you restore it.\n\n" +
        "A local backup of your current list is saved first. Continue?";
      if (!window.confirm(confirmMsg)) return;
      this.wiping = true;
      this.wipeResult = null;
      try {
        const snapshot = await backupService.createBackup("Dev wipe test: pre-wipe snapshot");
        if (!snapshot.success) {
          throw new Error(`Couldn't save a snapshot: ${snapshot.message || "unknown error"}`);
        }
        this.$emit("backups-changed");
        const signed = await signer.signEvent({
          kind: 3,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: "",
        });
        // Not marked as a deliberate edit: it has to read as a clobber.
        const { write } = await resolveLazarusRelays(this.pubkey, this.relayConfig());
        const outcome = await publishLazarusRecovery(signed, write);
        const accepted = outcome.write.filter((r) => r.status === "accepted").length;
        if (!outcome.accepted) throw new Error("No write relay accepted the empty kind:3.");
        this.wipeResult = `Published an empty kind:3, accepted by ${accepted} of ${outcome.write.length} write relays.`;
        this.selectKind(3);
        await this.runScan(3);
      } catch (error) {
        this.wipeResult = `Wipe failed: ${errorMessage(error)}`;
      } finally {
        this.wiping = false;
      }
    },
  },
};
</script>
