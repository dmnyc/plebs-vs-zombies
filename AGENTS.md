- Our website url is plebsvszombies.cc

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