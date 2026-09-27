import { isLazarusVersion } from "./recovery.js";
import { normalizeLazarusRelayUrl } from "./relay-url.js";

export { normalizeLazarusRelayUrl };

// The relay layer for Lazarus. Each request opens its own socket and reads the
// relay's actual EOSE / CLOSED / close, so an unreachable relay is never
// mistaken for an empty one (pooled clients report EOSE on failures), and every
// socket is closed when its request ends.
//
// Deliberately independent of nostrService's NDK pool: that pool lets NDK's
// outbox tracker choose which relays a query reaches, which is exactly wrong
// for recovery, where every relay named must actually be asked.

const RELAY_LIST_KIND = 10002;
export const LAZARUS_SCAN_TIMEOUT_MS = 6000;
export const LAZARUS_REREAD_TIMEOUT_MS = 5000;
const PUBLISH_TIMEOUT_MS = 8000;
const SCAN_LIMIT = 50;
const DEFAULT_CONCURRENCY = 12;
const MAX_EVENTS_PER_REQUEST = 1000;

// Relays observed keeping replaceable history (Lazarus README, 2026-09).
export const LAZARUS_ARCHIVAL_RELAYS = [
  "wss://relay.ditto.pub",
  "wss://hist.nostr.land",
  "wss://nos.lol",
  "wss://nostr.mom",
  "wss://purplepag.es",
  "wss://nostr.bitcoiner.social",
];

const SOCKET_OPEN = 1;

const browserSocketFactory = (url) => new WebSocket(url);

let socketFactory = browserSocketFactory;

// Tests inject a fake relay; called with no argument it restores WebSocket.
export function setLazarusSocketFactory(factory) {
  socketFactory = factory ?? browserSocketFactory;
}

