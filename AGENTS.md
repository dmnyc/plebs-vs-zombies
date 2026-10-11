- Our website url is plebsvszombies.cc

## Versioning

Every shipped change gets a `package.json` version bump — in the same commit
or the one immediately after, never left behind:

- **patch** (third number, e.g. 1.2.1 → 1.2.2) for small fixes and UI updates
- **minor** (second number, e.g. 1.2.1 → 1.3.0) for features

## Deploying

Production (plebsvszombies.cc) deploys by merging a PR to `main` — Vercel's
git integration rebuilds automatically. Never put anything on production
without an explicit instruction to do so in the current conversation:

- "Test it" / "try it" / "let me check" means a preview deploy: `vercel`
  with no flags. Share the preview URL — the production alias is never
  touched.
- Never run `vercel --prod` unless production is asked for by name in the
  current conversation. A CLI deploy uploads the whole working tree,
  including uncommitted, unreviewed files.
- When an instruction could plausibly mean either preview or production,
  ask before deploying.

## Relay reliability check (self-improvement process)

With every PR merge or version bump, run `node scripts/relay-health.js` and
suggest replacements or additions based on the output:

- Flag DEAD / AUTH / EMPTY / SLOW relays in the shipped lists
  (`src/services/nostrService.js` this.relays + DEEP_SCAN_RELAYS,
  `public/zombiecheck.html` RELAYS + DEEP_RELAYS).
- A DEAD verdict from the script is a signal, not proof — it probes without a
  browser Origin header, and some CDN-fronted relays drop such handshakes.
  Cross-check in a browser (or with an Origin header) before suggesting
  removal. ECONNREFUSED / ENOTFOUND are real: the host is down or the DNS is
  gone.
- Suggest removals for relays that fail for real, and additions only for
  candidates that answer the generic probe AND demonstrably hold data the
  shipped relays lack (the deep-scan list exists for exactly this).