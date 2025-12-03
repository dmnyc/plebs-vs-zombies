#!/usr/bin/env node

/**
 * Follow List Analyzer
 *
 * This script helps diagnose and fix issues with Nostr follow lists (kind 3 events).
 *
 * Problems this solves:
 * 1. Multiple conflicting contact lists published across different relays
 * 2. Invalid pubkeys in follow list (non-hex, wrong length, etc.)
 * 3. Identifies which relays have which versions of your contact list
 *
 * Usage:
 *   node scripts/analyze-follow-list.js <your-npub-or-hex-pubkey>
 *
 * Optional flags:
 *   --clean    Remove invalid pubkeys and show cleaned version
 *   --export   Export the cleaned follow list to a JSON file
 */

import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import fs from 'fs';

// Default relay list for comprehensive scanning (fallback)
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.wine',
  'wss://relay.snort.social',
  'wss://nostr-pub.wellorder.net',
  'wss://relay.current.fyi',
  'wss://nostr.mom',
  'wss://relay.orangepill.dev',
  'wss://relay.nostrati.com',
  'wss://nostr21.com',
  'wss://relay.nostrich.cc'
];

/**
 * Validate if a string is a valid hex pubkey (64 chars, hex)
 */
function isValidPubkey(pubkey) {
  if (!pubkey || typeof pubkey !== 'string') {
    return false;
  }

  if (pubkey.length !== 64) {
    return false;
  }

  if (!/^[0-9a-fA-F]+$/.test(pubkey)) {
    return false;
  }

  return true;
}

/**
 * Decode npub to hex if needed
 */
function decodeIdentifier(identifier) {
  if (!identifier) {
    throw new Error('No identifier provided');
  }

  // If it's already hex (64 chars), return it
  if (identifier.length === 64 && /^[0-9a-fA-F]+$/.test(identifier)) {
    return identifier;
  }

  // Try to decode as npub
  if (identifier.startsWith('npub1')) {
    try {
      const { data } = nip19.decode(identifier);
      return data;
    } catch (error) {
      throw new Error('Invalid npub format');
    }
  }

  throw new Error('Identifier must be a hex pubkey or npub');
}

/**
 * Fetch user's NIP-65 relay list (kind 10002)
 */
async function fetchUserRelays(ndk, pubkey) {
  const filter = {
    kinds: [10002],
    authors: [pubkey],
    limit: 1
  };

  return new Promise((resolve) => {
    let relayList = [];
    const subscription = ndk.subscribe(filter, { closeOnEose: false });

    subscription.on('event', (event) => {
      const relays = event.tags
        .filter(tag => tag[0] === 'r')
        .map(tag => ({ url: tag[1], marker: tag[2] }));
      relayList = relays;
    });

    subscription.on('eose', () => {
      subscription.stop();
      resolve(relayList);
    });

    setTimeout(() => {
      subscription.stop();
      resolve(relayList);
    }, 8000);
  });
}

/**
 * Get combined list of relays (user's NIP-65 + defaults)
 */
async function getRelaysToCheck(ndk, pubkey) {
  const userRelays = await fetchUserRelays(ndk, pubkey);

  if (userRelays.length === 0) {
    return DEFAULT_RELAYS;
  }

  // Get all relay URLs (both read and write)
  const userRelayUrls = userRelays.map(r => r.url);

  // Combine user relays with defaults, removing duplicates
  const combined = [...new Set([...userRelayUrls, ...DEFAULT_RELAYS])];

  return combined;
}

/**
 * Fetch all contact list events from all relays and track which relay served each
 */
async function fetchAllContactLists(ndk, pubkey) {
  console.log('\n📡 Fetching contact lists from all relays...\n');

  const filter = {
    kinds: [3],
    authors: [pubkey],
    limit: 50 // Get more events to see history
  };

  // Track which relays serve which event IDs
  const eventRelayMap = new Map(); // eventId -> Set of relay URLs

  return new Promise((resolve) => {
    const events = [];
    const subscription = ndk.subscribe(filter, { closeOnEose: false });

    subscription.on('event', (event) => {
      events.push(event);

      // Track which relay this event came from
      if (event.relay && event.relay.url) {
        if (!eventRelayMap.has(event.id)) {
          eventRelayMap.set(event.id, new Set());
        }
        eventRelayMap.get(event.id).add(event.relay.url);
      }
    });

    subscription.on('eose', () => {
      subscription.stop();

      // Attach relay info to events
      events.forEach(event => {
        event._relayUrls = Array.from(eventRelayMap.get(event.id) || []);
      });

      console.log(`✅ Found ${events.length} contact list events\n`);
      console.log(`📊 Event distribution across relays:`);

      // Show relay distribution
      const eventsByRelay = new Map();
      for (const [eventId, relays] of eventRelayMap.entries()) {
        for (const relay of relays) {
          if (!eventsByRelay.has(relay)) {
            eventsByRelay.set(relay, new Set());
          }
          eventsByRelay.get(relay).add(eventId);
        }
      }

      for (const [relay, eventIds] of eventsByRelay.entries()) {
        console.log(`   ${relay}: ${eventIds.size} events`);
      }
      console.log();

      resolve(events);
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      subscription.stop();

      // Attach relay info to events
      events.forEach(event => {
        event._relayUrls = Array.from(eventRelayMap.get(event.id) || []);
      });

      console.log(`⏰ Fetch timeout - got ${events.length} events\n`);
      resolve(events);
    }, 15000);
  });
}

