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

// LEADERBOARD DATA - Update this with your participants (supports up to 50)
const participants = [
    { npub: "npub1qnmamgyup683z9ehn40jrdgryjhn8qlpntwzqsrk8r80n3xspdrq4r245g", zombiesKilled: 1466, processedEventIds: [] },
    { npub: "npub1dgpt04w4c88wc0g262xaw8zvlm4mvwtmjhl0tn2sxtyjywsn6q4qt8ka3a", zombiesKilled: 675, processedEventIds: [] },
    { npub: "npub1yllm60xfppclx6udwg2205pmhlrzhsppc2qgm3lz73tcy8skqheql2rwqs", zombiesKilled: 320, processedEventIds: [] },
    { npub: "npub1q46m7q7zv8qe2zqffhhjnj558fdtzjxy7akr0x9ytwa3zc4zhpus0m8rmu", zombiesKilled: 298, processedEventIds: [] },
    { npub: "npub1t49ker2fyy2xc5y7qrsfxrp6g8evsxluqmaq09xt7uuhhzsurm3srw4jj5", zombiesKilled: 249, processedEventIds: [] },
    { npub: "npub1q33jywkl8r0e5g48lvrenxnr3lw59kzrw4e7p0cecslqzwc56eesjymqu0", zombiesKilled: 242, processedEventIds: [] },
    { npub: "npub1mgvmt553uphdpxa9gk79xejq3hyzh2xfa8uh6vh236nq78mvh74q8tr9yd", zombiesKilled: 207, processedEventIds: [] },
    { npub: "npub16secklpnqey3el04fy2drfftsz5k26zlwdsnz84wtul2luwj8fdsugjdxk", zombiesKilled: 191, processedEventIds: [] },
    { npub: "npub1xswmtflr4yclfyy4mq4y4nynnnu2vu5nk8jp0875khq9gnz0cthsc0p4xw", zombiesKilled: 176, processedEventIds: [] },
    { npub: "npub1qqqqqqz7nhdqz3uuwmzlflxt46lyu7zkuqhcapddhgz66c4ddynswreecw", zombiesKilled: 160, processedEventIds: [] },
    { npub: "npub1vsmh0r2t6ewglryvfu79mzx69ze6v8qpaqr6e5pgc4krtwjnd5tsqpzk4u", zombiesKilled: 152, processedEventIds: [] },
    { npub: "npub1eq94yj8maree90pm53gfr76wdc44su3cwcqmly848xfrv6es6usqg4er58", zombiesKilled: 135, processedEventIds: [] },
    { npub: "npub1njst6azswskk5gp3ns8r6nr8nj0qg65acu8gaa2u9yz7yszjxs9s6k7fqx", zombiesKilled: 132, processedEventIds: [] },
    { npub: "npub15m4qhqdrzsvu4u0v7992u657nqn56sw2l658a5f2zq7fk9klnd0srukzau", zombiesKilled: 126, processedEventIds: [] },
    { npub: "npub1lxzaxzge0jq9u9cecucctdt5lslwgp7hcxmp2l0wn8r2ecjenwasu6svxa", zombiesKilled: 104, processedEventIds: [] },
    { npub: "npub1yrffsyxk5hujkpz6mcpwhwkujqmdwswvdp4sqs2ug26zxmly45hsfpn8p0", zombiesKilled: 97, processedEventIds: [] },
    { npub: "npub1v7k63c6y2vktlqhsuupywt3yc7ykursujc34at964f9cv9s9y9csjutfk0", zombiesKilled: 97, processedEventIds: [] },
    { npub: "npub1de6l09erjl9r990q7n9ql0rwh8x8n059ht7a267n0q3qe28wua8q20q0sd", zombiesKilled: 78, processedEventIds: [] },
    { npub: "npub1muge3z8k53ts45nfhthsrn6qjzjw6qxfg704r9e8pxnmgwnvpzsq7yv3av", zombiesKilled: 67, processedEventIds: [] },
    { npub: "npub1jgn3dnnntuatzae2nqkhg2zp54tqxk3t6zpzljf8x9h7le89gagsxrwwl3", zombiesKilled: 67, processedEventIds: ["05e86cf209e767cb939433908ef1868ab79ceaf43cf2aacb26ab19e99dbbbc6d","32195de99a5195259166bac6c250e7b496d3b64a0b9dc140ebd699034be652ac","9f99bfe02604b44149dec7f24584506976f4c90faf2d9162fe28ba38b93d132b"] },
    { npub: "npub1vp8fdcyejd4pqjyrjk9sgz68vuhq7pyvnzk8j0ehlljvwgp8n6eqsrnpsw", zombiesKilled: 62, processedEventIds: [] },
    { npub: "npub157dmyq6ehpra5xatrn0sssz03qe0y6k69v02xmzyqcrf0h0xxf5qxaw6u8", zombiesKilled: 34, processedEventIds: [] },
    { npub: "npub1qntwuu24q5lq0g94sz522nzaa646s3gtzklngazxymvl0zdcyzps889v2d", zombiesKilled: 31, processedEventIds: [] },
    { npub: "npub1ppl78tdsjs53x2ldewg0zdvwz9ufsz36tynt5pkd74s6feell59s6ejlum", zombiesKilled: 30, processedEventIds: [] },
    { npub: "npub19z9asfqjplh52ql3f9rc30706gwjxktgdyp3ap6sv08rvruzr3tsk4ylst", zombiesKilled: 30, processedEventIds: [] },
    { npub: "npub1y8sj0myap0a7awl4qsswzz653p4p6llclww5g9m8nvls0dp62s2qpcsd3u", zombiesKilled: 29, processedEventIds: [] },
    { npub: "npub1vgldyxx7syc30qm9v7padnnfpdfp4zwymsyl9ztzuklaf7j5jfyspk36wu", zombiesKilled: 24, processedEventIds: [] },
    { npub: "npub190queyng2pmx0jfw5rkx4fjjl3u0zxz6nlyaja53p2n0ydupr6jsdnqt8q", zombiesKilled: 21, processedEventIds: [] },
    { npub: "npub1nz4y6dxnt0kzvgyhyvwnqklpennhv20dgly4c5gnpx4aa6ns08vqr8kkgx", zombiesKilled: 20, processedEventIds: [] },
    { npub: "npub10ukkl43wsl324tvz2mgmlmslq8h0zdndpsyvfwm5kzqpger3pysse6a3ya", zombiesKilled: 20, processedEventIds: [] },
    { npub: "npub12u56mxg60cxt3zt3emfrfp6czptep4g3vzsfkgksmreeefmzmcgsuye0ve", zombiesKilled: 20, processedEventIds: [] },
    { npub: "npub1uzt238htjzpq39dxmltlx60vxym9fetk9czz6kddq6fhvkf4z3usy9qtrh", zombiesKilled: 19, processedEventIds: [] },
    { npub: "npub1jp54xt8x4pezxdnmlvzfkkppver2ss263z65v5uadla29m4jr2dqj7xcra", zombiesKilled: 14, processedEventIds: [] },
    { npub: "npub138xw4ym33jw06g0u2mesxlmgj2esgecrpwnlrcy9v503hh6wqzmscakdee", zombiesKilled: 14, processedEventIds: [] },
    { npub: "npub1mwce4c8qa2zn9zw9f372syrc9dsnqmyy3jkcmpqkzaze0slj94dqu6nmwy", zombiesKilled: 12, processedEventIds: [] },
    { npub: "npub1ptwv0m9uytzkz3k5te3y9j9k46f5r4h4ts5gdh0qzfp88qn2tgsshc2nu0", zombiesKilled: 10, processedEventIds: [] },
    { npub: "npub1kgh77xxt7hhtt4u528hecnx69rhagla8jj3tclgyf9wvkxa6dc0szxkuut", zombiesKilled: 10, processedEventIds: [] },
    { npub: "npub1slmplexzafjdny6w6ucjqrqugx5ldh0dg2v58r3ksld63h6atw5szx9sfh", zombiesKilled: 6, processedEventIds: [] },
    { npub: "npub1cwhy4k8qd2guyqz8t45u4yzyp4k4fhnjn573ukh6e77mde2dgm9s2lujc5", zombiesKilled: 6, processedEventIds: [] },
    { npub: "npub14hz3xluls73nc8eyvy6fljm6tf8zt0xkxpgxngch36txfv24ycvs622r7l", zombiesKilled: 5, processedEventIds: [] },
    { npub: "npub1rsqajguwyds0zne9qqy33n55cd6dg68zrkwyj7y8l69me04yc79qf53rt4", zombiesKilled: 4, processedEventIds: [] },
    { npub: "npub1m4ny6hjqzepn4rxknuq94c2gpqzr29ufkkw7ttcxyak7v43n6vvsajc2jl", zombiesKilled: 4, processedEventIds: [] }
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
