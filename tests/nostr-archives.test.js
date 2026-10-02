import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getProfilesMetadata,
  hasIdentity,
  resetBackoff,
  suggestNames,
} from "../src/services/nostrArchivesService.js";

const HEX = (n) => n.toString(16).padStart(64, "0");
const HEX_A = HEX(0xa);
const HEX_B = HEX(0xb);

function jsonResponse(body, { status = 200, retryAfter = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === "retry-after" ? retryAfter : null) },
    json: async () => body,
  };
}

beforeEach(() => {
  resetBackoff();
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("suggestNames", () => {
  it("maps suggestions to lowercase pubkeys with resolved names", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        suggestions: [
          { pubkey: HEX_A.toUpperCase(), display_name: "Cassie", picture: "p.png" },
          { pubkey: HEX_B, preferred_name: "Preferred", name: "Ignored" },
          { pubkey: "nothex", name: "Dropped" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const out = await suggestNames("cas", 8);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out).toEqual([
      { pubkey: HEX_A, name: "Cassie", display_name: "Cassie", picture: "p.png" },
      { pubkey: HEX_B, name: "Preferred", display_name: "Preferred", picture: null },
    ]);
  });

  it("ignores short queries without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await suggestNames("c")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("backs off after a 429 and skips the next call", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, { status: 429, retryAfter: "60" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await suggestNames("cassie")).toEqual([]);
    expect(await suggestNames("cassie")).toEqual([]); // cooled down — no second call
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("getProfilesMetadata", () => {
  it("returns a map of metadata keyed by lowercase pubkey", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        profiles: [
          { pubkey: HEX_A, name: "strike", display_name: "strike", nip05: "_@strike.me" },
          { pubkey: HEX_B, name: null, display_name: null, picture: null },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const out = await getProfilesMetadata([HEX_A.toUpperCase(), HEX_B]);
    expect(out.get(HEX_A)).toMatchObject({ name: "strike", nip05: "_@strike.me" });
    expect(out.get(HEX_B)).toMatchObject({ name: null });
  });

  it("chunks requests at the 500-pubkey API limit", async () => {
    const fetchMock = vi.fn(async (_url, opts) => {
      const sent = JSON.parse(opts.body).pubkeys;
      return jsonResponse({ profiles: sent.map((pk) => ({ pubkey: pk, name: "x" })) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const ids = Array.from({ length: 600 }, (_, i) => HEX(i + 1));
    const out = await getProfilesMetadata(ids);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).pubkeys).toHaveLength(500);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).pubkeys).toHaveLength(100);
    expect(out.size).toBe(600);
  });

  it("stops early on a 429 and reports no results while cooling down", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, { status: 429, retryAfter: "60" }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await getProfilesMetadata([HEX_A, HEX_B]);
    expect(out.size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1); // first chunk backed off, no retries

    const again = await getProfilesMetadata([HEX_A]);
    expect(again.size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1); // cooldown: no new call
  });

  it("drops non-hex pubkeys before calling the API", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ profiles: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await getProfilesMetadata(["not-a-key", HEX_A]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).pubkeys).toEqual([HEX_A]);
  });
});

describe("hasIdentity", () => {
  it("requires a name or picture — the API echoes unknown pubkeys with nulls", () => {
    expect(hasIdentity(null)).toBe(false);
    expect(hasIdentity({ name: null, display_name: null, preferred_name: null, picture: null })).toBe(false);
    expect(hasIdentity({ name: "strike" })).toBe(true);
    expect(hasIdentity({ name: null, picture: "p.png" })).toBe(true);
  });
});
