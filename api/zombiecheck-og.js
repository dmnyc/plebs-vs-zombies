// Renders the personalized zombiecheck link-preview card as a 1200×675 PNG —
// the og:image behind /zombiecheck?npub=… deep links (see
// zombiecheck-preview.js, which injects this URL into the page's meta tags).
// Mirrors the static zombiecheck-social-share.png, with the checked user's
// avatar, name and npub added when their profile resolves; anything that
// fails falls back to redirecting to the static PNG, so a crawler never sees
// a broken image.

import { ImageResponse } from '@vercel/og';
import {
  resolveHex,
  canonicalNpub,
  fetchArchivesProfile,
} from './_lib/nostr-profile.js';

export const config = { runtime: 'edge' };

const STATIC_PNG_PATH = '/zombiecheck-social-share.png';
const PNG_HEADERS = {
  'content-type': 'image/png',
  // Names and avatars change rarely; the query string (npub) is the cache key.
  'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
};

function redirectToStatic(request) {
  return new Response(null, {
    status: 302,
    headers: {
      location: new URL(STATIC_PNG_PATH, request.url).toString(),
      'cache-control': 'public, s-maxage=86400',
    },
  });
}

// ----- Fonts ---------------------------------------------------------------
// Satori needs real font files (TTF/OTF — not woff2). Google's css2 endpoint
// serves truetype URLs to clients with no modern browser UA, so resolve the
// .ttf per family/weight at cold start and keep them for the isolate's life.
const FONT_TARGETS = [
  { family: 'Geist', weight: 400 },
  { family: 'Geist', weight: 700 },
  { family: 'Creepster', weight: 400 },
];
let fontsPromise = null;

function getFonts() {
  if (!fontsPromise) {
    fontsPromise = loadFonts().catch((e) => {
      fontsPromise = null; // retry on the next request, not stuck forever
      throw e;
    });
  }
  return fontsPromise;
}

