import nostrService from "../../services/nostrService.js";
import backupService from "../../services/backupService.js";

// The app's own copies of what a restore changed. The spec requires this:
// "Implementations MUST update their own local copy of the list with the
// recovered version. Otherwise the client's next edit rebuilds from the
// clobbered copy and clobbers the list again."
//
// Plebs vs. Zombies edits the follow list (every purge rewrites it) and shows
// the profile and relay list. It holds no mute list, bookmarks, or key lists,
// so those kinds have nothing here to update.

const HEX_PUBKEY = /^[0-9a-f]{64}$/;

// Every field is set, even the ones the restored profile lacks: a restore
// replaces the whole profile, so a field it doesn't have is gone, not kept.
export function profileFromEvent(event) {
  let fields = {};
  try {
    const parsed = JSON.parse(event.content || "{}");
    if (parsed && typeof parsed === "object") fields = parsed;
  } catch {
    // An unreadable profile restores as an empty one.
  }
  const text = (key) =>
    typeof fields[key] === "string" ? fields[key] : undefined;
  return {
    pubkey: event.pubkey,
    name: text("name"),
    display_name: text("display_name") ?? text("displayName"),
    about: text("about"),
    picture: text("picture"),
    banner: text("banner"),
    nip05: text("nip05"),
    lud16: text("lud16"),
    website: text("website"),
  };
}

export function applyRestoreLocally(signed) {
  // A purge reads this before it rewrites the follow list, so it builds on the
  // restored version even when the relays it reaches still serve the clobber.
  nostrService.rememberOwnEvent(signed);

  if (signed.kind === 0) {
    const profile = profileFromEvent(signed);
    nostrService.userProfile = profile;
    // A reload shows the cached profile before relays answer.
    try {
      localStorage.setItem(
        `profile_${signed.pubkey}`,
        JSON.stringify({ ...profile, timestamp: Date.now() }),
      );
    } catch {
      // A stale cache only lasts until the next profile fetch.
    }
    // The header listens for this to refresh the avatar and name.
    window.dispatchEvent(
      new CustomEvent("user-profile-loaded", { detail: profile }),
    );
  } else if (signed.kind === 10002) {
    nostrService.userRelayList = nostrService.parseRelayList(signed);
  }
}

// The follow list being replaced also goes into Backup History, alongside the
// verbatim copy the Lazarus archive keeps, so it can be restored the familiar
// way too.
export async function snapshotFollowListToBackups(event) {
  const follows = event.tags
    .filter((tag) => tag[0] === "p" && HEX_PUBKEY.test(tag[1] || ""))
    .map((tag) => tag[1]);
  const now = Date.now();
  await backupService.storeBackup({
    pubkey: event.pubkey,
    npub: nostrService.hexToNpub(event.pubkey),
    timestamp: now,
    followCount: follows.length,
    follows,
    id: backupService.generateBackupId(),
    notes: "Auto-snapshot before relay history restore",
    createdAt: now,
  });
}
