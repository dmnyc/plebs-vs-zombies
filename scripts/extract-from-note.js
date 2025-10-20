#!/usr/bin/env node

/**
 * Extract leaderboard entry data from a Nostr note
 *
 * This script takes a note ID (note1... or nevent1...) and extracts:
 * - Author's npub
 * - Zombie kill count
 * - Author's display name
 *
 * Usage:
 *   node scripts/extract-from-note.js <note-id>
 *
 * Examples:
 *   node scripts/extract-from-note.js note1j2nrek2hgxqpjl6dfuq3vlvxggrw2j8lckhyy3xhlugmmmr9rf0q8vmxdm
 *   node scripts/extract-from-note.js nevent1qqs0kffj6lzarcemqd4acdlnkdsczzyt29kdjngrz3896jvxmdz5qmgprdmhxue69uhhg6r9vehhyetnwshxummnw3erztnrdakj7mk5wrd
 *   node scripts/extract-from-note.js nostr:note1j2nrek2hgxqpjl6dfuq3vlvxggrw2j8lckhyy3xhlugmmmr9rf0q8vmxdm
 */

import NDK from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

// Nostr relays to query
const RELAYS = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.primal.net',
    'wss://nostr.wine'
];

/**
 * Extract zombie count from note content
 * @param {string} content - The note content
 * @returns {number|null} - The zombie count or null if not found
 */
function extractZombieCount(content) {
    // Match patterns like "X Nostr zombies" or "1 Nostr zombie"
    const patterns = [
        /(\d+)\s+Nostr\s+zombies?/i,
        /killed?\s+(\d+)/i,
        /purged?\s+(\d+)/i,
        /eliminated?\s+(\d+)/i,
        /slaughtered?\s+(\d+)/i
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            return parseInt(match[1], 10);
        }
    }

    return null;
}

/**
 * Decode note ID to get event ID
 * @param {string} noteId - The note ID (note1... or nevent1...)
 * @returns {object} - { eventId: string, relays: string[] }
 */
function decodeNoteId(noteId) {
    try {
        // Strip "nostr:" prefix if present
        const cleanedNoteId = noteId.startsWith('nostr:')
            ? noteId.substring(6)
            : noteId;

        const decoded = nip19.decode(cleanedNoteId);

        if (decoded.type === 'note') {
            // Simple note1... format - just event ID
            return { eventId: decoded.data, relays: [] };
        } else if (decoded.type === 'nevent') {
            // nevent1... format - event ID with optional relay hints
            return {
                eventId: decoded.data.id,
                relays: decoded.data.relays || []
            };
        } else {
            throw new Error(`Invalid note type: ${decoded.type}. Expected 'note' or 'nevent'`);
        }
    } catch (error) {
        throw new Error(`Failed to decode note ID: ${error.message}`);
    }
}

/**
 * Fetch event from Nostr relays
 * @param {string} eventId - The event ID (hex format)
 * @param {string[]} relayHints - Optional relay hints from nevent
 * @returns {Promise<object>} - The event object
 */
