#!/usr/bin/env node

/**
 * Generate Well-Known Profiles
 *
 * ⚠️ DEPRECATED: This script and the wellKnownProfiles.json it generates
 * will be removed once Vertex API integration is complete.
 *
 * We now use Primal's cache API as the primary search method. This cache is
 * kept as a fallback for offline/degraded scenarios.
 *
 * Originally this script fetched trending profiles from the nostr.band API
 * and merged them with a curated list. The nostr.band API is no longer
 * operational, so the script now writes only the curated list.
 *
 * Usage: node scripts/fetch-well-known-profiles.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, '../src/data/wellKnownProfiles.json');

async function generateWellKnownProfiles() {
  console.log('🚀 Generating well-known profiles from curated list...\n');

  // Curated list of well-known Nostr users. Keep these alphabetical-ish per
  // category for easier maintenance.
  const wellKnownProfiles = [
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

  console.log(`💾 Writing ${wellKnownProfiles.length} profiles to ${OUTPUT_FILE}...`);

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(wellKnownProfiles, null, 2),
    'utf8'
  );

  console.log('✅ Successfully generated wellKnownProfiles.json!');
  console.log(`📊 Total profiles: ${wellKnownProfiles.length}`);
}

generateWellKnownProfiles().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
