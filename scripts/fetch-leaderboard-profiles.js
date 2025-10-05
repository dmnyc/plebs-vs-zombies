#!/usr/bin/env node

/**
 * Fetch Nostr profiles for leaderboard participants
 *
 * This script fetches profile metadata from Nostr relays for a list of npubs
 * and outputs the enriched data in a format ready to paste into the HTML file.
 *
 * Usage: node scripts/fetch-leaderboard-profiles.js
 */

import NDK from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

// LEADERBOARD DATA - Update this with your participants
const participants = [
    { npub: "npub1t49ker2fyy2xc5y7qrsfxrp6g8evsxluqmaq09xt7uuhhzsurm3srw4jj5", zombiesKilled: 249 },
    { npub: "npub1q33jywkl8r0e5g48lvrenxnr3lw59kzrw4e7p0cecslqzwc56eesjymqu0", zombiesKilled: 242 },
    { npub: "npub1mgvmt553uphdpxa9gk79xejq3hyzh2xfa8uh6vh236nq78mvh74q8tr9yd", zombiesKilled: 207 },
    { npub: "npub16secklpnqey3el04fy2drfftsz5k26zlwdsnz84wtul2luwj8fdsugjdxk", zombiesKilled: 191 },
    { npub: "npub15m4qhqdrzsvu4u0v7992u657nqn56sw2l658a5f2zq7fk9klnd0srukzau", zombiesKilled: 126 },
    { npub: "npub1v7k63c6y2vktlqhsuupywt3yc7ykursujc34at964f9cv9s9y9csjutfk0", zombiesKilled: 97 },
    { npub: "npub1de6l09erjl9r990q7n9ql0rwh8x8n059ht7a267n0q3qe28wua8q20q0sd", zombiesKilled: 78 },
    { npub: "npub1muge3z8k53ts45nfhthsrn6qjzjw6qxfg704r9e8pxnmgwnvpzsq7yv3av", zombiesKilled: 67 },
    { npub: "npub1vp8fdcyejd4pqjyrjk9sgz68vuhq7pyvnzk8j0ehlljvwgp8n6eqsrnpsw", zombiesKilled: 62 },
    { npub: "npub19z9asfqjplh52ql3f9rc30706gwjxktgdyp3ap6sv08rvruzr3tsk4ylst", zombiesKilled: 30 },
    { npub: "npub1y8sj0myap0a7awl4qsswzz653p4p6llclww5g9m8nvls0dp62s2qpcsd3u", zombiesKilled: 29 },
    { npub: "npub1nz4y6dxnt0kzvgyhyvwnqklpennhv20dgly4c5gnpx4aa6ns08vqr8kkgx", zombiesKilled: 20 },
    { npub: "npub1uzt238htjzpq39dxmltlx60vxym9fetk9czz6kddq6fhvkf4z3usy9qtrh", zombiesKilled: 19 },
    { npub: "npub1cwhy4k8qd2guyqz8t45u4yzyp4k4fhnjn573ukh6e77mde2dgm9s2lujc5", zombiesKilled: 6 },
    { npub: "npub1m4ny6hjqzepn4rxknuq94c2gpqzr29ufkkw7ttcxyak7v43n6vvsajc2jl", zombiesKilled: 4 }
];

// Nostr relays to query
const RELAYS = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.primal.net',
    'wss://nostr.wine'
];

// Helper function to truncate npub for fallback display
function truncateNpub(npub) {
    return npub.substring(0, 10) + '...' + npub.substring(npub.length - 6);
}

// Main function
async function fetchProfiles() {
    console.log('🔍 Fetching profiles from Nostr relays...\n');

    // Initialize NDK
    const ndk = new NDK({
        explicitRelayUrls: RELAYS
    });

    console.log('🔗 Connecting to relays...');
    await ndk.connect();

    // Give relays time to connect
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Convert npubs to hex pubkeys
    const pubkeys = participants.map(p => {
        try {
            const decoded = nip19.decode(p.npub);
            return decoded.data;
        } catch (error) {
            console.error(`❌ Failed to decode npub: ${p.npub}`);
            return null;
        }
    }).filter(Boolean);

    console.log(`📡 Fetching profiles for ${pubkeys.length} participants...\n`);

    // Fetch profile events (kind 0)
    const profileEvents = await ndk.fetchEvents({
        kinds: [0],
        authors: pubkeys
    });

    console.log(`✅ Found ${profileEvents.size} profile events\n`);

    // Build profile map
    const profileMap = new Map();
    for (const event of profileEvents) {
        try {
            const profile = JSON.parse(event.content);
            profileMap.set(event.pubkey, {
                name: profile.name || null,
                displayName: profile.display_name || null,
                nip05: profile.nip05 || null,
                picture: profile.picture || null
            });
        } catch (error) {
            console.error(`❌ Failed to parse profile for ${event.pubkey.substring(0, 8)}...`);
        }
    }

    // Enrich participants with profile data
    const enrichedParticipants = participants.map(p => {
        const decoded = nip19.decode(p.npub);
        const pubkey = decoded.data;
        const profile = profileMap.get(pubkey);

        let name, handle;

        if (profile) {
            name = profile.displayName || profile.name || truncateNpub(p.npub);
            handle = profile.nip05 || p.npub;
        } else {
            name = truncateNpub(p.npub);
            handle = p.npub;
        }

        return {
            name,
            handle,
            zombiesKilled: p.zombiesKilled,
            npub: p.npub,
            picture: profile?.picture || null,
            hasProfile: !!profile
        };
    });

    // Print results
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 ENRICHED LEADERBOARD DATA');
    console.log('═══════════════════════════════════════════════════════════════\n');

    enrichedParticipants.forEach((p, i) => {
        const emoji = p.hasProfile ? '✅' : '❌';
        console.log(`${emoji} #${i + 1} ${p.name} (${p.zombiesKilled} kills)`);
        console.log(`   Handle: ${p.handle}`);
        console.log('');
    });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📝 JAVASCRIPT ARRAY (Copy this into your HTML file)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('const participants = [');
    enrichedParticipants.forEach((p, i) => {
        const comma = i < enrichedParticipants.length - 1 ? ',' : '';
        const picture = p.picture ? `"${p.picture}"` : 'null';
        console.log(`    { name: "${p.name}", handle: "${p.handle}", npub: "${p.npub}", picture: ${picture}, zombiesKilled: ${p.zombiesKilled} }${comma}`);
    });
    console.log('];\n');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const profilesFound = enrichedParticipants.filter(p => p.hasProfile).length;
    console.log(`Total participants: ${enrichedParticipants.length}`);
    console.log(`Profiles found: ${profilesFound}`);
    console.log(`Missing profiles: ${enrichedParticipants.length - profilesFound}`);
    console.log(`Total zombies killed: ${enrichedParticipants.reduce((sum, p) => sum + p.zombiesKilled, 0).toLocaleString()}`);
    console.log('');

    process.exit(0);
}

// Run the script
fetchProfiles().catch(error => {
    console.error('❌ Error fetching profiles:', error);
    process.exit(1);
});
