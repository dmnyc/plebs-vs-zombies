# Lazarus implementation plan (Plebs vs Zombies)

Target: [Lazarus spec 0.5.0-draft](https://github.com/dmnyc/lazarus/blob/main/SPEC.md).
Lazarus **supplements** the local and NIP-78 backups; it does not replace or
merge with them. Backups are snapshots PvZ wrote on purpose. Lazarus
recovers whatever history relays still hold, including for users who never
made a backup.

## Step 0: an existing invariant break (fix first)

`backupService.init()` (`src/services/backupService.js` ~L452-492) finds no
local backups in a fresh browser or after cleared storage. It then **silently
restores the newest NIP-78 backup**, and that includes
`applyImportedFollowList`, which signs and publishes a kind 3. If the backup
is older than the live follow list, opening PvZ on a new device clobbers the
user's follows. That is the same failure Lazarus exists to undo, and it
violates invariant 1 in spirit even though it is backup code.

Fix: in `init()`, only *detect* relay backups. Show a banner ("Found a relay
backup from …; restore settings / review follow list"). Settings may still
restore locally without publishing. The follow list must go through an
explicit click with a delta (step 4). Ship this on its own, before the rest.

## Where PvZ is today

`src/lib/followRecovery.js` is a JS port of Mutable's pre-0.3 module
(kind 3 only), with `FollowRecovery.vue` on the Backups → Recover tab.

| Spec requirement | Today | Gap |
|---|---|---|
| Scan user's kind 10002 read+write, defaults, archival set | `nostrService.relays` (app defaults, **not** NIP-65) + `KNOWN_RELAYS` | Use `userRelayList` read+write; add `relay.ditto.pub`, `hist.nostr.land` |
| limit ≥ 50, `until` paging | limit 10, no paging | Rewrite fetch |
| Clobber-detection ranking | "largest older than current" | Replace |
| Delta by item (`tag[0..1]`), separate shrink confirm | count only, `window.confirm` | New dialog |
| Recover verbatim | keeps only valid `p` tags, **drops `t` and other tags** | Copy all tags verbatim |
| `created_at = max(now, current+1)` | `now` | Fix |
| Re-read current before signing; signer = author | no | Add |
| Success on write relays, best effort to other responders | user relays + `KNOWN_RELAYS`, no timeout | Use `getPublishRelays()` for write, responders as extra, `publishEventToRelays` (10 s timeout) |
| Update local copy | not updated: `nostrService.follows` and zombie caches stay stale, so the next purge rebuilds from the clobbered list | Fix |
| Tier 1 includes kind 10000 | PvZ never touches mute lists | Add (step 5) |
| nsec signer | recovery signs with nsec, but `encryptData`/`decryptData` and `applyImportedFollowList` reject nsec | Add local nip44/nip04 for nsec |

## Architecture

### 1. `src/lib/lazarus/`: port of the reference core

Port the Jumble reference core (`dmnyc/jumble-spark`, branch
`feat/lazarus-data-recovery-v2`, `src/services/lazarus/{registry,private-items,recovery}.ts`)
together with its specs.

**Recommendation: keep the files as `.ts`.** Vite and Vitest compile
TypeScript with esbuild without a `tsconfig` or type-check step, and `.vue`
Options-API components can import `.ts` modules. Copying verbatim keeps PvZ,
Mutable and Jumble diffable when the spec moves. (The fallback, a hand
translation to JS with JSDoc types, doubles the maintenance cost of every spec
bump.)

- `src/lib/lazarus/adapters.js`: the only PvZ-specific part. It lazy-imports
  `nostrService`, as `followRecovery.js` does today, so tests stay free of NDK.
  - `pvzRelaySource`: a nostr-tools `SimplePool`, one `querySync` per relay
    with a 6000 ms timeout, `limit: 50`, `until` cursors. It reports queried vs
    responding relays.
  - `getLazarusScanRelays(pubkey)`: `fetchRelayList(pubkey)` read+write, then
    `relayConfigSettings` defaults, then `LAZARUS_ARCHIVAL_RELAYS`.
  - `getLazarusPublishRelays`: `write` = `getWriteRelays()` (falling back to
    the defaults); `extra` = other responders.
  - `fetchLatestLazarusVersion`: `limit: 1` on the write relays.
  - `fitsNip46Request`: copied from Jumble.
- Delete `src/lib/followRecovery.js`, `tests/follow-recovery.test.js` and the
  DEV-only "publish empty kind:3" wipe in `FollowRecovery.vue`. Its job is
  covered by the ported tombstone and clobber-episode fixtures.

### 2. Kinds for PvZ

PvZ is a follow-list manager, so it does not need the whole registry. It
does need both Tier 1 kinds to call itself Lazarus-compatible.

| Kind | Why here | Phase |
|---|---|---|
| 3 Follows | Core of the app; purges are a clobber vector | 1 |
| 10000 Mutes | Tier 1; needed for conformance | 2 |
| 0 Profile | Pairs with Resurrector, which already republishes kind 0 | 3 |
| 10002 Relay list | PvZ already edits NIP-65 (`addRelayToNip65`) | 3 |
| 10003, 10044, 10050, 10006 | Optional: the registry drives the UI, so each is ~free once the UI is generic | 4 |

### 3. Signer and encryption parity

- Add an nsec branch to `nostrService.encryptData`/`decryptData`, using
  nostr-tools `nip44` (v2 conversation key to self) and `nip04`. This fixes
  NIP-78 backups for nsec users as a side effect.
- Remove the nip07/nip46-only guard in `applyImportedFollowList`
  (L285-290): `signEventWithCurrentMethod` already handles nsec.
- Mute private items (phase 2): decrypt only visible rows, and on NIP-46 only
  on review. Feed the results to `applyLazarusPrivateTags`.

### 4. UI: generalize the Recover tab

The home stays the **Recover** tab in `BackupsView.vue` (route `/recover`).
It already sits next to the NIP-78 backup card and the hist.nostr.land card,
which is the right neighbourhood. Also add `Recover` to the App.vue route
maps so the Backups pill highlights on `/recover`, and add `'Zombie Check'`
to the initial map while there.

Replace `FollowRecovery.vue` / `FollowRecoveryCandidateRow.vue` with:

- `LazarusRecovery.vue`
  - Kind picker from `getLazarusKindProfiles()` filtered to PvZ's kinds.
  - Keeps the opt-in gate; scans only on click.
  - Summary line, plus a relay disclosure (queried / answered / archival).
- `LazarusCandidateList.vue`
  - Newest first, with a size toggle for count kinds.
  - Recommended row pinned.
  - Small-edit runs and clobber episodes folded into groups (episodes
    labelled).
  - Past empties hidden until asked for and never restorable.
  - "Load older versions" while `olderCursors` remain.
- `LazarusCandidateRow.vue`
  - Count: exact, `min–max`, or "partially counted".
  - Date, relative age, found-on relays.
  - Badges: Current, Recommended, Empty, "too large for remote signer"
    (NIP-46).
- `LazarusReviewModal.vue`: replaces `window.confirm`.
  - Delta: +N/−M with expandable pubkey lists. Reuse existing profile
    rendering for the added and removed follows; showing who comes back is
    the most useful thing PvZ can add here.
  - Kind 0 shows a field diff.
  - Re-mute warning for 10000; stale-relay warning plus a liveness ping for
    10002.
  - A separate second confirmation when the delta shrinks the list.
  - The button names the publish ("Restore follow list from 3 Sep 2026 —
    1,204 follows").
- View-only sessions (no signer) can scan but not restore.

### 5. The restore click

1. Local snapshot of the current version via `backupService.createBackup`
   (as today). This is the tie-in with backups: the version being replaced
   is always kept.
2. `fetchLatestLazarusVersion`. If it changed since review, recompute the
   delta and re-ask.
3. Assert `nostrService.pubkey` equals the list author, before and after
   signing.
4. `buildLazarusRecoveryDraft(chosen, { current })`, then
   `signEventWithCurrentMethod` (exactly one call).
5. `publishEventToRelays(signed, write)` decides success. Then publish to
   `extra` best-effort.
6. **Update local state:**
   - kind 3: set `nostrService.follows` from the signed event, and invalidate
     zombieService scan caches and follow-derived stats.
   - 10002: `userRelayList` via `parseRelayList`.
   - 0: the profile cache.
   Then re-rank with the published event merged in.

### 6. Relationship to NIP-78 and local backups

- **Formats stay separate.** Lazarus never reads or writes kind 30078 or the
  localforage backups, and they never feed ranking.
- Make both backup restore paths (`applyImportedFollowList`, the relay
  backup restore) use the same safety rules via shared helpers:
  - `created_at = max(now, current+1)`
  - Re-read before publishing.
  - Show a delta against current before the click (the same review modal,
    fed a synthetic candidate).
- Backups keep only pubkeys. Restoring one drops `t` tags, petnames, relay
  hints and `content`. Mention this in the backup restore modal, and point
  to Lazarus ("relay history may hold the full event"). Optionally, start
  storing the full signed kind 3 event in new backups (backward-compatible
  `event` field).
- Update the stale "NIP-04" copy in `BackupsView.vue` (L195, L206) and the
  README: the code prefers NIP-44.

## Delivery (PRs)

1. **Stop auto-publishing on init.** Step 0, plus the nsec encryption and
   `applyImportedFollowList` fixes.
2. **Core port + tests.** `src/lib/lazarus/*` with the ported specs and an
   adapter test (a fake `SimplePool`, following
   `tests/nip46-relay-reachability.test.js`). No UI change.
3. **Kind 3 on the new UI.** Review modal, paging, grouping, local state
   update. Remove the old recovery code and the DEV wipe.
4. **Kind 10000** (private items, re-mute warning).
5. **Kinds 0 and 10002** (field diff, liveness), then optional kinds.
6. **Backup hardening and docs.** Shared restore-safety helpers, full-event
   backups, README.
7. Version bump.

## Tests (conformance)

- The ported Jumble vectors (tombstone, meaningful-empty, partially counted,
  private estimate, gradual curation, clobber episode, settled, delta
  identity, paging, draft timestamp, NIP-46 fit).
- PvZ-specific:
  - Scan relays include NIP-65 read relays and the archival set.
  - Recovery copies non-`p` tags verbatim.
  - Restore re-asks when current changed.
  - Restore refuses an author mismatch.
  - `nostrService.follows` updates after restore.
  - `backupService.init()` never publishes.
- When the Lazarus repo publishes shared JSON vectors or `conformance()`,
  import them instead.

## Open questions

- Should Resurrector (kind 5 deletion undo + kind 0 republish) link into the
  kind 0 recovery? The spec keeps NIP-09 out of scope, so Resurrector stays a
  separate tool; only the kind 0 republish overlaps.
- Share one npm package (the spec's reference library) across PvZ, Mutable
  and Jumble once the spec reaches 1.0.
