import { describe, expect, it } from "vitest";
import {
  buildShareNote,
  ZOMBIECHECK_BASE_URL,
} from "../src/lib/sharing/noteText.js";

const aliveResult = {
  emoji: "🫀",
  label: "Alive!",
  detail: "Active — last seen less than a day ago.",
  deletionStatus: { icon: "✅", text: "No deletion request found." },
  displayName: "Wallet of Satoshi",
  profile: {
    pubkey: "a".repeat(64),
    npub: "npub1hcwcj72example000000000000000000000000000j4h9rq",
    name: "wallet",
  },
};

const zombieResult = {
  emoji: "💀",
  label: "Ancient Zombie",
  detail: "Gone for 2 years, 3 months.",
  deletionStatus: { icon: "⚠️", text: "This profile is currently flagged as deleted." },
  displayName: "Ghost Account",
  profile: {
    pubkey: "b".repeat(64),
    npub: "npub1ghostexample00000000000000000000000000000000",
    name: "ghost",
  },
};

describe("buildShareNote", () => {
  it("opens first-person with the subject as a bare nostr: mention", () => {
    const { content } = buildShareNote(aliveResult);
    const firstLine = content.split("\n")[0];
    expect(firstLine).toBe(
      "I just ran a zombie check on nostr:npub1hcwcj72example000000000000000000000000000j4h9rq and here's what I found:",
    );
  });

  it("states the verdict on its own line, then detail and deletion status", () => {
    const { content } = buildShareNote(zombieResult);
    const lines = content.split("\n");
    expect(lines[2]).toBe("💀 Ancient Zombie");
    expect(content).toContain("Gone for 2 years, 3 months.");
    expect(content).toContain("⚠️ This profile is currently flagged as deleted.");
  });

  it("deep-links back to a re-runnable check for the same npub", () => {
    const { content } = buildShareNote(aliveResult);
    expect(content).toContain(
      `${ZOMBIECHECK_BASE_URL}?npub=${aliveResult.profile.npub}`,
    );
  });

  it("appends the image URL on its own line so clients render it", () => {
    const imageUrl = "https://blossom.nostr.build/abc123.png";
    const { content } = buildShareNote(aliveResult, { imageUrl });
    const lines = content.split("\n");
    const urlIndex = lines.indexOf(imageUrl);
    expect(urlIndex).toBeGreaterThan(0);
    expect(lines[urlIndex - 1]).toBe("");
  });

  it("omits the image section when no image was uploaded", () => {
    const { content } = buildShareNote(aliveResult);
    expect(content).not.toMatch(/https?:\/\/blossom/);
  });

  it("tags the subject first when a pubkey is present", () => {
    const { tags } = buildShareNote(aliveResult);
    expect(tags[0]).toEqual(["p", aliveResult.profile.pubkey]);
    expect(tags).toContainEqual(["t", "ZombieCheck"]);
    expect(tags).toContainEqual(["t", "PlebsVsZombies"]);
    expect(tags).toContainEqual(["client", "Plebs vs. Zombies"]);
  });

  it("leaves out the p-tag when the profile has no pubkey", () => {
    const { tags } = buildShareNote({
      ...aliveResult,
      profile: { npub: aliveResult.profile.npub },
    });
    expect(tags.every(([name]) => name !== "p")).toBe(true);
  });

  it("falls back to a plain name only when there is no npub to mention", () => {
    const { content } = buildShareNote({
      ...aliveResult,
      displayName: "",
      profile: { pubkey: aliveResult.profile.pubkey },
    });
    expect(content).toContain(
      "I just ran a zombie check on Anonymous and here's what I found:",
    );
    expect(content).toContain(`Run your own zombie check: ${ZOMBIECHECK_BASE_URL}`);
  });
});
