// Versions of the user's own lists that this client published on their
// instruction: purges, restores, and restores from a backup. Recovery ranking
// uses these to tell a deliberate cut from a clobber (see findClobberEpisodes
// in recovery.js); nothing else reads them.
//
// Kept across sessions because the gap matters: someone purges today and opens
// recovery next week, and the purge still has to read as their own choice.
// Only edits made since this was added are known. An older purge still looks
// like a clobber, which the review's delta then shows as accounts re-followed.

const KEY = "plebs-vs-zombies-deliberate-edits";
// Ids are small and a purge happens a batch at a time, so this is years of use.
const MAX_PER_ACCOUNT = 500;

function storage() {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function readAll() {
  const raw = storage()?.getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function markDeliberateEdit(pubkey, eventId) {
  const store = storage();
  if (!store || !pubkey || !eventId) return;
  const all = readAll();
  const ids = Array.isArray(all[pubkey]) ? all[pubkey] : [];
  if (ids.includes(eventId)) return;
  all[pubkey] = [...ids, eventId].slice(-MAX_PER_ACCOUNT);
  try {
    store.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full: losing the hint only means a purge may read as a clobber,
    // and the review still shows exactly what a restore would re-follow.
  }
}

export function getDeliberateEditIds(pubkey) {
  const ids = readAll()[pubkey];
  return new Set(Array.isArray(ids) ? ids : []);
}