export function uniqueRelayUrls(urls) {
  return Array.from(
    new Set(urls.map(normalizeLazarusRelayUrl).filter((url) => !!url)),
  );
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function closeSocket(socket, farewell) {
  if (!socket) return;
  socket.onopen = null;
  socket.onmessage = null;
  socket.onerror = null;
  socket.onclose = null;
  try {
    if (farewell && socket.readyState === SOCKET_OPEN) socket.send(farewell);
  } catch {
    // The socket is going away regardless.
  }
  try {
    socket.close();
  } catch {
    // Already closed.
  }
}

function parseMessage(data) {
  try {
    const parsed = JSON.parse(String(data));
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

// Events sent before a failure or timeout are kept: they're real versions,
// even though that relay's history is incomplete. Resolves to
// { url, events, outcome: "answered" | "failed" | "timed-out", reason? }.
export function requestFromRelay(
  url,
  filters,
  timeoutMs = LAZARUS_SCAN_TIMEOUT_MS,
  signal,
) {
  return new Promise((resolve) => {
    const events = [];
    const subId = `lazarus-${Math.random().toString(36).slice(2, 10)}`;
    let socket;
    let done = false;

    const finish = (outcome, reason) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      closeSocket(socket, JSON.stringify(["CLOSE", subId]));
      resolve({ url, events, outcome, reason });
    };
    const onAbort = () => finish("failed", "canceled");
    const timer = setTimeout(() => finish("timed-out"), timeoutMs);

    if (signal?.aborted) return finish("failed", "canceled");
    signal?.addEventListener("abort", onAbort);

    try {
      socket = socketFactory(url);
    } catch (error) {
      return finish("failed", errorMessage(error));
    }

    socket.onopen = () => {
      try {
        const list = Array.isArray(filters) ? filters : [filters];
        socket?.send(JSON.stringify(["REQ", subId, ...list]));
      } catch (error) {
        finish("failed", errorMessage(error));
      }
    };
    socket.onmessage = (message) => {
      const data = parseMessage(message.data);
      if (!data || data[1] !== subId) return;
      const [type, , payload] = data;
      if (type === "EVENT") {
        if (payload && typeof payload === "object") {
          if (events.length < MAX_EVENTS_PER_REQUEST) {
            events.push(payload);
          }
        }
      } else if (type === "EOSE") {
        finish("answered");
      } else if (type === "CLOSED") {
        finish("failed", typeof payload === "string" ? payload : "closed");
      }
    };
    socket.onerror = () => finish("failed", "connection error");
    socket.onclose = () => finish("failed", "connection closed");
  });
}

export async function mapWithConcurrency(
  items,
  fn,
  concurrency = DEFAULT_CONCURRENCY,
) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

export function requestFromRelays(
  urls,
  filtersFor,
  { timeoutMs, concurrency, signal } = {},
) {
  return mapWithConcurrency(
    urls,
    (url) => requestFromRelay(url, filtersFor(url), timeoutMs, signal),
    concurrency,
  );
}

function requestOptions(config) {
  return {
    timeoutMs: config.timeoutMs,
    concurrency: config.concurrency,
    signal: config.signal,
  };
}

function newestValid(events, kind, pubkey) {
  return events
    .filter((event) => isLazarusVersion(event, kind, pubkey))
    .sort((a, b) => b.created_at - a.created_at || (a.id < b.id ? -1 : 1))[0];
}

// An unmarked relay is both read and write (NIP-65).
export function parseRelayListEvent(event) {
  const read = [];
  const write = [];
  for (const [name, url, marker] of event.tags) {
    if (name !== "r" || !url) continue;
    if (marker !== "write") read.push(url);
    if (marker !== "read") write.push(url);
  }
  return { read: uniqueRelayUrls(read), write: uniqueRelayUrls(write) };
}

// The newest relay list, from relays or the app's copy. A list relays answered
// without is missing (default write relays stand in, labeled); one no relay
// answered for, with no copy on hand, is unknown and never substituted. A
// copy with no `createdAt` loses to any relay's.
//
// config: { defaultRelays, defaultWriteRelays?, archivalRelays?,
// ownRelayList?: { read, write, createdAt }, timeoutMs?, concurrency?,
// signal? }. `defaultWriteRelays` leaves out defaults meant only for reading,
// which can't judge a write; it falls back to `defaultRelays`.
export async function resolveLazarusRelays(pubkey, config) {
  const lookupRelays = uniqueRelayUrls([
    ...config.defaultRelays,
    ...(config.archivalRelays ?? LAZARUS_ARCHIVAL_RELAYS),
  ]);
  const answers = await requestFromRelays(
    lookupRelays,
    () => ({ kinds: [RELAY_LIST_KIND], authors: [pubkey], limit: 1 }),
    requestOptions(config),
  );
  const newest = newestValid(
    answers.flatMap((answer) => answer.events),
    RELAY_LIST_KIND,
    pubkey,
  );
  const own = config.ownRelayList;
  const ownCreatedAt = Number.isFinite(own?.createdAt) ? own.createdAt : -Infinity;

  let found;
  if (newest && (!own || newest.created_at >= ownCreatedAt)) {
    found = parseRelayListEvent(newest);
  } else if (own && (own.read.length > 0 || own.write.length > 0)) {
    found = {
      read: uniqueRelayUrls(own.read),
      write: uniqueRelayUrls(own.write),
    };
  }

  if (!found && !answers.some((answer) => answer.outcome === "answered")) {
    return { read: [], write: [], relayList: "unknown" };
  }
  if (!found || found.write.length === 0) {
    return {
      read: found?.read ?? [],
      write: uniqueRelayUrls(config.defaultWriteRelays ?? config.defaultRelays),
      relayList: "missing",
    };
  }
  return { ...found, relayList: "found" };
}

export async function getLazarusScanPlan(pubkey, config) {
  const user = await resolveLazarusRelays(pubkey, config);
  return {
    ...user,
    relays: uniqueRelayUrls([
      ...user.write,
      ...user.read,
      ...config.defaultRelays,
      ...(config.archivalRelays ?? LAZARUS_ARCHIVAL_RELAYS),
    ]),
  };
}

// Versions of `kind` from each relay: only valid ones count, as candidates,
// toward responding relays, and for paging.
export async function fetchLazarusVersionsFrom(
  kind,
  pubkey,
  urls,
  config,
  cursors,
) {
  const answers = await requestFromRelays(
    urls,
    (url) => {
      const filter = {
        kinds: [kind],
        authors: [pubkey],
        limit: SCAN_LIMIT,
      };
      return cursors ? { ...filter, until: cursors[url] } : filter;
    },
    requestOptions(config),
  );

  const tagged = [];
  const respondingRelays = [];
  const olderCursors = {};
  const outcomes = {};
  for (const { url, events, outcome } of answers) {
    outcomes[url] = outcome;
    const versions = events.filter((event) =>
      isLazarusVersion(event, kind, pubkey),
    );
    if (versions.length > 0) respondingRelays.push(url);
    for (const event of versions) tagged.push({ event, relayUrl: url });
    // A full page may hide older versions. `until` is inclusive, so a cursor
    // that didn't move means the relay has nothing older.
    if (versions.length >= SCAN_LIMIT) {
      const oldest = Math.min(...versions.map((e) => e.created_at));
      if (!cursors || oldest < cursors[url]) olderCursors[url] = oldest;
    }
  }
  return { tagged, respondingRelays, olderCursors, outcomes };
}

const PLAN_TTL_MS = 10 * 60 * 1000;

export function createLazarusRelaySource(config) {
  // Scanning several kinds in a row shouldn't look the relay list up each time.
  const plans = new Map();
  const planFor = (pubkey) => {
    const cached = plans.get(pubkey);
    if (cached && Date.now() - cached.at < PLAN_TTL_MS) return cached.plan;
    const plan = getLazarusScanPlan(pubkey, config);
    plans.set(pubkey, { plan, at: Date.now() });
    // A plan built without the user's relay list is never reused.
    plan.then(
      (resolved) => {
        if (resolved.relayList === "unknown") plans.delete(pubkey);
      },
      () => plans.delete(pubkey),
    );
    return plan;
  };

  return {
    async fetchVersions(kind, pubkey, cursors) {
      const plan = cursors ? undefined : await planFor(pubkey);
      const urls = plan ? plan.relays : Object.keys(cursors ?? {});
      const result = await fetchLazarusVersionsFrom(
        kind,
        pubkey,
        urls,
        config,
        cursors,
      );
      return {
        ...result,
        queriedRelays: urls,
        ...(plan && {
          currentConfirmed: plan.write.some(
            (url) => result.outcomes[url] === "answered",
          ),
          relayList: plan.relayList,
          writeRelays: plan.write,
        }),
      };
    },
  };
}

export async function readLazarusCurrent(
  kind,
  pubkey,
  writeRelays,
  { timeoutMs = LAZARUS_REREAD_TIMEOUT_MS, concurrency, signal } = {},
) {
  const answers = await requestFromRelays(
    uniqueRelayUrls(writeRelays),
    () => ({ kinds: [kind], authors: [pubkey], limit: 1 }),
    { timeoutMs, concurrency, signal },
  );
  return answers.map(({ url, events, outcome }) => ({
    url,
    outcome,
    events: events.filter((event) => isLazarusVersion(event, kind, pubkey)),
    answered: outcome === "answered",
  }));
}

// Resolves to { url, status: "accepted" | "rejected" | "failed" | "timed-out",
// message? }, read from the relay's NIP-01 OK reply.
export function publishToRelay(url, event, timeoutMs = PUBLISH_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let socket;
    let done = false;
    const finish = (status, message) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      closeSocket(socket);
      resolve({ url, status, message });
    };
    const timer = setTimeout(() => finish("timed-out"), timeoutMs);

    try {
      socket = socketFactory(url);
    } catch (error) {
      return finish("failed", errorMessage(error));
    }
    socket.onopen = () => {
      try {
        socket?.send(JSON.stringify(["EVENT", event]));
      } catch (error) {
        finish("failed", errorMessage(error));
      }
    };
    socket.onmessage = (message) => {
      const data = parseMessage(message.data);
      if (!data || data[0] !== "OK" || data[1] !== event.id) return;
      finish(
        data[2] === true ? "accepted" : "rejected",
        typeof data[3] === "string" && data[3] ? data[3] : undefined,
      );
    };
    socket.onerror = () => finish("failed", "connection error");
    socket.onclose = () => finish("failed", "connection closed");
  });
}

