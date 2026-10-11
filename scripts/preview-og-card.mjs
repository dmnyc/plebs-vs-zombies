// Dev-only: renders the zombiecheck OG card to PNGs without deploying, so the
// design can be checked locally (node scripts/preview-og-card.mjs [outDir]).
// Mirrors exactly what api/zombiecheck-og.js does on the edge.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
// @vercel/og's node bundle is CJS-compiled and ESM-hostile: it does
// require("fs") and locates its wasm via __dirname. Both only resolve if a
// CJS-style global exists — provide them before it loads.
globalThis.require = createRequire(import.meta.url);
globalThis.__dirname = fileURLToPath(new URL('../node_modules/@vercel/og/dist/', import.meta.url));
// The node build of @vercel/og looks for harfbuzz's hb.wasm next to its own
// dist; on the edge Vercel injects it, locally we copy it from harfbuzzjs.
{
  const dist = new URL('../node_modules/@vercel/og/dist/hb.wasm', import.meta.url);
  const src = new URL('../node_modules/harfbuzzjs/hb.wasm', import.meta.url);
  try {
    await import('node:fs').then(({ copyFileSync, existsSync }) => {
      if (!existsSync(dist)) copyFileSync(src, dist);
    });
  } catch (_) {}
}
const { ImageResponse } = await import('@vercel/og');
const { buildCard, loadAvatar, getFonts } = await import('../api/zombiecheck-og.js');
const { canonicalNpub, fetchArchivesProfile, resolveHex } = await import(
  '../api/_lib/nostr-profile.js'
);

const outDir = process.argv[2] || 'screenshots/og-preview';
mkdirSync(outDir, { recursive: true });

const cases = [
  { label: 'nvk', npub: 'npub1az9xj85cmxv8e9j9y80lvqp97crsqdu2fpu3srwthd99qfu9qsgstam8y8' },
  { label: 'no-profile', profile: null, npub: null },
  { label: 'long-name', profile: { name: 'Löng Wördly Display Name & Friends <test> 🚀🦄', display_name: 'Löng Wördly Display Name & Friends <test> 🚀🦄' }, hex: 'd'.repeat(64) },
];

const fonts = await getFonts();
for (const c of cases) {
  let profile = c.profile;
  let npub = null;
  if (c.npub || c.hex) {
    const hex = c.hex || resolveHex(c.npub);
    if (!hex) throw new Error(`unresolvable npub for case ${c.label}`);
    npub = canonicalNpub(hex);
    profile = profile || (await fetchArchivesProfile(hex));
  }
  const avatar = await loadAvatar(profile?.picture);
  const image = new ImageResponse(buildCard({ profile, npub, avatar }), {
    width: 1200,
    height: 675,
    fonts,
    emoji: 'twemoji',
  });
  const buf = Buffer.from(await image.arrayBuffer());
  const file = join(outDir, `og-${c.label}.png`);
  writeFileSync(file, buf);
  console.log('wrote', file, buf.length, 'bytes');
}
