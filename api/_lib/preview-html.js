// Personalizes the static zombiecheck.html's social-preview meta tags for a
// deep-linked target (?npub=…), so link previews in Nostr clients, Discord,
// X, etc. show who is being checked instead of the generic card. Pure string
// work, kept free of edge-runtime APIs so it unit-tests with vitest.
//
// All replacements target the exact strings shipped in public/zombiecheck.html
// and are counted before applying — if the static page ever drifts (a marker
// missing or duplicated), injectPreviewTags returns null and the caller serves
// the unmodified page rather than a half-personalized one.

const TITLE_MARKER = 'Zombie Check | Is that Nostr user a zombie?';
const DESCRIPTION_MARKER =
  "Check whether any Nostr user is a zombie and see how long they've been gone. No sign-in required.";
const OG_IMAGE_LINE =
  '<meta property="og:image" content="https://plebsvszombies.cc/zombiecheck-social-share.png">';
const TWITTER_IMAGE_LINE =
  '<meta property="twitter:image" content="https://plebsvszombies.cc/zombiecheck-social-share.png">';

// og:image/twitter:image point at a canonical domain so every share —
// wherever the page is reached from — resolves to the same cached PNG,
// mirroring the hardcoded absolute og:url/og:image in the static page.
export const OG_IMAGE_BASE = 'https://plebsvszombies.cc/api/zombiecheck-og';

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Long Nostr display names would blow out the preview title; the og renderer
// clamps the same way.
export function clampName(name, max = 40) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean;
}

// Returns the personalized HTML, or null when there's no identity to apply
// (no npub, no name and no picture) or a marker doesn't match exactly once
// per expected site.
export function injectPreviewTags(html, { name, npub, hasPicture = false } = {}) {
  if (!html || !npub) return null;
  const displayName = clampName(name);
  if (!displayName && !hasPicture) return null;

  const ogImage = `${OG_IMAGE_BASE}?npub=${npub}`;
  const alt = `Zombie Check card for ${escapeHtml(displayName || 'a Nostr user')}`;

  let next = html;
  if (displayName) {
    // <title>, og:title and twitter:title all carry the same marker string,
    // as do the meta description, og:description and twitter:description.
    next = replaceCounted(
      next,
      TITLE_MARKER,
      `Zombie Check | Is ${escapeHtml(displayName)} a zombie?`,
      3,
    );
    if (next === null) return null;
    next = replaceCounted(
      next,
      DESCRIPTION_MARKER,
      `Check whether ${escapeHtml(displayName)} is a zombie and see how long they've been gone. No sign-in required.`,
      3,
    );
    if (next === null) return null;
  }
  next = replaceCounted(
    next,
    OG_IMAGE_LINE,
    `<meta property="og:image" content="${ogImage}">\n` +
      `  <meta property="og:image:alt" content="${alt}">`,
    1,
  );
  if (next === null) return null;
  next = replaceCounted(
    next,
    TWITTER_IMAGE_LINE,
    `<meta property="twitter:image" content="${ogImage}">\n` +
      `  <meta property="twitter:image:alt" content="${alt}">`,
    1,
  );
  return next === html ? null : next;
}

function replaceCounted(text, marker, replacement, expected) {
  if (text === null) return null;
  const parts = text.split(marker);
  if (parts.length - 1 !== expected) return null;
  return parts.join(replacement);
}
