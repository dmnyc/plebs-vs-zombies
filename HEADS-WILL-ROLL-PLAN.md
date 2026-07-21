# Plan: "Heads Will Roll" — live avatar marquee during scan

## Context

Plebs vs. Zombies (`github.com/dmnyc/plebs-vs-zombies`, Vue 3 + Vite + Tailwind + nostr-tools/NDK) scans a user's Nostr follow list and classifies each account as a pleb (active) or a zombie (`burned` / `ancient` / `rotting` / `fresh`). Today the scan UI (`ZombieHuntingView.vue`) shows only a progress bar, a count, and the npub being processed — no faces. The requested feature ("heads will roll"): as each follow is classified, their avatar rolls across a horizontal "⚔ HEADS WILL ROLL ⚔" marquee — zombies pick up a decay/skull treatment, plebs pass through clean, oldest exit the right edge. Chosen motion: **rolling marquee** (L→R, new heads enter left). This makes the long scan feel alive and leans into the app's existing over-the-top zombie humor (nuclear strikes, easter eggs).

The scan engine already has each user's profile (name + avatar) in hand at the exact moment it classifies them — so this is a small, additive change: emit a per-user "head" payload on the existing progress callback, and add a marquee band to the view. Gated behind a Settings toggle (default on).

## Approach

### 1. Engine — emit a per-user `head` payload
`src/services/zombieService.js`

- Add a private helper that builds and emits a head, so both scan paths stay consistent and the test has a clean seam:
  ```js
  _emitHead(progressCallback, pubkey, classification, profile) {
    if (!progressCallback) return;
    progressCallback({ head: {
      pubkey,
      npub: profile?.npub || null,
      name: profile?.display_name || profile?.name || null,
      picture: profile?.picture || null,   // NIP-01 field is .picture (confirmed)
      classification,                       // 'active' | 'burned' | 'ancient' | 'rotting' | 'fresh'
    }});
  }
  ```
- **Standard path** (`classifyZombies`, lines 43–343): call `this._emitHead(progressCallback, pubkey, <type>, profileData?.get(pubkey))` once per classified user at each branch — burned (~174), ancient-no-activity (~214, before the `continue` at 239), active (~265), ancient (~270), rotting (~290), fresh (~310), active-fallback (~331). Profile comes from the `profileData` Map argument. This fires on **every** user, independent of the existing throttled stage-reporting (lines 111–114), so all heads roll by.
- **Enhanced path** (`scanForZombiesEnhanced`, lines 686–735): call the same helper at each branch (~691, ~706, ~712, ~718, ~724, ~730) using the local `profile` variable already fetched at line 649. The `zombieInfo.type` is set in this path, so `classification = zombieInfo.type`.
- Existing callback payloads (`{stage, currentNpub, zombiesFound, processed, total}`) are unchanged — `head` is an additive optional field.

### 2. View — the marquee
`src/views/ZombieHuntingView.vue`

- **State** (`data()`): `headsWillRoll: []` (reactive chip array), `headsWillRollEnabled: true`. Add a non-reactive `this._headBuffer = []` + `this._headFlushScheduled = false` (created in `mounted`/`created`, not `data` to avoid Vue wrapping).
- **Read the toggle** at scan start (same idiom as lines 681–685): `localStorage.getItem('headsWillRoll')` → null-check → `JSON.parse` → default `true`.
- **Batch the stream** (perf for 500–5000-follow lists): in the progress callback (lines 692–705), when `progress.head` is present and enabled, `this._headBuffer.push(progress.head)` and schedule a `requestAnimationFrame` flush if not already scheduled. The flush appends buffered heads to `headsWillRoll`, then trims to the newest **~48** (`splice(0, len - 48)`), and clears the buffer. This bounds reactivity to ~frame-rate regardless of how fast the engine classifies.
- **Reset** `headsWillRoll = []` and the buffer on scan start (in `scanForZombies`, ~line 668) and in `stopScan` (~738).
- **Template**: a new card shown when `scanning && headsWillRollEnabled`, placed **above** the existing "Scanning Progress Display" card (full width of the right column). Contains the title `⚔ HEADS WILL ROLL ⚔` and a flex row of chips. Each chip prepends at the left (newest leftmost), so existing heads shift right and the oldest fall off the right edge — giving the L→R roll from the chosen mockup.
  - Chip: `<img :src="head.picture || '/default-avatar.svg'" @error="...">` ~`w-12 h-12 rounded-full`, mirroring `ZombieBatchSelector.vue:81` styling. Use the defensive `@error` pattern (reset to `/default-avatar.svg` + set `onerror=null` to avoid loops — see `FollowsManagerView.vue:614-628`).
  - Classification styling: zombies get a decay filter (`grayscale`/`sepia`/`brightness`) + type ring/badge (`burned`=🔥 charred, `ancient`=💀 dim, `rotting`=🧟 green, `fresh`=💚); `active`/plebs stay full-color + 🙂. Reuse the type→color map already in `ZombieBatchSelector.vue:108-114`.
