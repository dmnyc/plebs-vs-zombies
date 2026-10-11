// Serves /zombiecheck with personalized social-preview meta tags whenever the
// link deep-targets a user (?npub=… / ?pubkey=…), so shared links preview as
// "Zombie Check | Is <name> a zombie?" with a per-user card image instead of
// the generic static card. Wired up by the two conditional rewrites in
// vercel.json, which route only requests carrying an npub/pubkey param here;
// every other hit keeps hitting the static page.
//
// Human visitors effectively get the same page either way — only the head
// tags change; the in-page check still runs client-side exactly as before.
// When the target has no resolvable identity (or anything at all fails), we
// serve the unmodified static HTML: the personalized card is "if available".

import {
  resolveHex,
  canonicalNpub,
  fetchArchivesProfile,
} from './_lib/nostr-profile.js';
import { injectPreviewTags } from './_lib/preview-html.js';

export const config = { runtime: 'edge' };

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  // Short CDN lifetime: pages only change per deploy, but personalization
  // follows a profile that could be edited any day.
  'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

// The static page is fetched from this same deployment. Kept in memory for a
// minute per isolate — enough to absorb a crawl burst, short enough that a
// fresh deploy is picked up immediately.
let staticHtml = { at: 0, text: null };
async function getStaticHtml(request) {
  if (staticHtml.text && Date.now() - staticHtml.at < 60_000) return staticHtml.text;
  const resp = await fetch(new URL('/zombiecheck.html', request.url), {
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`static page fetch failed (${resp.status})`);
  staticHtml = { at: Date.now(), text: await resp.text() };
  return staticHtml.text;
}

// Passthrough: the static page, byte for byte (with the same headers so the
// CDN caches both flavors consistently).
export async function serveStatic(request) {
  const text = await getStaticHtml(request);
  return new Response(text, { headers: HTML_HEADERS });
}

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const raw = (
      url.searchParams.get('npub') || url.searchParams.get('pubkey') || ''
    ).trim();
    if (!raw) return serveStatic(request);

    const hex = resolveHex(raw);
    if (!hex) return serveStatic(request);

    const profile = await fetchArchivesProfile(hex);

    let html;
    try {
      html = await getStaticHtml(request);
    } catch (_) {
      // The deployment's static asset didn't answer (e.g. cold dev server) —
      // fall through to the plain static route rather than erroring.
      return Response.redirect(new URL('/zombiecheck', 'https://plebsvszombies.cc'), 302);
    }

    const injected = injectPreviewTags(html, {
      name: profile?.display_name || profile?.name || null,
      npub: canonicalNpub(hex),
      hasPicture: Boolean(profile?.picture),
    });
    return new Response(injected || html, { headers: HTML_HEADERS });
  } catch (e) {
    console.error('zombiecheck-preview failed:', e);
    try {
      return serveStatic(request);
    } catch (_) {
      return new Response('Service unavailable', { status: 503 });
    }
  }
}
