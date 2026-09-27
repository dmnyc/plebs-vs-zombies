<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lazarus-review-title"
    >
      <!-- text-pretty is inherited: the global rule covers only p and li, and
           most text here sits in labels, spans, and notices. -->
      <div class="modal-panel flex max-h-[90vh] w-full max-w-xl flex-col rounded-lg border border-gray-700 bg-zombie-dark text-pretty shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b border-gray-700 p-5">
          <div>
            <h2 id="lazarus-review-title" class="font-main text-lg font-semibold text-gray-100 [text-shadow:none]">
              Review restore: {{ profile.name }}
            </h2>
            <p class="mt-1 text-sm text-gray-400">
              Restoring publishes the selected version as your current {{ phrase }}.
            </p>
          </div>
          <button
            type="button"
            class="text-2xl leading-none text-gray-400 hover:text-gray-200 disabled:opacity-50"
            aria-label="Close"
            :disabled="busy"
            @click="$emit('close')"
          >
            ×
          </button>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div class="rounded-lg border border-zombie-green/40 bg-zombie-green/10 p-3">
              <div class="text-xs font-semibold uppercase tracking-wide text-zombie-green">
                Selected version
              </div>
              <div class="mt-1 font-medium text-gray-100">
                {{ formatCount(kind, candidate.itemCount) }}
              </div>
              <div class="text-xs text-gray-400">{{ formatDateTime(chosen.created_at) }}</div>
              <div v-if="review.originLabel" class="mt-1 text-xs text-gray-400">
                {{ review.originLabel }}
              </div>
            </div>
            <div class="rounded-lg border border-gray-700 bg-black/20 p-3">
              <div class="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Current version
              </div>
              <template v-if="review.current && review.currentItemCount">
                <div class="mt-1 font-medium text-gray-100">
                  {{ formatCount(kind, review.currentItemCount) }}
                </div>
                <div class="text-xs text-gray-400">
                  {{ formatDateTime(review.current.created_at) }}
                </div>
              </template>
              <div v-else class="mt-1 text-gray-400">None found on relays</div>
            </div>
          </div>

          <LazarusNotice v-if="review.changedSinceReview" tone="blue">
            Your {{ phrase }} changed after this review opened (another device or
            client), so the changes below now compare against that newer version.
            Check them again before restoring.
          </LazarusNotice>

          <template v-if="review.profileChanges">
            <p v-if="review.profileChanges.length === 0" class="text-gray-300">
              No profile fields would change.
            </p>
            <div v-else>
              <div class="mb-2 font-medium text-gray-100">
                {{ review.profileChanges.length }}
                {{ review.profileChanges.length === 1 ? "field changes" : "fields change" }}
              </div>
              <div class="space-y-2">
                <div
                  v-for="change in review.profileChanges"
                  :key="change.field"
                  class="rounded border border-gray-700 p-2 text-xs"
                >
                  <div class="font-semibold text-gray-100">{{ change.field }}</div>
                  <div class="break-words text-zombie-green">{{ change.to ?? "(removed)" }}</div>
                  <div
                    v-if="change.from !== undefined"
                    class="break-words text-gray-500 line-through"
                  >
                    {{ change.from }}
                  </div>
                </div>
              </div>
            </div>
          </template>

          <div v-else class="space-y-2">
            <div class="font-medium text-gray-100">
              +{{ delta.addedCount }} {{ itemNoun(kind, delta.addedCount) }} added ·
              −{{ delta.removedCount }} {{ itemNoun(kind, delta.removedCount) }} removed
            </div>
            <div v-if="delta.addedCount > 0">
              <button
                type="button"
                class="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-100"
                @click="showAdded = !showAdded"
              >
                <span aria-hidden="true">{{ showAdded ? "▴" : "▾" }}</span>
                Show added
              </button>
              <ul v-if="showAdded" :class="listClass">
                <li v-for="(tag, i) in preview(delta.added)" :key="`a-${i}`" class="truncate">
                  {{ describeItem(tag) }}
                </li>
                <li v-if="delta.added.length > LIST_PREVIEW" class="text-gray-500">
                  and {{ delta.added.length - LIST_PREVIEW }} more
                </li>
              </ul>
            </div>
            <div v-if="delta.removedCount > 0">
              <button
                type="button"
                class="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-100"
                @click="showRemoved = !showRemoved"
              >
                <span aria-hidden="true">{{ showRemoved ? "▴" : "▾" }}</span>
                Show removed
              </button>
              <ul v-if="showRemoved" :class="listClass">
                <li v-for="(tag, i) in preview(delta.removed)" :key="`r-${i}`" class="truncate">
                  {{ describeItem(tag) }}
                </li>
                <li v-if="delta.removed.length > LIST_PREVIEW" class="text-gray-500">
                  and {{ delta.removed.length - LIST_PREVIEW }} more
                </li>
              </ul>
            </div>
          </div>

          <LazarusNotice v-if="kind === 10000 && delta.addedCount > 0">
            This re-mutes {{ delta.addedCount }} {{ itemNoun(kind, delta.addedCount) }}
            that you don't mute now. If you unmuted any of them on purpose,
            restoring mutes them again: a moderation action taken on your behalf.
          </LazarusNotice>
          <LazarusNotice v-if="kind === 10000 && delta.removedCount > 0">
            This unmutes {{ delta.removedCount }} {{ itemNoun(kind, delta.removedCount) }}
            you mute now.
          </LazarusNotice>
          <p v-if="kind === 3 && delta.addedCount > 0 && !review.predatesPurge" class="text-gray-300">
            This re-follows {{ delta.addedCount }}
            {{ delta.addedCount === 1 ? "account" : "accounts" }}.
          </p>
          <LazarusNotice v-if="kind === 3 && review.predatesPurge && delta.addedCount > 0">
            This version is from before a zombie purge you made, so restoring it
            re-follows {{ delta.addedCount }}
            {{ delta.addedCount === 1 ? "account" : "accounts" }}, including ones you
            purged on purpose.
          </LazarusNotice>
          <LazarusNotice v-if="kind === 3 && delta.removedCount > 0">
            This unfollows {{ delta.removedCount }}
            {{ delta.removedCount === 1 ? "account" : "accounts" }} you follow now.
          </LazarusNotice>
          <LazarusNotice v-if="kind === 3 && review.malformedFollows > 0">
            {{ review.malformedFollows }}
            {{ review.malformedFollows === 1 ? "entry" : "entries" }} in this version
            {{ review.malformedFollows === 1 ? "isn't a valid public key" : "aren't valid public keys" }}.
            The restore copies the list exactly, and some relays refuse a follow list
            that contains any, so those relays may reject it. Each relay's answer is
            shown after you publish.
          </LazarusNotice>
          <p v-if="kind === 10044" class="text-gray-300">
            Other clients read this list to decide how to encrypt messages to you.
          </p>

          <LazarusNotice v-if="delta.privateUnknown">
            {{ privateUnknownText }}
          </LazarusNotice>

          <div v-if="staleRelays" class="space-y-2">
            <LazarusNotice>
              Old relay lists can point at relays that no longer exist, which quietly
              breaks delivery. Check which relays still answer before you restore.
            </LazarusNotice>
            <div v-if="uniqueChosenRelays.length > 0">
              <button type="button" class="btn-tertiary btn-sm" @click="checkRelays">
                Check {{ uniqueChosenRelays.length }}
                {{ uniqueChosenRelays.length === 1 ? "relay" : "relays" }}
              </button>
              <ul v-if="Object.keys(liveness).length > 0" class="mt-2 space-y-0.5 text-xs">
                <li v-for="url in uniqueChosenRelays" :key="url" class="flex justify-between gap-3">
                  <span class="min-w-0 truncate text-gray-400">{{ shortRelay(url) }}</span>
                  <span :class="liveness[url] === 'live' ? 'text-zombie-green' : 'text-gray-500'">
                    {{ livenessLabel(liveness[url]) }}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <LazarusNotice v-if="review.writeRelaysAreDefaults" tone="blue">
            No relay list was found for your account, so Plebs vs. Zombies' default
            relays stand in as your write relays.
          </LazarusNotice>

          <fieldset v-if="needsIntent" class="space-y-2 rounded-lg border border-gray-700 p-3">
            <legend class="px-1 text-sm font-medium text-gray-100">What do you want?</legend>
            <p class="text-gray-300">{{ restoreMeaning }}</p>
            <p class="text-gray-300">{{ currentMeaning }}</p>
            <label class="flex items-center gap-2 text-gray-200">
              <input v-model="intent" type="radio" name="lazarus-intent" value="restore" />
              Publish the selected version
            </label>
            <label class="flex items-center gap-2 text-gray-200">
              <input v-model="intent" type="radio" name="lazarus-intent" value="keep" />
              Keep my current version
            </label>
          </fieldset>

          <label
            v-if="needsShrinkAck && !done"
            class="flex items-start gap-2 rounded-lg border border-yellow-700/60 bg-yellow-900/20 p-3 text-yellow-200"
          >
            <input v-model="shrinkAck" type="checkbox" class="mt-1" />
            <span>{{ shrinkAckText }}</span>
          </label>

          <LazarusNotice v-if="review.blockers.length > 0" tone="red">
            <ul class="space-y-1">
              <li v-for="blocker in review.blockers" :key="blocker">{{ blocker }}</li>
            </ul>
          </LazarusNotice>

          <div v-if="busy" class="flex items-center gap-2 text-gray-300">
            <span class="spinner-sm"></span>
            {{ review.step || "Working…" }}
          </div>

          <div v-if="status === 'unconfirmed'" class="space-y-3">
            <LazarusNotice tone="red">
              Couldn't reach any of your write relays to confirm your current version,
              so nothing was published.
              <ul v-if="review.rereadAnswers && review.rereadAnswers.length > 0" class="mt-2 space-y-0.5 text-xs">
                <li v-for="answer in review.rereadAnswers" :key="answer.url" class="flex justify-between gap-3">
                  <span class="min-w-0 truncate">{{ shortRelay(answer.url) }}</span>
                  <span>{{ answer.outcome === "timed-out" ? "Timed out" : "Failed" }}</span>
                </li>
              </ul>
            </LazarusNotice>
            <div v-if="review.attempts >= 2" class="space-y-2 rounded-lg border border-red-800 p-3">
              <p class="text-gray-300">
                If your relay list names relays that no longer exist, you can restore
                without confirming. Edits made on another device since this review may
                be lost.
              </p>
              <label class="flex items-start gap-2 text-gray-200">
                <input v-model="overrideAck" type="checkbox" class="mt-1" />
                <span>
                  I understand my current version couldn't be confirmed, and edits made
                  since this review may be lost.
                </span>
              </label>
              <button
                type="button"
                class="btn-danger"
                :disabled="!overrideAck || !canPublish"
                @click="restoreAnyway"
              >
                Restore anyway
              </button>
            </div>
          </div>

          <LazarusNotice v-if="status === 'failed'" tone="red">
            {{ review.error || "No write relay accepted the restore, so nothing changed." }}
            <ul v-if="review.writeResults && review.writeResults.length > 0" class="mt-2 space-y-0.5 text-xs">
              <li v-for="result in review.writeResults" :key="result.url" class="flex justify-between gap-3">
                <span class="min-w-0 truncate text-gray-400">{{ shortRelay(result.url) }}</span>
                <span class="flex-shrink-0 text-gray-400" :title="result.message">
                  {{ publishLabel(result) }}
                </span>
              </li>
            </ul>
          </LazarusNotice>

          <div
            v-if="done && review.writeResults"
            class="space-y-2 rounded-lg border border-zombie-green/40 bg-zombie-green/10 p-3"
          >
            <div class="flex items-center gap-2 font-medium text-gray-100">
              <span aria-hidden="true">✅</span>
              Restored. Accepted by {{ acceptedCount }} of {{ review.writeResults.length }}
              write {{ review.writeResults.length === 1 ? "relay" : "relays" }}.
            </div>
            <ul class="space-y-0.5 text-xs">
              <li v-for="result in review.writeResults" :key="result.url" class="flex justify-between gap-3">
                <span class="min-w-0 truncate text-gray-400">{{ shortRelay(result.url) }}</span>
                <span
                  class="flex-shrink-0"
                  :class="result.status === 'accepted' ? 'text-zombie-green' : 'text-gray-400'"
                  :title="result.message"
                >
                  {{ publishLabel(result) }}
                </span>
              </li>
            </ul>
            <div v-if="review.extraPending" class="flex items-center gap-2 text-xs text-gray-400">
              <span class="spinner-sm"></span>
              Also sending it to other relays that hold older copies…
            </div>
            <div
              v-else-if="review.extraResults && review.extraResults.length > 0"
              class="text-xs text-gray-400"
            >
              Also sent to {{ review.extraResults.length }} other
              {{ review.extraResults.length === 1 ? "relay" : "relays" }} that held older
              copies: {{ review.extraResults.filter((r) => r.status === "accepted").length }}
              accepted.
            </div>
          </div>

          <div v-if="status === 'review' && review.error" class="flex items-start gap-2 text-red-400">
            <span aria-hidden="true">✗</span>
            {{ review.error }}
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2 border-t border-gray-700 p-4">
          <button
            v-if="done || (needsIntent && intent === 'keep')"
            type="button"
            class="btn-secondary"
            @click="$emit('close')"
          >
            {{ done ? "Done" : "Close" }}
          </button>
          <template v-else>
            <button
              type="button"
              class="btn-tertiary"
              :disabled="busy"
              @click="$emit('close')"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn-primary inline-flex items-center gap-2"
              :disabled="!canPublish"
              @click="$emit('confirm', false)"
            >
              <span v-if="busy" class="spinner-sm"></span>
              {{ primaryLabel }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
import {
  getLazarusItemRange,
  isLazarusSizeKnown,
  parseRelayListEvent,
  probeRelay,
  uniqueRelayUrls,
} from "../../lib/lazarus/index.js";
import LazarusNotice from "./LazarusNotice.vue";
import {
  describeItem,
  formatCount,
  formatDate,
  formatDateTime,
  itemNoun,
  kindPhrase,
  shortRelay,
} from "./format.js";

const LIST_PREVIEW = 100;

const PUBLISH_LABELS = {
  accepted: "Accepted",
  rejected: "Rejected",
  failed: "Couldn't connect",
  "timed-out": "Timed out",
};

export default {
  name: "LazarusReviewDialog",
  components: { LazarusNotice },
  props: {
    review: { type: Object, required: true },
  },
  emits: ["close", "confirm"],
  data() {
    return {
      // Nothing here is pre-selected: the spec forbids defaulting the intent
      // question or the override, and the parent remounts this per review so
      // no answer carries over from one restore to the next.
      shrinkAck: false,
      intent: null,
      overrideAck: false,
      showAdded: false,
      showRemoved: false,
      liveness: {},
      LIST_PREVIEW,
    };
  },
  computed: {
    profile() {
      return this.review.profile;
    },
    candidate() {
      return this.review.candidate;
    },
    delta() {
      return this.review.delta;
    },
    status() {
      return this.review.status;
    },
    kind() {
      return this.profile.kind;
    },
    chosen() {
      return this.candidate.event;
    },
    phrase() {
      return kindPhrase(this.profile.name);
    },
    busy() {
      return this.status === "working";
    },
    done() {
      return this.status === "published";
    },
    chosenRange() {
      return getLazarusItemRange(this.candidate.itemCount);
    },
    currentRange() {
      return this.review.currentItemCount
        ? getLazarusItemRange(this.review.currentItemCount)
        : null;
    },
    needsIntent() {
      return this.profile.meaningfulEmpty;
    },
    staleRelays() {
      return this.profile.requiredWarnings.includes("stale-relays");
    },
    uniqueChosenRelays() {
      if (this.kind === 10002) {
        const { write, read } = parseRelayListEvent(this.chosen);
        return uniqueRelayUrls([...write, ...read]);
      }
      return uniqueRelayUrls(
        this.chosen.tags.filter((t) => t[0] === "relay" && t[1]).map((t) => t[1]),
      );
    },
    // Uncounted private items on current take the confirmation a shrink
    // takes: the restore replaces them without anyone having counted them.
    needsShrinkAck() {
      return this.delta.shrinks || this.delta.privateUnknownCurrent;
    },
    shrinkAckText() {
      const fewer = `leaves me with fewer ${itemNoun(this.kind, 2)}: it removes ${this.delta.removedCount} and adds ${this.delta.addedCount}`;
      if (this.delta.shrinks && this.delta.privateUnknownCurrent) {
        return `I understand this restore ${fewer}, and may remove private items that couldn't be counted.`;
      }
      if (this.delta.shrinks) return `I understand this restore ${fewer}.`;
      return "I understand this restore replaces private items in my current version that couldn't be counted, and may remove some.";
    },
    // Says which side went uncounted: the selected version, current, or both.
    privateUnknownText() {
      const { privateUnknownChosen, privateUnknownCurrent } = this.delta;
      const chosenSize = this.sizeNote(this.candidate.itemCount, "the selected version");
      const currentSize = this.review.currentItemCount
        ? this.sizeNote(this.review.currentItemCount, "your current version")
        : "";
      if (privateUnknownChosen && privateUnknownCurrent) {
        return `Private items in both versions couldn't be decrypted, so the counts above leave them out. ${chosenSize} ${currentSize} Restoring replaces your current private items unseen, so it may remove some.`;
      }
      if (privateUnknownCurrent) {
        return `Your current version's private items couldn't be decrypted, so the counts above leave them out. ${currentSize} Restoring replaces them unseen, so it may remove some.`;
      }
      return `The selected version's private items couldn't be decrypted, so the counts above leave them out. ${chosenSize}`;
    },
    // Both endpoints of a key list restore, read in the restore's direction.
    restoreMeaning() {
      const count = this.chosenRange.max;
      if (count === 0) {
        return "This announces that you no longer use NIP-4e; clients stop encrypting direct messages to your keys.";
      }
      const currentEmpty = !this.currentRange || this.currentRange.max === 0;
      const keys = count === 1 ? "key" : "keys";
      const them = count === 1 ? "it" : "them";
      return `This restores ${count} NIP-4e encryption ${keys}. Clients will encrypt direct messages to ${them}${currentEmpty ? " again" : ""}.`;
    },
    currentMeaning() {
      if (!this.review.current) {
        return "No current version was found, so clients don't encrypt direct messages to NIP-4e keys for you.";
      }
      const count = this.currentRange ? this.currentRange.max : 0;
      if (count === 0) {
        return "Your current empty version announces that you don't use NIP-4e.";
      }
      return `Your current version lists ${count} ${count === 1 ? "key" : "keys"} that clients encrypt direct messages to.`;
    },
    canPublish() {
      return (
        !this.busy &&
        !this.done &&
        this.review.blockers.length === 0 &&
        (!this.needsIntent || this.intent === "restore") &&
        (!this.needsShrinkAck || this.shrinkAck)
      );
    },
    // Short, but it still names what gets published (spec invariant 4). The
    // selected version's card above has the rest.
    primaryLabel() {
      if (this.status === "unconfirmed") return "Check again";
      if (this.status === "failed") return "Try again";
      if (this.kind === 0) return `Restore profile from ${formatDate(this.chosen.created_at)}`;
      if (this.chosenRange.max === 0) return "Restore empty version";
      return `Restore ${formatCount(this.kind, this.candidate.itemCount)}`;
    },
    acceptedCount() {
      return (this.review.writeResults || []).filter((r) => r.status === "accepted")
        .length;
    },
    listClass() {
      return "mt-1 max-h-48 overflow-y-auto rounded border border-gray-700 bg-black/30 p-2 font-mono text-xs text-gray-300";
    },
  },
  methods: {
    formatCount,
    formatDateTime,
    itemNoun,
    describeItem,
    shortRelay,
    preview(tags) {
      return tags.slice(0, LIST_PREVIEW);
    },
    rangeText(range) {
      return range.min === range.max ? `${range.min}` : `about ${range.min}–${range.max}`;
    },
    sizeNote(itemCount, whose) {
      if (!isLazarusSizeKnown(itemCount)) {
        return `The encrypted size of ${whose} doesn't show how many there are.`;
      }
      return `By size, ${whose} has ${this.rangeText(getLazarusItemRange(itemCount))} items in all.`;
    },
    // The confirmation covers this attempt only, so a later failure never
    // finds it already ticked.
    restoreAnyway() {
      this.overrideAck = false;
      this.$emit("confirm", true);
    },
    publishLabel(result) {
      const label = PUBLISH_LABELS[result.status] || result.status;
      return result.message ? `${label}: ${result.message}` : label;
    },
    livenessLabel(state) {
      if (state === "checking") return "Checking…";
      if (state === "live") return "Reachable";
      if (state === "timed-out") return "No answer";
      return "Unreachable";
    },
    async checkRelays() {
      this.liveness = Object.fromEntries(
        this.uniqueChosenRelays.map((url) => [url, "checking"]),
      );
      await Promise.all(
        this.uniqueChosenRelays.map(async (url) => {
          const result = await probeRelay(url);
          this.liveness = { ...this.liveness, [url]: result };
        }),
      );
    },
  },
};
</script>