async function fetchEvent(eventId, relayHints = []) {
    console.log(`🔍 Fetching event ${eventId.substring(0, 8)}...`);

    // Use relay hints if provided (they're event-specific), with a couple default relays as backup
    // This prevents timeout issues when nevent has many relay hints
    let relaysToUse;
    if (relayHints.length > 0) {
        // Prioritize relay hints, add only 2-3 default relays as backup
        const backupRelays = RELAYS.slice(0, 2);
        relaysToUse = [...relayHints, ...backupRelays];
        console.log(`📍 Using ${relayHints.length} relay hint(s) + ${backupRelays.length} backup(s)`);
    } else {
        // No hints, use all default relays
        relaysToUse = RELAYS;
    }

    const ndk = new NDK({
        explicitRelayUrls: relaysToUse
    });

    console.log(`🔗 Connecting to ${relaysToUse.length} relays...`);

    // Start connection but don't wait for all relays - they connect in background
    ndk.connect().catch(error => {
        console.warn('⚠️ Some relays failed to connect (non-blocking):', error.message);
    });

    // Give relays a brief moment to establish initial connections
    // Reduced from 3s to 2s for faster queries, especially with relay hints
    const connectionWait = relayHints.length > 0 ? 1500 : 2000;
    await new Promise(resolve => setTimeout(resolve, connectionWait));

    // Check how many relays connected
    const connectedRelays = Array.from(ndk?.pool?.relays?.values() || [])
        .filter(r => r.connectivity?.status === 1);
    console.log(`📡 Connected to ${connectedRelays.length}/${relaysToUse.length} relays`);

    // Fetch the specific event with timeout
    // Increased timeout to 15s for better reliability
    const FETCH_TIMEOUT = 15000; // 15 seconds

    console.log(`⏳ Searching for event across relays (timeout: ${FETCH_TIMEOUT/1000}s)...`);

    try {
        const event = await Promise.race([
            ndk.fetchEvent({
                ids: [eventId]
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Event fetch timed out after 10 seconds')), FETCH_TIMEOUT)
            )
        ]);

        if (!event) {
            // Provide helpful error with suggestions
            const suggestions = [
                '\nPossible reasons:',
                '  1. The event does not exist on any of the configured relays',
                '  2. The note ID might be incorrect',
                '  3. The event may have been deleted',
                '  4. Try using a nevent (with relay hints) instead of note1',
                '\nConfigured relays:',
                ...relaysToUse.map(r => `  - ${r}`)
            ];
            throw new Error('Event not found on any relay.\n' + suggestions.join('\n'));
        }

        console.log('✅ Event found!\n');
        return event;
    } catch (error) {
        if (error.message.includes('timed out')) {
            throw new Error(`Event not found: fetch timed out after ${FETCH_TIMEOUT/1000}s.\n\nThe event may not exist on any of the configured relays.\nTry providing relay hints using a nevent instead of note1.`);
        }
        throw error;
    }
}

/**
 * Fetch author profile
 * @param {string} pubkey - The author's pubkey (hex format)
 * @returns {Promise<object>} - The profile data
 */
async function fetchAuthorProfile(pubkey) {
    const ndk = new NDK({
        explicitRelayUrls: RELAYS
    });

    await ndk.connect();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Fetch profile event (kind 0)
    const profileEvent = await ndk.fetchEvent({
        kinds: [0],
        authors: [pubkey]
    });

    if (!profileEvent) {
        return null;
    }

    try {
        const profile = JSON.parse(profileEvent.content);
        return {
            name: profile.name || null,
            displayName: profile.display_name || null,
            nip05: profile.nip05 || null,
            picture: profile.picture || null
        };
    } catch (error) {
        console.error('❌ Failed to parse profile:', error.message);
        return null;
    }
}

/**
 * Extract leaderboard entry from note
 * @param {string} noteId - The note ID (note1... or nevent1...)
 * @returns {Promise<object>} - Extracted data
 */
async function extractFromNote(noteId) {
    try {
        // Decode note ID
        const { eventId, relays } = decodeNoteId(noteId);

        // Fetch event
        const event = await fetchEvent(eventId, relays);

        // Extract zombie count from content
        const zombiesKilled = extractZombieCount(event.content);

        if (zombiesKilled === null) {
            throw new Error('Could not extract zombie count from note content');
        }

        // Convert author pubkey to npub
        const npub = nip19.npubEncode(event.pubkey);

        // Fetch author profile
        console.log('📡 Fetching author profile...');
        const profile = await fetchAuthorProfile(event.pubkey);

        const authorName = profile
            ? (profile.displayName || profile.name || npub.substring(0, 12) + '...')
            : npub.substring(0, 12) + '...';

        return {
            npub,
            zombiesKilled,
            noteId,
            eventId,
            authorName,
            authorProfile: profile,
            content: event.content,
            createdAt: event.created_at
        };
    } catch (error) {
        throw new Error(`Failed to extract data: ${error.message}`);
    }
}

/**
 * Main function - CLI interface
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('❌ Error: No note ID provided\n');
        console.log('Usage: node scripts/extract-from-note.js <note-id>\n');
        console.log('Examples:');
        console.log('  node scripts/extract-from-note.js note1j2nrek2hgxqpjl6dfuq3vlvxggrw2j8lckhyy3xhlugmmmr9rf0q8vmxdm');
        console.log('  node scripts/extract-from-note.js nevent1qqs0kffj6lzarcemqd4acdlnkdsczzyt29kdjngrz3896jvxmdz5qmgprdmhxue69uhhg6r9vehhyetnwshxummnw3erztnrdakj7mk5wrd');
        console.log('  node scripts/extract-from-note.js nostr:note1j2nrek2hgxqpjl6dfuq3vlvxggrw2j8lckhyy3xhlugmmmr9rf0q8vmxdm');
        process.exit(1);
    }

    const noteId = args[0];

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧟 PLEBS VS. ZOMBIES - NOTE EXTRACTOR');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        const result = await extractFromNote(noteId);

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('✅ EXTRACTION SUCCESSFUL');
        console.log('═══════════════════════════════════════════════════════════════\n');

        console.log('📋 LEADERBOARD ENTRY DATA:');
        console.log(`   Name:           ${result.authorName}`);
        console.log(`   npub:           ${result.npub}`);
        console.log(`   Zombies Killed: ${result.zombiesKilled}`);

        if (result.authorProfile?.nip05) {
            console.log(`   NIP-05:         ${result.authorProfile.nip05}`);
        }

        if (result.authorProfile?.picture) {
            console.log(`   Picture:        ${result.authorProfile.picture}`);
        }

        console.log('\n📝 NOTE PREVIEW:');
        const preview = result.content.length > 200
            ? result.content.substring(0, 200) + '...'
            : result.content;
        console.log(`   ${preview.split('\n').join('\n   ')}`);

        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('📊 FOR LEADERBOARD (Copy this line to add to leaderboard):');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`${result.zombiesKilled}    ${result.npub}`);
        console.log('');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

// Export for programmatic use
export { extractFromNote, decodeNoteId, extractZombieCount, fetchEvent, fetchAuthorProfile };