/**
 * Analyze a single contact list event
 */
function analyzeContactList(event) {
  const pTags = event.tags.filter(tag => tag[0] === 'p');
  const otherTags = event.tags.filter(tag => tag[0] !== 'p');

  const validPubkeys = [];
  const invalidEntries = [];

  for (const tag of pTags) {
    const pubkey = tag[1];

    if (!pubkey) {
      invalidEntries.push({
        type: 'empty',
        tag: tag,
        reason: 'Empty pubkey'
      });
      continue;
    }

    if (!isValidPubkey(pubkey)) {
      invalidEntries.push({
        type: 'invalid',
        tag: tag,
        pubkey: pubkey,
        reason: pubkey.length !== 64
          ? `Wrong length (${pubkey.length} chars instead of 64)`
          : 'Not valid hex characters'
      });
      continue;
    }

    validPubkeys.push(pubkey);
  }

  return {
    id: event.id,
    created_at: event.created_at,
    timestamp: new Date(event.created_at * 1000).toISOString(),
    totalTags: event.tags.length,
    pTags: pTags.length,
    validPubkeys: validPubkeys.length,
    invalidEntries: invalidEntries.length,
    otherTags: otherTags.length,
    content: event.content,
    validPubkeys: validPubkeys,
    invalidEntries: invalidEntries,
    otherTags: otherTags,
    relayUrls: event._relayUrls || []
  };
}

/**
 * Compare contact lists and find unique versions
 */
function compareContactLists(analyses) {
  // Sort by timestamp (most recent first)
  const sorted = analyses.sort((a, b) => b.created_at - a.created_at);

  // Find unique versions based on pubkey set
  const uniqueVersions = [];
  const seenSignatures = new Set();

  for (const analysis of sorted) {
    // Create a signature of the pubkey set (sorted to handle order differences)
    const signature = analysis.validPubkeys.slice().sort().join(',');

    if (!seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      uniqueVersions.push(analysis);
    }
  }

  return uniqueVersions;
}

/**
 * Export cleaned follow list in Plebs vs Zombies compatible format
 */
function exportCleanedFollowList(pubkey, analysis, filename) {
  // Format compatible with Plebs vs Zombies JSON importer (backupService.js)
  const exportData = {
    pubkey: pubkey,
    npub: nip19.npubEncode(pubkey),
    timestamp: Date.now(),
    createdAt: Date.now(),
    followCount: analysis.validPubkeys.length,
    follows: analysis.validPubkeys,
    notes: `Cleaned follow list - removed ${analysis.invalidEntries.length} invalid entries`,

    // Additional metadata for reference
    _metadata: {
      originalEventId: analysis.id,
      originalTimestamp: analysis.timestamp,
      removedInvalid: analysis.invalidEntries.length,
      invalidEntriesRemoved: analysis.invalidEntries.map(entry => ({
        pubkey: entry.pubkey,
        reason: entry.reason
      })),
      preservedTags: analysis.otherTags,
      cleanedBy: 'analyze-follow-list.js',
      cleanedAt: new Date().toISOString()
    }
  };

  fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
  console.log(`\n💾 Exported cleaned follow list to: ${filename}`);
  console.log(`   Format: Plebs vs Zombies compatible`);
  console.log(`   You can import this file at plebsvszombies.cc\n`);
}

/**
 * Main analysis function
 */
