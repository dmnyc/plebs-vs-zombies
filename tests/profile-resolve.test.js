import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import handler, { fetchKind0 } from "../api/profile-resolve.js";
import { fetchSharedProfile } from "../api/_lib/nostr-profile.js";

// Minimal ws double: records the REQ, lets tests drive the handlers.
const { MockWS } = vi.hoisted(() => {
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
  return { MockWS };
});

vi.mock("ws", () => ({ default: MockWS }));

// The handler verifies signatures, so fixtures are really signed.
const sk = generateSecretKey();
const HEX_A = getPublicKey(sk);

function kind0(hex, created_at, name, signKey = sk) {
  return finalizeEvent(
    {
      kind: 0,
      created_at,
      tags: [],
      content: JSON.stringify({ name, display_name: name, picture: `https://img/${name}.png` }),
    },
    signKey,
  );
}

function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    body: null,
    end(b) {
      this.body = b;
    },
  };
}

beforeEach(() => {
  MockWS.instances = [];
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("profile-resolve handler", () => {
  it("rejects non-hex pubkeys without dialing the relay", async () => {
    const res = makeRes();
    await handler({ url: "/api/profile-resolve?pubkey=satoshi" }, res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBeTruthy();
    expect(MockWS.instances).toHaveLength(0);
  });

  it("resolves a signed kind-0 into a profile and caches at the CDN", async () => {
    const res = makeRes();
    const promise = handler({ url: `/api/profile-resolve?pubkey=${HEX_A}` }, res);
    const ws = MockWS.instances[0];
    expect(ws.url).toBe("wss://relay.vertexlab.io");
    ws.open();
    ws.event(kind0(HEX_A, 100, "sat"));
    ws.eose();
    await promise;

    expect(res.statusCode).toBe(200);
    const out = JSON.parse(res.body);
    expect(out.profile).toEqual({
      name: "sat",
      display_name: "sat",
      picture: "https://img/sat.png",
    });
    expect(res.headers["cache-control"]).toContain("s-maxage=21600");
    expect(ws.closed).toBe(true);
  });

  it("keeps the newest event per pubkey", async () => {
    const res = makeRes();
    const promise = handler({ url: `/api/profile-resolve?pubkey=${HEX_A}` }, res);
    const ws = MockWS.instances[0];
    ws.open();
    ws.event(kind0(HEX_A, 100, "old"));
    ws.event(kind0(HEX_A, 200, "new"));
    ws.eose();
    await promise;
    expect(JSON.parse(res.body).profile.name).toBe("new");
  });

  it("answers profile:null for an unsigned event and caches briefly", async () => {
    const res = makeRes();
    const promise = handler({ url: `/api/profile-resolve?pubkey=${HEX_A}` }, res);
    const ws = MockWS.instances[0];
    ws.open();
    ws.event({ kind: 0, pubkey: HEX_A, created_at: 1, content: '{"name":"forged"}', sig: "nope", id: "x" });
    ws.eose();
    await promise;
    expect(JSON.parse(res.body).profile).toBeNull();
    expect(res.headers["cache-control"]).toContain("s-maxage=1800");
  });

  it("answers profile:null when the relay errors", async () => {
    const res = makeRes();
    const promise = handler({ url: `/api/profile-resolve?pubkey=${HEX_A}` }, res);
    MockWS.instances[0].open();
    MockWS.instances[0].fail();
    await promise;
    expect(JSON.parse(res.body).profile).toBeNull();
    expect(MockWS.instances[0].closed).toBe(true);
  });
});

describe("fetchSharedProfile (edge-side client)", () => {
  it("calls the internal endpoint and normalizes the profile", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ profile: { name: "sat", display_name: "Sat", picture: "p.png" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await fetchSharedProfile(HEX_A, "https://plebsvszombies.cc");
    expect(fetchMock).toHaveBeenCalledWith(
      `https://plebsvszombies.cc/api/profile-resolve?pubkey=${encodeURIComponent(HEX_A)}`,
      expect.anything(),
    );
    expect(out).toEqual({ name: "sat", display_name: "Sat", picture: "p.png" });

    // Cached — no second round-trip.
    await fetchSharedProfile(HEX_A, "https://plebsvszombies.cc");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves null on endpoint failure and caches the miss", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        return { ok: false };
      }),
    );
    const HEX_B = "aa".repeat(32);
    expect(await fetchSharedProfile(HEX_B, "https://plebsvszombies.cc")).toBeNull();
    expect(await fetchSharedProfile(HEX_B, "https://plebsvszombies.cc")).toBeNull();
    expect(calls).toBe(1); // negative result cached
  });
});