// Success means at least one write relay accepted. Other relays that answered
// the scan get the restored version too, so they stop serving the clobber,
// but only once the write relays took it. `extra` is best effort and never
// affects `accepted`.
export async function publishLazarusRecovery(
  event,
  writeRelays,
  extraRelays = [],
  concurrency = DEFAULT_CONCURRENCY,
) {
  const write = uniqueRelayUrls(writeRelays);
  if (write.length === 0) throw new Error("No write relays to publish to");
  const writeResults = await mapWithConcurrency(
    write,
    (url) => publishToRelay(url, event),
    concurrency,
  );
  const accepted = writeResults.some((result) => result.status === "accepted");
  const extra = uniqueRelayUrls(extraRelays).filter(
    (url) => !write.includes(url),
  );
  return {
    accepted,
    write: writeResults,
    extra:
      accepted && extra.length > 0
        ? mapWithConcurrency(
            extra,
            (url) => publishToRelay(url, event),
            concurrency,
          )
        : Promise.resolve([]),
  };
}

// Resolves to "live" | "dead" | "timed-out".
export function probeRelay(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let socket;
    let done = false;
    const finish = (liveness) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      closeSocket(socket);
      resolve(liveness);
    };
    const timer = setTimeout(() => finish("timed-out"), timeoutMs);
    const normalized = normalizeLazarusRelayUrl(url);
    if (!normalized) return finish("dead");
    try {
      socket = socketFactory(normalized);
    } catch {
      return finish("dead");
    }
    socket.onopen = () => finish("live");
    socket.onerror = () => finish("dead");
    socket.onclose = () => finish("dead");
  });
}

// The newest version of each kind, for a data export.
export async function fetchLatestVersions(
  pubkey,
  kinds,
  relays,
  options = {},
) {
  const answers = await requestFromRelays(
    uniqueRelayUrls(relays),
    () => kinds.map((kind) => ({ kinds: [kind], authors: [pubkey], limit: 1 })),
    options,
  );
  const all = answers.flatMap((answer) => answer.events);
  const events = kinds
    .map((kind) => newestValid(all, kind, pubkey))
    .filter((event) => !!event);
  return { events, answers };
}
