/**
 * Vertex relay profile client
 *
 * Thin client for wss://relay.vertexlab.io — Vertex's indexer relay. It
 * retains kind-0 profile events the regular relays prune (dormant accounts,
 * the very ones this app hunts), which makes it the last rung for
 * pubkey → name/picture resolution after the relays and the Primal cache
 * both miss. Plain NIP-01: one REQ with the unresolved pubkeys as authors.
 *
 * The relay sees the queried pubkeys. Everything returned is public Nostr
 * data (signed kind-0 events), but it is a centralized observer the relays
 * never are. Best-effort throughout: every failure resolves empty.
 */

export const VERTEX_RELAY_URL = "wss://relay.vertexlab.io";
const DEFAULT_TIMEOUT_MS = 8000;

const isHex64 = (s) => typeof s === "string" && /^[0-9a-f]{64}$/i.test(s);

/**
 * Fetch kind-0 profile events for pubkeys → Map(pubkey → event), keeping the
 * newest event per pubkey. Returns an empty Map on any failure or timeout.
 */
export async function fetchProfiles(pubkeys, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const ids = [
    ...new Set((pubkeys || []).filter(isHex64).map((p) => p.toLowerCase())),
  ];
  const out = new Map();
  if (!ids.length) return out;

  return new Promise((resolve) => {
    let ws = null;
    let reqId = null;
    let settled = false;
    let timer = null;

    const finish = () => {
      clearTimeout(timer);
      try {
        if (ws) ws.close();
      } catch (_) {}
      resolve(out);
    };

    const settle = () => {
      if (!settled) {
        settled = true;
        finish();
      }
    };

    try {
      ws = new WebSocket(VERTEX_RELAY_URL);
    } catch (_) {
      resolve(out);
      return;
    }

    timer = setTimeout(settle, timeoutMs);

    ws.onopen = () => {
      reqId = `vertex_${Date.now()}`;
      try {
        ws.send(
          JSON.stringify([
            "REQ",
            reqId,
            { kinds: [0], authors: ids, limit: ids.length * 5 },
          ]),
        );
      } catch (_) {
        settle();
      }
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (!Array.isArray(msg) || msg.length < 2) return;
        const [type, id, payload] = msg;

        if (type === "EVENT" && payload && payload.kind === 0) {
          const key = String(payload.pubkey || "").toLowerCase();
          if (!ids.includes(key)) return;
          const prev = out.get(key);
          if (!prev || (payload.created_at || 0) > (prev.created_at || 0)) {
            out.set(key, payload);
          }
        }

        if (type === "EOSE" && id === reqId) settle();
        if (type === "CLOSED") settle();
      } catch (_) {}
    };

    ws.onerror = () => settle();
    ws.onclose = () => settle();
  });
}

/**
 * Parse a kind-0 event into profile fields, or null when the content is not
 * valid JSON.
 */
export function parseProfileEvent(event) {
  try {
    const c = JSON.parse(event.content);
    return {
      name: c.name || null,
      display_name: c.display_name || null,
      picture: c.picture || null,
      nip05: c.nip05 || null,
      about: c.about || null,
    };
  } catch (_) {
    return null;
  }
}
