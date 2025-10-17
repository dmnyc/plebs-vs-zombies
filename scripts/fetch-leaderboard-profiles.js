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
    { npub: "npub148ut8u4vr8xqd4gefhg6eyc5636p5zthw3zfse2njfkezegczers59ty0w", zombiesKilled: 2935, processedEventIds: ["049e67e15340b6df7698e72f2e50d4c818a7484ed937154c054077d4fdbd9338"] },
    { npub: "npub1ppl78tdsjs53x2ldewg0zdvwz9ufsz36tynt5pkd74s6feell59s6ejlum", zombiesKilled: 1772, processedEventIds: ["6f73ab007fc0611e5fd423544d57d3cc9bf0c5d0a7671cf8c530197dc689a660","83905efec74001b0847303d762933c45fdc6a2d0a9ee253905ebb2ee84871fd5"] },
    { npub: "npub1qnmamgyup683z9ehn40jrdgryjhn8qlpntwzqsrk8r80n3xspdrq4r245g", zombiesKilled: 1466, processedEventIds: ["85d7b66daacd38e40950968fa858fd8fca72a91e8b4726622aaaf5111df95a55"] },
    { npub: "npub1faaxjg39cmycqfmgghz8tsat0qvnnnkmaaf6fvpx8lxr63qgtu2s5j7tj3", zombiesKilled: 1429, processedEventIds: ["a9912068576943c1c1789b46ab0cae20b33ef01d10fbc917647f15eb11024915"] },
    { npub: "npub1yejzp928cg48s3q857v8lnmmcqypmsrvmn9e3mruvx2nkntncm2qumhgha", zombiesKilled: 1281, processedEventIds: ["6c800b30903ba287b99ceb1d1e0aa1aada50a1cfc240ab0b290641bebdf1425f"] },
    { npub: "npub1dgpt04w4c88wc0g262xaw8zvlm4mvwtmjhl0tn2sxtyjywsn6q4qt8ka3a", zombiesKilled: 675, processedEventIds: [] },
    { npub: "npub13pnmakf738yn6rv2ex9jgs7924renmderyp5d9rtztsr7ymxg3gqej06vw", zombiesKilled: 645, processedEventIds: ["7149f2f101cd73596d52091de3e8b2755b44a99edbfb6e84a71134b007da80d6"] },
    { npub: "npub1tmdt7ksm2pl5cftdpnt6fmslnvtjdsy4wdm73krxcamk7stupuhs92flxu", zombiesKilled: 452, processedEventIds: ["6566c29081add24d27c69a8b5ef99dbacb3873471b7d2d340538edf79cfc4920","4b00da1c015be2e51aad52009f7a0fc7e5ebfc654dfa7ccef3aec8519445cb04","5ac3e135f0d11e7df75a6a59110998e8af214c88f7fffc502411de602c506b55"] },
    { npub: "npub1a73m8zj2u2y8ha5v83z0dga9290zhjtjhj3nkdjkgtkas6d2vw3s6dr5h4", zombiesKilled: 439, processedEventIds: ["dc98599624fdb92b17b3d039970b0040c444749477183003d9cf0acae39148d8","957d2af72fb5b94ba31fb96f846e4884035175d43530a8f523d3f91b96c7a174"] },
    { npub: "npub1yllm60xfppclx6udwg2205pmhlrzhsppc2qgm3lz73tcy8skqheql2rwqs", zombiesKilled: 320, processedEventIds: [] },
    { npub: "npub1q46m7q7zv8qe2zqffhhjnj558fdtzjxy7akr0x9ytwa3zc4zhpus0m8rmu", zombiesKilled: 298, processedEventIds: [] },
    { npub: "npub1qn4ylq6s79tz4gwkphq8q4sltwurs6s36xsq2u8aw3qd5ggwzufsw3s3yz", zombiesKilled: 272, processedEventIds: ["f3899a9bbbcd893c7e36734f94acbd209b2f9f47483118cdf045ffc0f9a70f71"] },
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
    { npub: "npub15wtwxm5k92v3mtppwvwaghdzaclajfjavhuc88q4s3effmyeruwqmtpy0d", zombiesKilled: 74, processedEventIds: ["44da55b7302c7970fdea329be5ae4d97054d361be3b77754de45b1d994d21b21"] },
    { npub: "npub1muge3z8k53ts45nfhthsrn6qjzjw6qxfg704r9e8pxnmgwnvpzsq7yv3av", zombiesKilled: 67, processedEventIds: [] },
    { npub: "npub1jgn3dnnntuatzae2nqkhg2zp54tqxk3t6zpzljf8x9h7le89gagsxrwwl3", zombiesKilled: 67, processedEventIds: ["05e86cf209e767cb939433908ef1868ab79ceaf43cf2aacb26ab19e99dbbbc6d","32195de99a5195259166bac6c250e7b496d3b64a0b9dc140ebd699034be652ac","9f99bfe02604b44149dec7f24584506976f4c90faf2d9162fe28ba38b93d132b"] },
    { npub: "npub1vp8fdcyejd4pqjyrjk9sgz68vuhq7pyvnzk8j0ehlljvwgp8n6eqsrnpsw", zombiesKilled: 62, processedEventIds: [] },
    { npub: "npub1m6x20f4n7uc5ayvjr4xut6g4ldau90fjz202d9nrythl5jq9p3xq579dnn", zombiesKilled: 59, processedEventIds: ["c8c9cd0934530343d6bda98e1a5469c647800b1afd51ef3d98b18197dbcf0cba"] },
    { npub: "npub157dmyq6ehpra5xatrn0sssz03qe0y6k69v02xmzyqcrf0h0xxf5qxaw6u8", zombiesKilled: 34, processedEventIds: [] },
    { npub: "npub1qntwuu24q5lq0g94sz522nzaa646s3gtzklngazxymvl0zdcyzps889v2d", zombiesKilled: 31, processedEventIds: [] },
    { npub: "npub19z9asfqjplh52ql3f9rc30706gwjxktgdyp3ap6sv08rvruzr3tsk4ylst", zombiesKilled: 30, processedEventIds: [] },
    { npub: "npub1y8sj0myap0a7awl4qsswzz653p4p6llclww5g9m8nvls0dp62s2qpcsd3u", zombiesKilled: 29, processedEventIds: [] },
    { npub: "npub1kun5628raxpm7usdkj62z2337hr77f3ryrg9cf0vjpyf4jvk9r9smv3lhe", zombiesKilled: 29, processedEventIds: ["26188b01081d16aa4b2248786cb278fd818144dffba66aa34f50d308bb25a28a"] },
    { npub: "npub1aeh2zw4elewy5682lxc6xnlqzjnxksq303gwu2npfaxd49vmde6qcq4nwx", zombiesKilled: 28, processedEventIds: ["00e7890e0bed09de3dffef54ec90ded04aea13947be0ca694117dfa322de8aa6"] },
    { npub: "npub1vgldyxx7syc30qm9v7padnnfpdfp4zwymsyl9ztzuklaf7j5jfyspk36wu", zombiesKilled: 24, processedEventIds: [] },
    { npub: "npub190queyng2pmx0jfw5rkx4fjjl3u0zxz6nlyaja53p2n0ydupr6jsdnqt8q", zombiesKilled: 21, processedEventIds: [] },
    { npub: "npub1nz4y6dxnt0kzvgyhyvwnqklpennhv20dgly4c5gnpx4aa6ns08vqr8kkgx", zombiesKilled: 20, processedEventIds: [] },
    { npub: "npub10ukkl43wsl324tvz2mgmlmslq8h0zdndpsyvfwm5kzqpger3pysse6a3ya", zombiesKilled: 20, processedEventIds: [] },
    { npub: "npub12u56mxg60cxt3zt3emfrfp6czptep4g3vzsfkgksmreeefmzmcgsuye0ve", zombiesKilled: 20, processedEventIds: [] },
    { npub: "npub1uzt238htjzpq39dxmltlx60vxym9fetk9czz6kddq6fhvkf4z3usy9qtrh", zombiesKilled: 19, processedEventIds: [] },
    { npub: "npub1cd6syy4q0rha3kzdz2yw5782y4yj9snvzd8rcxjy6e9kldcmpeuq6dw96r", zombiesKilled: 19, processedEventIds: ["ad2b54ed215d65c2807050f487979a752e726ee3c2b3653d49fa71f6ad863149"] },
    { npub: "npub1jp54xt8x4pezxdnmlvzfkkppver2ss263z65v5uadla29m4jr2dqj7xcra", zombiesKilled: 14, processedEventIds: [] },
    { npub: "npub138xw4ym33jw06g0u2mesxlmgj2esgecrpwnlrcy9v503hh6wqzmscakdee", zombiesKilled: 14, processedEventIds: [] },
    { npub: "npub1mwce4c8qa2zn9zw9f372syrc9dsnqmyy3jkcmpqkzaze0slj94dqu6nmwy", zombiesKilled: 12, processedEventIds: [] },
    { npub: "npub1ptwv0m9uytzkz3k5te3y9j9k46f5r4h4ts5gdh0qzfp88qn2tgsshc2nu0", zombiesKilled: 10, processedEventIds: [] },
    { npub: "npub1kgh77xxt7hhtt4u528hecnx69rhagla8jj3tclgyf9wvkxa6dc0szxkuut", zombiesKilled: 10, processedEventIds: [] },
    { npub: "npub1slmplexzafjdny6w6ucjqrqugx5ldh0dg2v58r3ksld63h6atw5szx9sfh", zombiesKilled: 6, processedEventIds: [] },
    { npub: "npub1cwhy4k8qd2guyqz8t45u4yzyp4k4fhnjn573ukh6e77mde2dgm9s2lujc5", zombiesKilled: 6, processedEventIds: [] },
    { npub: "npub14hz3xluls73nc8eyvy6fljm6tf8zt0xkxpgxngch36txfv24ycvs622r7l", zombiesKilled: 5, processedEventIds: [] },
    { npub: "npub1rsqajguwyds0zne9qqy33n55cd6dg68zrkwyj7y8l69me04yc79qf53rt4", zombiesKilled: 4, processedEventIds: [] },
    { npub: "npub1m4ny6hjqzepn4rxknuq94c2gpqzr29ufkkw7ttcxyak7v43n6vvsajc2jl", zombiesKilled: 4, processedEventIds: [] },
    { npub: "npub1eejrfpegp2j5quvjrx960c9a8k9avsvufsglj7ecw3xuz32cpygqc8fmhw", zombiesKilled: 1, processedEventIds: ["6683925f69581380a3676caf76e7abac408418371fac3d171c1f76c358ff39c5"] }
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

    // Start connection but don't wait for all relays - they connect in background
    ndk.connect().catch(error => {
        console.warn('⚠️ Some relays failed to connect (non-blocking):', error.message);
    });

    // Give relays time to connect
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check how many relays connected
    const connectedRelays = Array.from(ndk?.pool?.relays?.values() || [])
        .filter(r => r.connectivity?.status === 1);
    console.log(`📡 Connected to ${connectedRelays.length}/${RELAYS.length} relays\n`);

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

    // Fetch profile events (kind 0) with timeout
    const FETCH_TIMEOUT = 15000; // 15 seconds
    let profileEvents;

    try {
        profileEvents = await Promise.race([
            ndk.fetchEvents({
                kinds: [0],
                authors: pubkeys
            }, {
                closeOnEose: true
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Profile fetch timed out')), FETCH_TIMEOUT)
            )
        ]);
        console.log(`✅ Found ${profileEvents.size} profile events\n`);
    } catch (error) {
        if (error.message.includes('timed out')) {
            console.warn(`⚠️ Profile fetch timed out after ${FETCH_TIMEOUT/1000}s, continuing with partial results...\n`);
            profileEvents = new Set(); // Empty set if timeout
        } else {
            throw error;
        }
    }

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

        // Use manual profile if specified, otherwise fetch from relays
        let profile, name, handle, picture, manuallyFixed;

        if (p.manualProfile) {
            // Use manually specified profile data
            name = p.manualProfile.name;
            handle = p.manualProfile.handle;
            picture = p.manualProfile.picture;
            manuallyFixed = true;
            profile = true; // Mark as having profile
        } else {
            // Use fetched profile
            profile = profileMap.get(pubkey);

            if (profile) {
                name = profile.displayName || profile.name || truncateNpub(p.npub);
                handle = profile.nip05 || p.npub;
                picture = profile.picture || null;
            } else {
                name = truncateNpub(p.npub);
                handle = p.npub;
                picture = null;
            }
        }

        return {
            name,
            handle,
            zombiesKilled: p.zombiesKilled,
            npub: p.npub,
            picture,
            hasProfile: !!profile,
            ...(manuallyFixed && { manuallyFixed: true })
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
        const manuallyFixedFlag = p.manuallyFixed ? ', manuallyFixed: true' : '';
        console.log(`    { name: "${p.name}", handle: "${p.handle}", npub: "${p.npub}", picture: ${picture}, zombiesKilled: ${p.zombiesKilled}${manuallyFixedFlag} }${comma}`);
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
