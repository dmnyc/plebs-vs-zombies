import { describe, expect, it } from "vitest";
import { bytesToHex } from "@noble/hashes/utils";
import { generateSecretKey, getPublicKey, nip04, nip44 } from "nostr-tools";
import {
  countItemTags,
  estimatePrivateItems,
  getContentEncryption,
  getPlaintextLengthRange,
  parsePrivateTags,
} from "../src/lib/lazarus/private-items.js";

const secretKey = generateSecretKey();
const pubkey = getPublicKey(secretKey);
const conversationKey = nip44.getConversationKey(secretKey, pubkey);

function privateMutes(n) {
  const tags = Array.from({ length: n }, () => [
    "p",
    bytesToHex(generateSecretKey()),
  ]);
  const plainText = JSON.stringify(tags);
  return {
    tags,
    plainText,
    nip44Content: nip44.encrypt(plainText, conversationKey),
  };
}

describe("getContentEncryption", () => {
  it("recognizes NIP-44 and NIP-04 payloads", async () => {
    const { plainText, nip44Content } = privateMutes(3);
    expect(getContentEncryption(nip44Content)).toBe("nip44");
    expect(
      getContentEncryption(await nip04.encrypt(secretKey, pubkey, plainText)),
    ).toBe("nip04");
  });

  it("does not treat plain content as encrypted", () => {
    expect(getContentEncryption("")).toBeNull();
    expect(
      getContentEncryption(
        '{"wss://relay.damus.io":{"read":true,"write":true}}',
      ),
    ).toBeNull();
    expect(getContentEncryption("encrypted-private-items")).toBeNull();
    expect(getContentEncryption("abc?iv=not base64!")).toBeNull();
  });
});

describe("estimatePrivateItems", () => {
  it.each([0, 1, 3, 150, 593])(
    "brackets the real count of a %i-item NIP-44 list",
    (n) => {
      const { plainText, nip44Content } = privateMutes(n);
      const lengths = getPlaintextLengthRange(nip44Content);
      expect(lengths.min).toBeLessThanOrEqual(plainText.length);
      expect(lengths.max).toBeGreaterThanOrEqual(plainText.length);
      const estimate = estimatePrivateItems(nip44Content);
      expect(estimate.min).toBeLessThanOrEqual(n);
      expect(estimate.max).toBeGreaterThanOrEqual(n);
    },
  );

  it("tells an emptied list apart from a full one", () => {
    const emptied = estimatePrivateItems(privateMutes(2).nip44Content);
    const full = estimatePrivateItems(privateMutes(593).nip44Content);
    expect(full.min).toBeGreaterThan(emptied.max);
  });

  it("brackets the real count of a NIP-04 list", async () => {
    const { plainText } = privateMutes(40);
    const content = await nip04.encrypt(secretKey, pubkey, plainText);
    const lengths = getPlaintextLengthRange(content);
    expect(lengths.min).toBeLessThanOrEqual(plainText.length);
    expect(lengths.max).toBeGreaterThanOrEqual(plainText.length);
    const estimate = estimatePrivateItems(content);
    expect(estimate.min).toBeLessThanOrEqual(40);
    expect(estimate.max).toBeGreaterThanOrEqual(40);
  });

  it("returns undefined for payloads that are not a valid size", () => {
    expect(estimatePrivateItems("A".repeat(133))).toBeUndefined();
    expect(estimatePrivateItems("plain text")).toBeUndefined();
  });
});

describe("parsePrivateTags", () => {
  it("parses a decrypted tag list and rejects anything else", () => {
    const { tags, plainText } = privateMutes(2);
    expect(parsePrivateTags(plainText)).toEqual(tags);
    expect(parsePrivateTags('{"not":"tags"}')).toBeUndefined();
    expect(parsePrivateTags("not json")).toBeUndefined();
    expect(parsePrivateTags('[["p", 5]]')).toBeUndefined();
  });

  it("counts only the item tag types asked for", () => {
    const tags = [
      ["p", "a"],
      ["word", "spam"],
      ["t", "nsfw"],
      ["e", "x"],
      ["alt", "ignored"],
    ];
    expect(countItemTags(tags, ["p", "word", "t", "e"])).toBe(4);
  });
});
