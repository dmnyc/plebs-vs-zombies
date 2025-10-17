#!/usr/bin/env node

/**
 * Fetch Well-Known Profiles from Nostr.band
 *
 * ⚠️ DEPRECATED: This script and the wellKnownProfiles.json it generates
 * will be removed once Vertex API integration is complete.
 *
 * We now use Primal's cache API as the primary search method.
 * This cache is kept as a fallback for offline/degraded scenarios.
 *
 * This script scrapes the top Nostr profiles from nostr.band and generates
 * a JSON file for use in the profile search service.
 *
 * Usage: node scripts/fetch-well-known-profiles.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, '../src/data/wellKnownProfiles.json');
const NOSTR_BAND_API = 'https://api.nostr.band/v0/trending/profiles';
const PROFILES_PER_PAGE = 50; // API returns 50 per request
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay to be nice to the API

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchTopProfiles() {
  console.log(`🔍 Fetching trending profiles from nostr.band...`);
  console.log(`⚠️  Note: nostr.band pagination is currently broken, we can only get ~50 profiles`);

  try {
    const response = await fetch(`${NOSTR_BAND_API}?limit=${PROFILES_PER_PAGE}`);

    if (!response.ok) {
      console.warn(`⚠️  HTTP error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.profiles || !Array.isArray(data.profiles)) {
      console.warn('⚠️  Unexpected API response format');
      return null;
    }

    console.log(`✅ Fetched ${data.profiles.length} profiles from API\n`);
    return data.profiles;

  } catch (error) {
    console.error('❌ Failed to fetch from nostr.band:', error.message);
    return null;
  }
}

async function processProfile(profile) {
  try {
    // Parse profile content (it's a JSON string)
    const content = JSON.parse(profile.profile?.content || '{}');

    // Extract names from profile metadata
    const names = [];

    const cleanName = (name) => {
      // Remove emojis but keep alphanumeric, spaces, hyphens, underscores
      // This regex removes emojis, zero-width characters, but keeps normal punctuation
      return name
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
        .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
        .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
        .trim()
        .toLowerCase();
    };

    if (content.name) {
      const cleaned = cleanName(content.name);
      if (cleaned) names.push(cleaned);
    }

    if (content.display_name && content.display_name !== content.name) {
      const cleaned = cleanName(content.display_name);
      if (cleaned && !names.includes(cleaned)) {
        names.push(cleaned);
      }
    }

    if (content.nip05) {
      // Add username from nip05 (before @)
      const nip05Username = content.nip05.split('@')[0].toLowerCase();
      const cleaned = cleanName(nip05Username);
      if (cleaned && !names.includes(cleaned)) {
        names.push(cleaned);
      }
    }

    // If no names found, skip this profile
    if (names.length === 0) {
      return null;
    }

    // Convert hex pubkey to npub
    const { nip19 } = await import('nostr-tools');
    const npub = nip19.npubEncode(profile.pubkey);

    return {
      npub: npub,
      names: [...new Set(names)], // Remove duplicates
      note: content.about?.substring(0, 80) || '' // First 80 chars of bio
    };
  } catch (error) {
    console.debug('Failed to process profile:', error.message);
    return null;
  }
}

async function generateWellKnownProfiles() {
  console.log('🚀 Starting well-known profiles generator...\n');

  // Fetch from API (currently only returns ~50 due to broken pagination)
  const apiProfiles = await fetchTopProfiles();

  let wellKnownProfiles = [];

  if (apiProfiles) {
    // Process API profiles with async
    const processed = await Promise.all(
      apiProfiles.map(p => processProfile(p))
    );

    wellKnownProfiles = processed.filter(p => p !== null); // Remove invalid profiles

    console.log(`✅ Processed ${wellKnownProfiles.length} valid profiles`);
    console.log(`   (filtered out ${processed.length - wellKnownProfiles.length} profiles with no valid names)`);
  }

  // Critical profiles that should always be findable
  // These are well-known Nostr users who may not appear in trending API
  const criticalProfiles = [
    // Nostr Protocol Developers
    {
      npub: 'npub1q3sle0kvfsehgsuexttt3ugjd8xdklxfwwkh559wxckmzddywnws6cd26p',
      names: ['alex gleason', 'alex', 'gleason', 'soapbox'],
      note: 'Soapbox, Ditto, Rebased developer'
    },
    {
      npub: 'npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s',
      names: ['fiatjaf'],
      note: 'Nostr protocol developer'
    },
    {
      npub: 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m',
      names: ['jack', 'jack dorsey', 'dorsey'],
      note: 'Twitter co-founder'
    },
    {
      npub: 'npub1a2cww4kn9wqte4ry70vyfwqyqvpswksna27rtxd8vty6c74era8sdcw83a',
      names: ['odell', 'matt odell', 'matt'],
      note: 'Bitcoin advocate, podcaster'
    },
    {
      npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
      names: ['ben arc', 'ben', 'benarc'],
      note: 'LNbits developer'
    },
    {
      npub: 'npub1gcxzte5zlkncx26j68ez60fzkvtkm9e0vrwdcvsjakxf9mu9qewqlfnj5z',
      names: ['nvk', 'coinkite'],
      note: 'Coinkite founder'
    },
    {
      npub: 'npub1hu3hdctm5nkzd8gslnyedfr5ddz3z547jqcl5j88g4fame2jd08qh6h8nh',
      names: ['rabble'],
      note: 'Nos.social developer'
    },
    {
      npub: 'npub1g53mukxnjkcmr94fhryzkqutdz2ukq4ks0gvy5af25rgmwsl4ngq43drvk',
      names: ['carla', 'carla kirk-cohen'],
      note: 'Lightning developer'
    },
    {
      npub: 'npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx',
      names: ['hodlonaut', 'hodl'],
      note: 'Bitcoin cat meme legend'
    },
    {
      npub: 'npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc',
      names: ['cameri'],
      note: 'Relay developer'
    },
    {
      npub: 'npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft',
      names: ['mike dilger', 'mikedilger'],
      note: 'Gossip client developer'
    },
    {
      npub: 'npub1r0rs5q2gk0e3dk3nlc7gnu378ec6cnlenqp8a3cjhyzu6f8k5sgs4sq9ac',
      names: ['miljan', 'miljan primal'],
      note: 'Primal developer'
    },
    // Bitcoin & Lightning Leaders
    {
      npub: 'npub1cj8znuztfqkvq89pl8hceph0svvvqk0qay6nydgk9uyq7fhpfsgsqwrz4u',
      names: ['saylor', 'michael saylor', 'msaylor'],
      note: 'MicroStrategy CEO'
    },
    {
      npub: 'npub1az9xj85cmxv8e9j9y80lvqp97crsqdu2fpu3srwthd99qfu9qsgstam8y8',
      names: ['rockstar dev', 'rockstardev'],
      note: 'BTCPay Server developer'
    },
    {
      npub: 'npub1u8lnhlw5usp3t9vmpz60ejpyt649z33hu82wc2hpv6m5xdqmuxhs46turz',
      names: ['preston pysh', 'preston'],
      note: 'Bitcoin advocate, podcaster'
    },
    {
      npub: 'npub1s33sw4x0p8fvr4vaxa2hqsrh5ztjy3q4e0f356y8vhn90jmhfjhsrtz9e3',
      names: ['max hillebrand', 'max', 'hillebrand'],
      note: 'Wasabi Wallet developer'
    },
    {
      npub: 'npub1cn4t4cd78nm900qc2hhqte5aa8c9njm6qkfzw95tszufwcwtcnsq7g3vle',
      names: ['craig raw', 'craig'],
      note: 'Sparrow Wallet developer'
    },
    // Nostr Client Developers
    {
      npub: 'npub1wmr34t36fy03m8hvgl96zl3znndyzyaqhwmwdtshwmtkg03fetaqhjg240',
      names: ['rabble nos', 'nos'],
      note: 'Nos client developer'
    },
    {
      npub: 'npub1jlrs53pkdfjnts29kveljul2sm0actt6n8dxrrzqcersttvcuv3qdjynqn',
      names: ['john carvalho', 'carvalho', 'carvalho jr', 'bitrefill'],
      note: 'Synonym, Bitrefill CEO'
    },
    {
      npub: 'npub18ams6ewn5aj2n3wt2qawzglx9mr4nzksxhvrdc4gzrecw7n5tvjqctp424',
      names: ['pablof7z', 'pablo'],
      note: 'Highlighter, NDK developer'
    },
    {
      npub: 'npub1gcxzte5zlkncx26j68ez60fzkvtkm9e0vrwdcvsjakxf9mu9qewqlfnj5z',
      names: ['vitor pamplona', 'vitorpamplona', 'vitor'],
      note: 'Amethyst developer'
    },
  ];

  // Remove duplicates (if critical profiles are already in API results)
  const seenNpubs = new Set(criticalProfiles.map(p => p.npub));
  const uniqueApiProfiles = wellKnownProfiles.filter(p => {
    if (seenNpubs.has(p.npub)) {
      console.log(`   Skipping duplicate: ${p.names[0]} (${p.npub.substring(0, 20)}...)`);
      return false;
    }
    seenNpubs.add(p.npub);
    return true;
  });

  console.log(`\n📊 Deduplication results:`);
  console.log(`   API profiles: ${wellKnownProfiles.length}`);
  console.log(`   After removing duplicates: ${uniqueApiProfiles.length}`);
  console.log(`   Critical profiles to prepend: ${criticalProfiles.length}`);

  // Combine critical profiles first, then API results
  wellKnownProfiles = [...criticalProfiles, ...uniqueApiProfiles];

  console.log(`✅ Total profiles after adding critical profiles: ${wellKnownProfiles.length}`);

  // If API failed or returned too few profiles, use expanded fallback list
  if (wellKnownProfiles.length < 50) {
    console.log('⚠️  Not enough profiles from API, using fallback list...');
    wellKnownProfiles = [
      ...criticalProfiles,
      {
        npub: 'npub1q3sle0kvfsehgsuexttt3ugjd8xdklxfwwkh559wxckmzddywnws6cd26p',
        names: ['alex gleason', 'alex', 'gleason'],
        note: 'Soapbox, Ditto developer'
      },
      {
        npub: 'npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s',
        names: ['fiatjaf'],
        note: 'Nostr protocol developer'
      },
      {
        npub: 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m',
        names: ['jack', 'jack dorsey'],
        note: 'Twitter co-founder'
      },
      {
        npub: 'npub1a2cww4kn9wqte4ry70vyfwqyqvpswksna27rtxd8vty6c74era8sdcw83a',
        names: ['odell', 'matt odell'],
        note: 'Bitcoin advocate, podcaster'
      },
      {
        npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
        names: ['ben arc', 'ben', 'benarc'],
        note: 'LNbits developer'
      },
      {
        npub: 'npub1gcxzte5zlkncx26j68ez60fzkvtkm9e0vrwdcvsjakxf9mu9qewqlfnj5z',
        names: ['nvk', 'coinkite'],
        note: 'Coinkite founder'
      },
      {
        npub: 'npub1hu3hdctm5nkzd8gslnyedfr5ddz3z547jqcl5j88g4fame2jd08qh6h8nh',
        names: ['rabble'],
        note: 'Nos.social developer'
      },
      {
        npub: 'npub1g53mukxnjkcmr94fhryzkqutdz2ukq4ks0gvy5af25rgmwsl4ngq43drvk',
        names: ['carla', 'carla kirk-cohen'],
        note: 'Lightning developer'
      },
      {
        npub: 'npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx',
        names: ['hodlonaut'],
        note: 'Bitcoin cat meme legend'
      }
    ];
  }

  // Write to file
  console.log(`\n💾 Writing ${wellKnownProfiles.length} profiles to ${OUTPUT_FILE}...`);

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(wellKnownProfiles, null, 2),
    'utf8'
  );

  console.log('✅ Successfully generated wellKnownProfiles.json!');
  console.log(`📊 Total profiles: ${wellKnownProfiles.length}`);
  console.log('\n🎉 Done! You can now use these profiles in the app.');
}

// Run the generator
generateWellKnownProfiles().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