async function analyzeFollowList(identifier, options = {}) {
  console.log('🔍 Follow List Analyzer\n');
  console.log('═'.repeat(60));

  try {
    // Decode identifier
    const pubkey = decodeIdentifier(identifier);
    const npub = nip19.npubEncode(pubkey);

    console.log(`\n👤 Analyzing follow list for:`);
    console.log(`   npub: ${npub}`);
    console.log(`   hex:  ${pubkey.substring(0, 16)}...${pubkey.substring(48)}\n`);
    console.log('═'.repeat(60));

    // Initialize NDK with default relays first
    const ndk = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS
    });

    console.log(`\n🔌 Connecting to default relays to fetch your relay list...`);

    // Start connection (non-blocking)
    ndk.connect().catch(err => console.log('Connection error (non-fatal):', err.message));

    // Wait for some relays to connect
    console.log('⏳ Waiting for relay connections...\n');
    let waitTime = 0;
    const maxWaitTime = 8000;
    const checkInterval = 1000;

    while (waitTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;

      const connectedRelays = Array.from(ndk.pool.relays.values())
        .filter(r => r.connectivity.status === 1);

      console.log(`   ${waitTime / 1000}s: ${connectedRelays.length} relays connected`);

      if (connectedRelays.length >= 3) {
        console.log(`\n✅ Connected to ${connectedRelays.length} relays - proceeding\n`);
        break;
      }
    }

    const connectedRelays = Array.from(ndk.pool.relays.values())
      .filter(r => r.connectivity.status === 1);

    if (connectedRelays.length === 0) {
      throw new Error('Failed to connect to any relays. Please check your internet connection.');
    }

    console.log(`📡 Using ${connectedRelays.length} connected relays\n`);

    // Fetch user's NIP-65 relays and combine with defaults
    console.log('🔍 Fetching your NIP-65 relay list...\n');
    const relaysToCheck = await getRelaysToCheck(ndk, pubkey);

    console.log(`📋 Will check ${relaysToCheck.length} relays (your relays + defaults):\n`);

    // Disconnect and reconnect with combined relay list
    for (const relay of ndk.pool.relays.values()) {
      relay.disconnect();
    }

    const fullNdk = new NDK({
      explicitRelayUrls: relaysToCheck
    });

    console.log(`\n🔌 Reconnecting to ${relaysToCheck.length} relays...`);
    fullNdk.connect().catch(err => console.log('Connection error (non-fatal):', err.message));

    // Wait for relays to connect
    console.log('⏳ Waiting for connections...\n');
    waitTime = 0;
    while (waitTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;

      const fullConnectedRelays = Array.from(fullNdk.pool.relays.values())
        .filter(r => r.connectivity.status === 1);

      console.log(`   ${waitTime / 1000}s: ${fullConnectedRelays.length} relays connected`);

      if (fullConnectedRelays.length >= 3) {
        console.log(`\n✅ Connected to ${fullConnectedRelays.length} relays - proceeding\n`);
        break;
      }
    }

    console.log(`📡 Using ${Array.from(fullNdk.pool.relays.values()).filter(r => r.connectivity.status === 1).length} connected relays\n`);

    // Fetch all contact lists using the full relay set
    const events = await fetchAllContactLists(fullNdk, pubkey);

    if (events.length === 0) {
      console.log('❌ No contact list events found for this pubkey\n');
      return;
    }

    // Analyze each event
    console.log('📊 Analysis Results:\n');
    console.log('═'.repeat(60));

    const analyses = events.map(analyzeContactList);
    const uniqueVersions = compareContactLists(analyses);

    console.log(`\n📈 Summary:`);
    console.log(`   Total events found: ${events.length}`);
    console.log(`   Unique versions: ${uniqueVersions.length}`);
    console.log();

    // Show each unique version
    uniqueVersions.forEach((analysis, index) => {
      console.log(`\n📋 Version ${index + 1} (Most Recent ${index === 0 ? '✨' : ''})`);
      console.log('─'.repeat(60));
      console.log(`   Event ID: ${analysis.id.substring(0, 16)}...`);
      console.log(`   Created:  ${analysis.timestamp}`);
      console.log(`   Valid follows: ${analysis.validPubkeys.length}`);
      console.log(`   Invalid entries: ${analysis.invalidEntries.length} ⚠️`);
      console.log(`   Other tags: ${analysis.otherTags.length}`);
      console.log(`   Content: ${analysis.content ? `"${analysis.content.substring(0, 50)}..."` : '(empty)'}`);

      // Show which relays serve this version
      if (analysis.relayUrls.length > 0) {
        console.log(`\n   📡 Served by ${analysis.relayUrls.length} relays:`);
        analysis.relayUrls.forEach(url => {
          console.log(`      • ${url}`);
        });
      } else {
        console.log(`\n   📡 Relay info: Not available`);
      }

      // Show invalid entries if any
      if (analysis.invalidEntries.length > 0) {
        console.log(`\n   ⚠️  Invalid Entries Detected:`);
        analysis.invalidEntries.forEach((entry, i) => {
          console.log(`      ${i + 1}. "${entry.pubkey || '(empty)'}"`);
          console.log(`         Reason: ${entry.reason}`);
        });
      }

      // Show other tags (topics, relay hints, etc.)
      if (analysis.otherTags.length > 0 && options.verbose) {
        console.log(`\n   🏷️  Other Tags:`);
        analysis.otherTags.slice(0, 5).forEach(tag => {
          console.log(`      ${tag[0]}: ${tag[1] || '(empty)'}`);
        });
        if (analysis.otherTags.length > 5) {
          console.log(`      ... and ${analysis.otherTags.length - 5} more`);
        }
      }
    });

    // Recommendations
    console.log('\n\n💡 Recommendations:\n');
    console.log('═'.repeat(60));

    const mostRecent = uniqueVersions[0];

    if (mostRecent.invalidEntries.length > 0) {
      console.log(`\n⚠️  ISSUE: Your follow list contains ${mostRecent.invalidEntries.length} invalid entries`);
      console.log(`   These should be removed to ensure compatibility with all Nostr clients.`);
      console.log(`\n   Invalid entries:`);
      mostRecent.invalidEntries.forEach((entry, i) => {
        console.log(`   ${i + 1}. "${entry.pubkey || '(empty)'}" - ${entry.reason}`);
      });
    }

    if (uniqueVersions.length > 1) {
      console.log(`\n⚠️  ISSUE: You have ${uniqueVersions.length} different versions of your follow list`);
      console.log(`   Different relays may serve different versions, causing inconsistency.`);
      console.log(`\n   Version comparison:`);
      uniqueVersions.forEach((version, i) => {
        console.log(`   Version ${i + 1}: ${version.validPubkeys.length} follows (${version.timestamp})`);
      });
      console.log(`\n   Recommendation: Republish your most recent follow list to all relays`);
      console.log(`   to ensure consistency.`);
    }

    if (mostRecent.invalidEntries.length === 0 && uniqueVersions.length === 1) {
      console.log(`\n✅ Your follow list looks healthy!`);
      console.log(`   - No invalid pubkeys detected`);
      console.log(`   - Consistent across relays`);
      console.log(`   - ${mostRecent.validPubkeys.length} valid follows`);
    }

    // Export options
    if (options.clean) {
      console.log('\n\n🧹 Cleaned Follow List:\n');
      console.log('═'.repeat(60));
      console.log(`\n   Original: ${mostRecent.pTags} total entries`);
      console.log(`   Valid: ${mostRecent.validPubkeys.length} pubkeys`);
      console.log(`   Removed: ${mostRecent.invalidEntries.length} invalid entries`);
      console.log(`   Preserved: ${mostRecent.otherTags.length} other tags`);

      if (options.export) {
        const filename = `cleaned-follow-list-${Date.now()}.json`;
        exportCleanedFollowList(pubkey, mostRecent, filename);
      }
    }

    // Debug tool link
    console.log('\n\n🔧 Debug Tools:\n');
    console.log('═'.repeat(60));
    console.log(`\n   View your contact lists on nostrdebug.com:`);
    const base64Query = Buffer.from(JSON.stringify({
      authors: [pubkey],
      kinds: [3]
    })).toString('base64');
    console.log(`   https://nostrdebug.com/query?base64=${base64Query}`);
    console.log(`\n   View latest event on njump.me:`);
    const nevent = nip19.neventEncode({ id: mostRecent.id, author: pubkey });
    console.log(`   https://njump.me/${nevent}\n`);

    // Disconnect
    try {
      if (fullNdk && fullNdk.pool) {
        // Close all relay connections
        for (const relay of fullNdk.pool.relays.values()) {
          relay.disconnect();
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nUsage: node scripts/analyze-follow-list.js <npub-or-hex-pubkey> [--clean] [--export]\n');
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const identifier = args.find(arg => !arg.startsWith('--'));
const options = {
  clean: args.includes('--clean'),
  export: args.includes('--export'),
  verbose: args.includes('--verbose')
};

if (!identifier) {
  console.error('❌ Error: No identifier provided\n');
  console.error('Usage: node scripts/analyze-follow-list.js <npub-or-hex-pubkey> [--clean] [--export] [--verbose]\n');
  console.error('Options:');
  console.error('  --clean     Show cleaned version without invalid entries');
  console.error('  --export    Export cleaned follow list to JSON file');
  console.error('  --verbose   Show detailed information about tags\n');
  process.exit(1);
}

// Run analysis
analyzeFollowList(identifier, options);
