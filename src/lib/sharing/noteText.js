// Share-note builder for Zombie Check results. Pure so the wording and tags
// can be tested without mounting the component; ZombieCheck.vue supplies the
// result object and the Blossom URL of the rendered card image.

export const ZOMBIECHECK_BASE_URL = 'https://plebsvszombies.cc/zombiecheck';

/**
 * Build the kind-1 note content and tags for a shared Zombie Check result.
 *
 * @param {object} result - the display result from ZombieCheck.buildResult:
 *   { emoji, label, detail, deletionStatus, displayName, profile }
 * @param {object} [options]
 * @param {string|null} [options.imageUrl] - Blossom URL of the card image,
 *   appended on its own line so clients render it as the note's picture.
 * @param {string} [options.baseUrl] - site origin, overridable for tests.
 * @returns {{ content: string, tags: string[][] }}
 */
export function buildShareNote(result, { imageUrl = null, baseUrl = '' } = {}) {
  const base = baseUrl || ZOMBIECHECK_BASE_URL;
  const npub = result.profile?.npub || '';
  const name = result.displayName || result.profile?.name || '';

  // Lead with a first-person opener and reference the subject purely as a
  // nostr: mention — clients render it as @name and thread it via the p-tag,
  // so a plain name beside it just reads as a duplicate. A plain name (or
  // Anonymous) only appears when there's no npub to link.
  const subject = npub
    ? `nostr:${npub}`
    : name || 'Anonymous';

  const lines = [
    `I just ran a zombie check on ${subject} and here's what I found:`,
    '',
    `${result.emoji} ${result.label}`,
  ];

  if (result.detail) {
    lines.push(result.detail);
  }
  if (result.deletionStatus?.text) {
    lines.push(`${result.deletionStatus.icon} ${result.deletionStatus.text}`);
  }

  lines.push('');
  lines.push(`🧟 Run your own zombie check: ${base}${npub ? `?npub=${npub}` : ''}`);

  if (imageUrl) {
    lines.push('');
    lines.push(imageUrl);
  }

  const tags = [
    ['t', 'ZombieCheck'],
    ['t', 'PlebsVsZombies'],
    ['client', 'Plebs vs. Zombies'],
  ];
  // Tag the subject so clients thread the report to them, matching how the
  // note already mentions them via nostr:npub.
  if (result.profile?.pubkey) {
    tags.unshift(['p', result.profile.pubkey]);
  }

  return { content: lines.join('\n'), tags };
}
