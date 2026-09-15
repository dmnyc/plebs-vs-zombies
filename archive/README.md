# Archive

Historical files kept for reference but no longer part of the active app.
Everything here is safe to delete; git history preserves it regardless.

## 2025-competition/

Everything from the **October 2025 Zombie Challenge**, the community competition
that has since ended:

- `leaderboard.html`, `competition.html` — the standalone static leaderboard and
  competition pages that used to ship in `public/` (routes `/leaderboard` and
  `/competition` were removed from `vercel.json`).
- `oadissin-competition-analysis.html`, `top-zombie-challenge-october-2025.html`,
  `zombie-score-analysis-2025-09-14-to-20.html`, `README-chart-creation.md` —
  the old `charts/` folder and competition analysis.
- `fetch-leaderboard-profiles.js`, `add-to-leaderboard.js`,
  `validate-protected-entries.js`, `extract-from-note.js` — leaderboard
  maintenance scripts.
- `check-competition-markers.sh`, `remove-competition-components.sh` —
  competition marker tooling.
- `add-npub-to-following-space.js`, `decode-following-space-event.js`,
  `update-following-space.js` — following.space leaderboard-participant sync.
- `COMPETITION-OCTOBER-2025.md` — competition rules and notes.
- `temp-user-backup-analysis/` — **private** Nostr backup data used during the
  competition fraud investigation. Git-ignored; never publish this folder.

## debug/

One-off debugging scripts and investigation notes from 2025 development:
`debug-nip07.js`, `debug-unknown-user.js`, `debug-zombie-detection.js`,
`zombie-investigation.js`, `zombie-comparison-analysis.md`.

See also `docs/archive/` for historical planning documents
(`IMPLEMENTATION.md`, `NIP-46-INVESTIGATION.md`, `PRIMAL-API-INTEGRATION.md`,
`MEMORY-OPTIMIZATION-SUMMARY.md`, `RELAY_SETTINGS_STORAGE_PLAN.md`,
`SURVIVOR-INDEX-PLAN.md`, `dev-notes.md`).
