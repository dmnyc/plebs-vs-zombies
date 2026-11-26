// Resolves one pubkey's name/picture server-side. The zombiecheck
// OG/preview edge functions can't dial WebSockets (Vercel edge runtime is
// fetch-only), so this Node-runtime endpoint dials the Vertex relay
// (wss://relay.vertexlab.io) on their behalf — the server-side replacement
// for the retired Nostr Archives name index. That relay retains kind-0
// profiles the regular relays prune, which is exactly who zombiecheck
// looks up. Verifies signatures; never rejects; no relay access, no card.
import WebSocket from 'ws';
import { verifyEvent } from 'nostr-tools';

const VERTEX_RELAY = 'wss://relay.vertexlab.io';
const TIMEOUT_MS = 6000;
const HEX_RE = /^[0-9a-f]{64}$/;

// Newest kind-0 for the pubkey, signature-verified, or null. Exported for
// tests and the live smoke check.
export function fetchKind0(hex, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve) => {
    let ws = null;
    let settled = false;
    let best = null;
    let timer = null;
    let reqId = null;

    const settle = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws?.close(); } catch (_) {}
      resolve(event);
    };

    timer = setTimeout(() => settle(best), timeoutMs);

    try {
      ws = new WebSocket(VERTEX_RELAY);
    } catch (_) {
      clearTimeout(timer);
      resolve(null);
      return;
    }

    ws.onopen = () => {
      reqId = `pr_${Date.now()}`;
      try {
        ws.send(JSON.stringify(['REQ', reqId, { kinds: [0], authors: [hex], limit: 5 }]));
      } catch (_) {
        settle(best);
      }
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (!Array.isArray(msg) || msg.length < 2) return;
        const [type, id, payload] = msg;
        if (type === 'EVENT' && payload && payload.kind === 0 && payload.pubkey === hex) {
          if (!best || (payload.created_at || 0) > (best.created_at || 0)) best = payload;
        }
        if ((type === 'EOSE' && id === reqId) || type === 'CLOSED') settle(best);
      } catch (_) {}
    };

    ws.onerror = () => settle(best);
    ws.onclose = () => settle(best);
  });
}

// Always answers 200 — {profile: null} is "no identity found", which the
// edge functions already treat as "serve the generic card". Cache-control
// lets Vercel's CDN absorb repeat deep links: hours for hits, a short
// window for misses so a freshly-published profile shows up soon.
export default async function handler(req, res) {
  const hex = String(
    new URL(req.url, 'http://localhost').searchParams.get('pubkey') || '',
  ).toLowerCase();

  if (!HEX_RE.test(hex)) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'pubkey must be 64-char lowercase hex' }));
    return;
  }

  let profile = null;
  try {
    const event = await fetchKind0(hex);
    if (event && verifyEvent(event)) {
      const c = JSON.parse(event.content || '{}');
      const name = c.display_name || c.name || null;
      if (name || c.picture) {
        profile = { name, display_name: c.display_name || name, picture: c.picture || null };
      }
    }
  } catch (_) {
    profile = null;
  }

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.setHeader(
    'cache-control',
    profile
      ? 'public, s-maxage=21600, stale-while-revalidate=604800'
      : 'public, s-maxage=1800',
  );
  res.end(JSON.stringify({ profile }));
}