- **Scoped `<style>`**: entrance keyframes (slide-in-from-left + `rotate(180deg)` + fade) for new chips, exit fade for trimmed ones; wrap non-essential motion in `@media (prefers-reduced-motion: no-preference)` and keep the layout itself static so reduced-motion users still see the stream.

### 3. Settings toggle
`src/views/SettingsView.vue` — mirror `autoBackupOnScan` exactly (confirmed pattern; service layer is unused by the UI, localStorage-only is consistent):
- `data()` field `headsWillRoll: true` near line 789.
- Checkbox in the Scan Settings block (~lines 224–257), same classes as line 230.
- Load in `loadSettings()` (~960) with the null-check + `JSON.parse` + default `true`.
- Save in `saveSettings()` (~934): `localStorage.setItem('headsWillRoll', JSON.stringify(this.headsWillRoll))`.
- Skip relay-backup registration (matches the existing gap for `autoBackupOnScan`/`useEnhancedScanning`).

**Default = ON**, since this is the headline feature the user requested and they'll want to see it immediately; trivially flippable to `false`. (Flagging as a deliberate choice.)

### 4. Test
`tests/heads-will-roll.test.js` (new) — follows `tests/follow-recovery.test.js` conventions (vitest primitives, plain `expect`). Introduces the repo's first `vi.mock`:
- Mock `../src/services/nostrService` (`{ default: { followsRelayLists: { has: () => false } } }`) — required because `calculateConfidenceScore` reads `nostrService.followsRelayLists.has(pubkey)` at line 366 — and `../src/services/immunityService` (`{ default: {} }`) as insurance. (`date-fns` stays real.)
- `beforeEach`: reset `zombieService.lastReportedZombieCount = 0` (singleton state leakage, line 114/117).
- Fixture: `activityData` Map with one dead pubkey (no events → `ancient`) + one active pubkey (recent event → `active`); `profileData` Map with `name` + `picture`. Call `classifyZombies(activityData, profileData, cb)`, collect payloads, assert a `head` was emitted for each with correct `{ name, picture, classification }`.

## Files
- `src/services/zombieService.js` — `_emitHead` helper + calls at every classification branch (both paths).
- `src/views/ZombieHuntingView.vue` — reactive heads array, rAF-batched flush, marquee template + scoped styles, reset on scan start/stop.
- `src/views/SettingsView.vue` — `headsWillRoll` toggle (data/load/save/UI).
- `tests/heads-will-roll.test.js` — new unit test.

## Reuse (don't reinvent)
- Avatar `<img>` + `@error` reset pattern: `src/components/ZombieBatchSelector.vue:81,84`; defensive variant `src/views/FollowsManagerView.vue:614-628,660-680`.
- Type→color/badge map: `src/components/ZombieBatchSelector.vue:108-114`.
- `getDisplayName` logic (`display_name || name || npub`): `src/components/ZombieBatchSelector.vue:529-534`.
- Settings toggle pattern: `autoBackupOnScan` in `SettingsView.vue:227-239,789-790,934-938,960-966`.
- Default avatar literal `'/default-avatar.svg'` (from `public/default-avatar.svg`).

## Verification
1. `npm test` — new `heads-will-roll.test.js` passes (and existing `follow-recovery.test.js` still green).
2. `npm run build` — no errors.
3. `npm run dev`, connect a NIP-07 extension, run a scan on a follow list containing some dormant accounts:
   - Marquee streams avatars L→R as users are classified; zombies show decay/skull styling, plebs stay clean; oldest exit right; counts/progress bar still work underneath.
   - Turn the toggle **off** in Settings → marquee does not appear on next scan; **on** → it returns.
   - Test a large list (or throttle) to confirm no jank (rAF batching + ~48-chip cap hold up).
4. Manual: confirm `prefers-reduced-motion` users still see the static stream without the spin/slide animation.

## Notes / out of scope
- Not adding to the NIP-78 relay settings backup (consistent with existing scan toggles' gap).
- Not changing classification logic or thresholds — purely additive display.
