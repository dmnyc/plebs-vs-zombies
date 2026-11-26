import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchProfiles,
  parseProfileEvent,
  VERTEX_RELAY_URL,
} from "../src/services/vertexRelayService.js";

const HEX = (n) => n.toString(16).padStart(64, "0");
const HEX_A = HEX(0xa);
const HEX_B = HEX(0xb);

const kind0 = (pubkey, created_at, name) => ({
  kind: 0,
  pubkey,
  created_at,
  content: JSON.stringify({ name, picture: `https://img/${name}.png` }),
});

// Minimal WebSocket double: records the REQ, lets tests drive the handlers.
class MockWS {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.closed = false;
    MockWS.instances.push(this);
  }
  send(s) {
    this.sent.push(JSON.parse(s));
  }
  close() {
    this.closed = true;
  }
  // Test helpers
  open() {
    this.onopen?.();
  }
  event(payload, id = null) {
    const reqId = id ?? this.sent[0][1];
    this.onmessage?.({ data: JSON.stringify(["EVENT", reqId, payload]) });
  }
  eose(id = null) {
    const reqId = id ?? this.sent[0][1];
    this.onmessage?.({ data: JSON.stringify(["EOSE", reqId]) });
  }
  fail() {
    this.onerror?.(new Error("boom"));
  }
}

beforeEach(() => {
  MockWS.instances = [];
  vi.stubGlobal("WebSocket", MockWS);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchProfiles", () => {
  it("REQs kind-0 for the requested authors and returns the newest event per pubkey", async () => {
    const promise = fetchProfiles([HEX_A.toUpperCase(), HEX_B]);
    const ws = MockWS.instances[0];
    expect(ws.url).toBe(VERTEX_RELAY_URL);
    ws.open();

    const [, reqId, filter] = ws.sent[0];
    expect(filter).toEqual({
      kinds: [0],
      authors: [HEX_A, HEX_B],
      limit: 10,
    });

    ws.event(kind0(HEX_A, 100, "old"));
    ws.event(kind0(HEX_A, 200, "new")); // newer wins
    ws.event(kind0(HEX_B.toUpperCase(), 300, "bee")); // casing normalized
    ws.event(kind0(HEX(0xc), 400, "not-asked")); // filtered out
    ws.eose(reqId);

    const out = await promise;
    expect(out.size).toBe(2);
    expect(JSON.parse(out.get(HEX_A).content).name).toBe("new");
    expect(JSON.parse(out.get(HEX_B).content).name).toBe("bee");
    expect(ws.closed).toBe(true);
  });

  it("resolves empty for non-hex pubkeys without opening a socket", async () => {
    const out = await fetchProfiles(["not-a-key", ""]);
    expect(out.size).toBe(0);
    expect(MockWS.instances).toHaveLength(0);
  });

  it("resolves empty when the socket errors", async () => {
    const promise = fetchProfiles([HEX_A]);
    MockWS.instances[0].fail();
    const out = await promise;
    expect(out.size).toBe(0);
    expect(MockWS.instances[0].closed).toBe(true);
  });

  it("resolves empty on timeout and closes the socket", async () => {
    const promise = fetchProfiles([HEX_A], 30);
    MockWS.instances[0].open(); // never answers
    const out = await promise;
    expect(out.size).toBe(0);
    expect(MockWS.instances[0].closed).toBe(true);
  });

  it("resolves empty when the constructor throws", async () => {
    vi.stubGlobal(
      "WebSocket",
      class {
        constructor() {
          throw new Error("no sockets here");
        }
      },
    );
    const out = await fetchProfiles([HEX_A]);
    expect(out.size).toBe(0);
  });
});

describe("parseProfileEvent", () => {
  it("parses profile fields and tolerates junk content", () => {
    expect(parseProfileEvent(kind0(HEX_A, 1, "strike"))).toMatchObject({
      name: "strike",
      picture: "https://img/strike.png",
    });
    expect(parseProfileEvent({ content: "not json" })).toBeNull();
  });
});
