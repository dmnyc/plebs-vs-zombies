import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetBackoff, searchPubkeys } from "../src/services/brainstormSearchService.js";

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
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchPubkeys", () => {
  it("posts the query and returns lowercased hex pubkeys in rank order", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        results: [
          { pubkey: HEX_A.toUpperCase(), rank: 10 },
          { pubkey: HEX_B, rank: 5 },
          { pubkey: "nothex", rank: 99 },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const out = await searchPubkeys("fiatjaf", 8);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brainstorm.world/search/pubkeys");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ query: "fiatjaf", limit: 8 });
    expect(out).toEqual([
      { pubkey: HEX_A, rank: 10 },
      { pubkey: HEX_B, rank: 5 },
    ]);
  });

  it("ignores short queries without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await searchPubkeys("c")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves empty on an empty result set", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ results: [] })));
    expect(await searchPubkeys("zzxxqq")).toEqual([]);
  });

  it("backs off after a 429 and skips the next call", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, { status: 429, retryAfter: "60" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await searchPubkeys("cassie")).toEqual([]);
    expect(await searchPubkeys("cassie")).toEqual([]); // cooled down — no second call
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves empty without backoff when the request fails", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("boom");
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await searchPubkeys("cassie")).toEqual([]);
    expect(await searchPubkeys("cassie")).toEqual([]); // no cooldown — tried again
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