async function loadFonts() {
  const families = [...new Set(FONT_TARGETS.map((t) => t.family))]
    .map((f) => (f === 'Geist' ? 'Geist:wght@400;700' : f))
    .join('&family=');
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=${families}&display=swap`)
  ).text();
  if (!css.includes("format('truetype')")) {
    throw new Error('Google Fonts did not serve truetype sources');
  }

  // Subset blocks repeat per unicode range; latin (the last block for each
  // family/weight) is all this card needs.
  const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
  const pickUrl = (family, weight) => {
    let url = null;
    for (const face of faces) {
      if (!face.includes(`font-family: '${family}'`)) continue;
      if (!face.includes(`font-weight: ${weight}`)) continue;
      const match = face.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
      if (match) url = match[1];
    }
    return url;
  };

  return Promise.all(
    FONT_TARGETS.map(async (t) => {
      const url = pickUrl(t.family, t.weight);
      if (!url) throw new Error(`no truetype url for ${t.family} ${t.weight}`);
      const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) throw new Error(`font fetch failed: ${t.family} ${t.weight}`);
      return { name: t.family, weight: t.weight, style: 'normal', data: await resp.arrayBuffer() };
    }),
  );
}

// ----- Avatar ---------------------------------------------------------------
// 268-byte fallback avatar, inlined — same failure class as in the page, and
// it's the face shown when a profile has no picture (or it won't load).
const DEFAULT_AVATAR =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzM3NDE1MSIvPgogIDxjaXJjbGUgY3g9IjE2IiBjeT0iMTIiIHI9IjUiIGZpbGw9IiM5Q0EzQUYiLz4KICA8cGF0aCBkPSJNNiAyNmMwLTUuNSA0LjUtMTAgMTAtMTBzMTAgNC41IDEwIDEwIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPg==';

// Profile pictures are visitor-controlled URLs, so they're fetched through
// the wsrv.nl proxy (already the page's image proxy) rather than directly —
// that keeps arbitrary hosts out of this function and returns a normalized
// square JPEG satori can embed.
async function loadAvatar(picture) {
  if (!picture) return DEFAULT_AVATAR;
  try {
    const proxied =
      `https://wsrv.nl/?url=${encodeURIComponent(picture)}` +
      '&w=256&h=256&fit=cover&a=attention&output=jpg&q=85';
    const resp = await fetch(proxied, { signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return DEFAULT_AVATAR;
    const bytes = new Uint8Array(await resp.arrayBuffer());
    if (bytes.byteLength < 64) return DEFAULT_AVATAR;
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return `data:image/jpeg;base64,${btoa(binary)}`;
  } catch (_) {
    return DEFAULT_AVATAR;
  }
}

// ----- Card layout -----------------------------------------------------------
// Mirrors the static share PNG: emoji mark, Creepster title in zombie green,
// gray body line, "Part of Plebs vs. Zombies" footer — plus the identity row
// (avatar / name / npub) that the static one can't have. Satori renders plain
// { type, props } objects (no JSX in this repo), and wants flex on every
// container with multiple children.
function buildCard({ profile, npub, avatar }) {
  const name = (profile?.display_name || profile?.name || '').trim();
  const shownName = name.length > 26 ? name.slice(0, 25).trimEnd() + '…' : name;
  const npubText = npub || '';
  const shortNpub = npubText.length > 20 ? `${npubText.slice(0, 12)}…${npubText.slice(-6)}` : npubText;

  const children = [
    { type: 'div', props: { style: { fontSize: '64px', lineHeight: '1', marginBottom: '24px' }, children: '🧟‍♀️☑️' } },
    {
      type: 'div',
      props: {
        style: {
          fontFamily: 'Creepster', fontSize: '96px', lineHeight: '1.05', color: '#5cdb5c',
          letterSpacing: '2px', textShadow: '0 0 28px rgba(92, 219, 92, 0.4)', marginBottom: '28px',
        },
        children: 'Zombie Check',
      },
    },
  ];

  if (profile) {
    children.push({
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '28px', marginBottom: '24px' },
        children: [
          {
            type: 'img',
            props: {
              src: avatar,
              width: 148, height: 148,
              style: { borderRadius: '9999px', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.18)' },
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { fontFamily: 'Geist', fontWeight: 700, fontSize: shownName ? '54px' : '40px', lineHeight: '1.1', color: '#ffffff' },
                    children: shownName || shortNpub,
                  },
                },
                ...(shownName
                  ? [{
                      type: 'div',
                      props: {
                        style: { fontFamily: 'Geist', fontSize: '27px', lineHeight: '1', color: '#9ca3af' },
                        children: shortNpub,
                      },
                    }]
                  : []),
              ],
            },
          },
        ],
      },
    });
  }

  children.push({
    type: 'div',
    props: {
      style: {
        fontFamily: 'Geist', fontWeight: 600, fontSize: '40px', lineHeight: 1.35,
        color: '#d1d5db', textAlign: 'center', maxWidth: '1000px',
      },
      children: profile
        ? `Is ${shownName || 'this Nostr user'} still alive on Nostr — or gone full zombie?`
        : "Check whether any Nostr user is a zombie and see how long they've been gone.",
    },
  });

  children.push({
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: '12px', marginTop: '36px' },
      children: [
        {
          type: 'div',
          props: { style: { fontFamily: 'Geist', fontSize: '30px', color: '#9ca3af' }, children: 'Part of' },
        },
        {
          type: 'div',
          props: {
            style: { fontFamily: 'Creepster', fontSize: '38px', color: '#5cdb5c', letterSpacing: '1px' },
            children: 'Plebs vs. Zombies',
          },
        },
      ],
    },
  });

  return {
    type: 'div',
    props: {
      style: {
        width: '1200px', height: '675px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, #1c2030 0%, #14172a 100%)',
        color: '#e5e7eb',
      },
      children,
    },
  };
}

// Exported for tests / design previews; the handler is the only runtime caller.
export { buildCard, loadAvatar, getFonts };

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const raw = (
      url.searchParams.get('npub') || url.searchParams.get('pubkey') || ''
    ).trim();
    const hex = resolveHex(raw);
    if (!hex) return redirectToStatic(request);

    const profile = await fetchArchivesProfile(hex);
    const npub = canonicalNpub(hex);
    const [fonts, avatar] = await Promise.all([getFonts(), loadAvatar(profile?.picture)]);

    const image = new ImageResponse(buildCard({ profile, npub, avatar }), {
      width: 1200,
      height: 675,
      fonts,
      emoji: 'twemoji',
    });
    return new Response(image.body, { headers: PNG_HEADERS });
  } catch (e) {
    console.error('zombiecheck-og failed:', e);
    return redirectToStatic(request);
  }
}
