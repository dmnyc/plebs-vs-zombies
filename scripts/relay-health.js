#!/usr/bin/env node
/**
 * Relay reliability check — part of the self-improvement process.
 *
 * Run before/with every PR merge or version bump:
 *   node scripts/relay-health.js
 *
 * Probes every relay the app ships with (in-app defaults, standalone
 * zombiecheck defaults, deep-scan set) plus a candidate list of possible
 * additions, and reports connect/response latency, read-openness, and event
 * yield. Use the output to suggest replacements (dead, slow, auth-gated,
 * empty) or additions (healthy candidates).
 *
 * Keep the lists below in sync with:
 *   - src/services/nostrService.js        (this.relays, DEEP_SCAN_RELAYS)
 *   - public/zombiecheck.html             (RELAYS, DEEP_RELAYS)
 *
 * "Sample query" is a generic { kinds: [0], limit: 5 } — any healthy public
 * relay answers it with events. A clean EOSE with zero events from a
 * general query is treated as a finding (empty), not a pass.
 *
 * CAVEAT: this probes from one vantage point using the `ws` client, which
 * sends no Origin header. Some CDN-fronted relays (nostr.wine, nos.lol,
 * nostr.mom have all shown this) drop handshakes without one — a DEAD
 * verdict here is a signal to cross-check in a browser, not proof. Real
 * infrastructure failures look different: ECONNREFUSED / ENOTFOUND (host
 * actually down or DNS gone) survive the Origin re-test.
 */
import WebSocket from "ws";

const LISTS = {
  "in-app defaults (nostrService.this.relays)": [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.primal.net",
    "wss://nostr.wine",
    "wss://purplepag.es",
    "wss://relay.nos.social",
  ],
  "standalone zombiecheck (public/zombiecheck.html RELAYS)": [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.primal.net",
    "wss://relay.snort.social",
    "wss://purplepag.es",
    "wss://relay.nostr.net",
    "wss://offchain.pub",
    "wss://nostr.mom",
    "wss://relay.noswhere.com",
    "wss://relay.0xchat.com",
  ],
  "deep scan (DEEP_SCAN_RELAYS / DEEP_RELAYS)": [
    "wss://soloco.nl",
    "wss://atlas.nostr.land",
  ],
  "candidates (not currently shipped)": [
    "wss://nostr.fmt.wiz.biz",
    "wss://relay.nostr.band",
    "wss://e.nos.lol",
    "wss://nostr.mother.net",
    "wss://ditto.pub",
  ],
};

const TIMEOUT_MS = 6000;

function probe(relay) {
  return new Promise((resolve) => {
    const result = {
      relay,
      connectMs: null,
      respondMs: null,
      events: 0,
      note: "",
      verdict: "DEAD",
    };
    let ws;
    let t0 = Date.now();
    let opened = false;
    const finish = (verdict) => {
      try { ws.close(); } catch {}
      result.verdict = verdict || (result.events > 0 ? "OK" : "EMPTY");
      resolve(result);
    };
    const timer = setTimeout(() => finish(opened ? "TIMEOUT" : "DEAD"), TIMEOUT_MS);
    try {
      ws = new WebSocket(relay);
    } catch (e) {
      clearTimeout(timer);
      result.note = e.message;
      finish("DEAD");
      return;
    }
    ws.on("open", () => {
      opened = true;
      result.connectMs = Date.now() - t0;
      ws.send(JSON.stringify(["REQ", "health", { kinds: [0], limit: 5 }]));
    });
    ws.on("message", (d) => {
      try {
        const m = JSON.parse(d.toString());
        if (m[0] === "EVENT") result.events += 1;
        if (m[0] === "EOSE") {
          result.respondMs = Date.now() - t0;
          clearTimeout(timer);
          finish();
        }
        if (m[0] === "NOTICE" || m[0] === "CLOSED") {
          result.note = (m[2] || "").toString().slice(0, 80);
          const low = result.note.toLowerCase();
          if (low.includes("auth")) {
            result.respondMs = Date.now() - t0;
            clearTimeout(timer);
            finish("AUTH");
          }
        }
      } catch {}
    });
    ws.on("error", (e) => {
      result.note = (e.message || "error").slice(0, 80);
      clearTimeout(timer);
      finish("DEAD");
    });
  });
}

const pad = (s, n) => String(s ?? "").padEnd(n);
let findings = [];

for (const [label, relays] of Object.entries(LISTS)) {
  console.log(`\n=== ${label} ===`);
  console.log(
    pad("relay", 28) + pad("connect", 10) + pad("respond", 10) +
    pad("events", 8) + pad("verdict", 10) + "note",
  );
  for (const relay of relays) {
    const r = await probe(relay);
    const flag =
      r.verdict === "OK" && r.respondMs != null && r.respondMs > 3000 ? " (slow)" : "";
    console.log(
      pad(relay.replace("wss://", ""), 28) +
      pad(r.connectMs != null ? r.connectMs + "ms" : "-", 10) +
      pad(r.respondMs != null ? r.respondMs + "ms" : "-", 10) +
      pad(r.events, 8) +
      pad(r.verdict + flag, 10) +
      r.note,
    );
    if (r.verdict !== "OK") {
      findings.push({ list: label, relay: r.relay, verdict: r.verdict, note: r.note });
    } else if (flag) {
      findings.push({ list: label, relay: r.relay, verdict: "SLOW", note: `${r.respondMs}ms` });
    }
  }
}

console.log("\n=== Findings (non-OK / slow) ===");
if (!findings.length) console.log("none — every shipped relay answered OK");
for (const f of findings) {
  console.log(`- [${f.verdict}] ${f.relay} (${f.list.split("(")[0].trim()})${f.note ? " — " + f.note : ""}`);
}
