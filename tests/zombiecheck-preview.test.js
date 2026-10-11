import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  clampName,
  injectPreviewTags,
  OG_IMAGE_BASE,
} from "../api/_lib/preview-html.js";
import { canonicalNpub, resolveHex } from "../api/_lib/nostr-profile.js";

// The real static page, so marker counts are validated against what ships
// rather than a hand-copied fixture.
const STATIC_HTML = readFileSync(new URL("../public/zombiecheck.html", import.meta.url), "utf8");

const NPUB = "npub1az9xj85cmxv8e9j9y80lvqp97crsqdu2fpu3srwthd99qfu9qsgstam8y8";
const HEX = "e88a691e98d9987c964521dff60025f60700378a4879180dcbbb4a5027850411";

describe("resolveHex", () => {
  it("decodes npub to lowercase hex", () => {
    expect(resolveHex(NPUB)).toBe(HEX);
  });

  it("decodes nprofile to its embedded pubkey", () => {
    expect(resolveHex(canonicalNpub(HEX))).toBe(HEX);
  });

  it("accepts 64-char hex in any case", () => {
    expect(resolveHex(HEX.toUpperCase())).toBe(HEX);
  });

  it("rejects garbage, empties, and wrong-length hex", () => {
    expect(resolveHex("")).toBeNull();
    expect(resolveHex(null)).toBeNull();
    expect(resolveHex("satoshi")).toBeNull();
    expect(resolveHex("npub1notreal")).toBeNull();
    expect(resolveHex(HEX.slice(0, 63))).toBeNull();
  });
});

describe("canonicalNpub", () => {
  it("round-trips the fixture npub", () => {
    expect(canonicalNpub(HEX)).toBe(NPUB);
  });
});

describe("clampName", () => {
  it("trims and clamps long names with an ellipsis", () => {
    const long = "x".repeat(60);
    expect(clampName(`  ${long}  `)).toBe("x".repeat(39) + "…");
  });

  it("keeps short names and collapses empty to null", () => {
    expect(clampName("N")).toBe("N");
    expect(clampName("   ")).toBeNull();
    expect(clampName(null)).toBeNull();
  });
});

describe("injectPreviewTags", () => {
  const personal = { name: "N", npub: NPUB, hasPicture: true };

  it("personalizes the shipped static page", () => {
    const out = injectPreviewTags(STATIC_HTML, personal);
    expect(out).not.toBeNull();
    // <title>, og:title and twitter:title all switch to the name.
    expect(out.match(new RegExp(`<title>[^<]*Is N a zombie\\?[^<]*</title>`))).toBeTruthy();
    expect(out.match(/Is N a zombie\?/g)).toHaveLength(3);
    expect(out.match(/Check whether N is a zombie/g)).toHaveLength(3);
    // The static PNG is fully replaced by the per-user og route.
    expect(out).not.toContain("zombiecheck-social-share.png");
    expect(out.match(new RegExp(OG_IMAGE_BASE.replace(/[/?]/g, "\\$&") + `\\?npub=${NPUB}`, "g"))).toHaveLength(2);
    expect(out.match(/og:image:alt/)).toHaveLength(1);
    expect(out.match(/twitter:image:alt/)).toHaveLength(1);
  });

  it("escapes HTML-special characters in names", () => {
    const out = injectPreviewTags(STATIC_HTML, {
      name: 'Böb & "<Zombies>"',
      npub: NPUB,
      hasPicture: true,
    });
    expect(out).toContain("Böb &amp; &quot;&lt;Zombies&gt;&quot;");
    expect(out).not.toContain('Böb & "<Zombies>"');
  });

  it("works with a picture only (title/description stay generic)", () => {
    const out = injectPreviewTags(STATIC_HTML, { name: null, npub: NPUB, hasPicture: true });
    expect(out).not.toBeNull();
    expect(out).toContain("Is that Nostr user a zombie?");
    expect(out).toContain(OG_IMAGE_BASE);
  });

  it("refuses to personalize without any identity", () => {
    expect(injectPreviewTags(STATIC_HTML, { name: null, npub: NPUB, hasPicture: false })).toBeNull();
  });

  it("refuses without an npub", () => {
    expect(injectPreviewTags(STATIC_HTML, { name: "N", npub: null })).toBeNull();
  });

  it("detects marker drift instead of half-applying", () => {
    const drifted = STATIC_HTML.replace("Zombie Check | Is that Nostr user a zombie?", "New title");
    expect(injectPreviewTags(drifted, personal)).toBeNull();
  });

  it("clamps overlong names in the output", () => {
    const out = injectPreviewTags(STATIC_HTML, { name: "y".repeat(60), npub: NPUB });
    expect(out).toContain("y".repeat(39) + "…");
    expect(out).not.toContain("y".repeat(40));
  });
});
