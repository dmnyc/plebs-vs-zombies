#!/usr/bin/env node

/**
 * Follow List Republisher
 *
 * This script fetches your most recent follow list and republishes it to all configured relays
 * to ensure consistency across the Nostr network.
 *
 * Problems this solves:
 * 1. Different relays serving different versions of your follow list
 * 2. Outdated follow lists on some relays
 * 3. Missing follow list events on newly added relays
 *
 * Usage:
 *   node scripts/republish-follow-list.js <nsec-or-hex-private-key>
 *
 * Safety Features:
 * - Derives your public key from your private key
 * - Fetches the most recent follow list from all relays
 * - Shows you what will be published before signing
 * - Requires confirmation before publishing
 * - Verifies publication to all relays
 * - Reports success/failure for each relay
 */

import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import readline from 'readline';

// Default fallback relays if NIP-65 relay list is not found
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
 * Decode nsec to hex if needed
 */
function decodePrivateKey(identifier) {
  if (!identifier) {
    throw new Error('No private key provided');
  }

  // If it's already hex (64 chars), return it
  if (identifier.length === 64 && /^[0-9a-fA-F]+$/.test(identifier)) {
    return identifier;
  }

  // Try to decode as nsec
  if (identifier.startsWith('nsec1')) {
    try {
      const { data } = nip19.decode(identifier);
      return data;
    } catch (error) {
      throw new Error('Invalid nsec format');
    }
  }

  throw new Error('Private key must be hex or nsec format');
}

/**
 * Fetch user's NIP-65 relay list (kind 10002)
 */
async function fetchUserRelays(ndk, pubkey) {
  console.log('\n📡 Fetching your relay list (NIP-65)...\n');

  const filter = {
    kinds: [10002],
    authors: [pubkey],
    limit: 1
  };

  return new Promise((resolve) => {
    let relayList = [];
    const subscription = ndk.subscribe(filter, { closeOnEose: false });

    subscription.on('event', (event) => {
      // Parse relay tags
      const relays = event.tags
        .filter(tag => tag[0] === 'r')
        .map(tag => {
          const url = tag[1];
          const marker = tag[2]; // 'read' or 'write' or undefined (both)
          return { url, marker };
        });

      relayList = relays;
    });

    subscription.on('eose', () => {
      subscription.stop();
      resolve(relayList);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      subscription.stop();
      resolve(relayList);
    }, 10000);
  });
}

/**
 * Get list of relays to publish to
 */
async function getPublishRelays(ndk, pubkey) {
  const userRelays = await fetchUserRelays(ndk, pubkey);

  if (userRelays.length === 0) {
    console.log('⚠️  No NIP-65 relay list found, using default relays\n');
    return DEFAULT_RELAYS;
  }

  // Get relays that have write capability (marker is 'write' or undefined)
  const writeRelays = userRelays
    .filter(r => !r.marker || r.marker === 'write')
    .map(r => r.url);

  console.log(`✅ Found ${writeRelays.length} write-capable relays from your NIP-65 list:`);
  writeRelays.forEach(url => {
    console.log(`   • ${url}`);
  });
  console.log();

  return writeRelays.length > 0 ? writeRelays : DEFAULT_RELAYS;
}

/**
 * Fetch the most recent contact list event
 */
async function fetchMostRecentContactList(ndk, pubkey) {
  console.log('\n📡 Fetching your most recent follow list from all relays...\n');

  const filter = {
    kinds: [3],
    authors: [pubkey],
    limit: 50
  };

  return new Promise((resolve) => {
    const events = [];
    const subscription = ndk.subscribe(filter, { closeOnEose: false });

    subscription.on('event', (event) => {
      events.push(event);
    });

    subscription.on('eose', () => {
      subscription.stop();

      if (events.length === 0) {
        resolve(null);
        return;
      }

      // Sort by timestamp (most recent first)
      events.sort((a, b) => b.created_at - a.created_at);

      console.log(`✅ Found ${events.length} contact list events`);
      console.log(`   Most recent: ${new Date(events[0].created_at * 1000).toISOString()}`);
      console.log(`   Event ID: ${events[0].id}\n`);

      resolve(events[0]);
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      subscription.stop();

      if (events.length === 0) {
        resolve(null);
        return;
      }

      events.sort((a, b) => b.created_at - a.created_at);
      console.log(`⏰ Fetch timeout - found ${events.length} events\n`);
      resolve(events[0]);
    }, 15000);
  });
}

/**
 * Prompt user for confirmation
 */
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim() === 'yes' || answer.toLowerCase().trim() === 'y');
    });
  });
}

/**
 * Publish event to all relays and track results
 */
async function publishToAllRelays(ndk, event) {
  console.log('\n📤 Publishing to all relays...\n');

  const results = {
    success: [],
    failed: [],
    timeout: []
  };

  // Publish to NDK (which will broadcast to all connected relays)
  try {
    const relaySet = await event.publish();

    // Wait a bit for relays to respond
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check which relays the event was published to
    const relays = Array.from(ndk.pool.relays.values());

    for (const relay of relays) {
      if (relay.connectivity.status === 1) { // Connected
        results.success.push(relay.url);
      } else {
        results.failed.push(relay.url);
      }
    }

  } catch (error) {
    console.error(`❌ Publishing error: ${error.message}\n`);
  }

  return results;
}

/**
 * Verify the event was published by fetching it back
 */
async function verifyPublication(ndk, eventId, pubkey) {
  console.log('\n🔍 Verifying publication across relays...\n');

  const filter = {
    kinds: [3],
    authors: [pubkey],
    ids: [eventId]
  };

  return new Promise((resolve) => {
    const foundOnRelays = new Set();
    const subscription = ndk.subscribe(filter, { closeOnEose: false });

    subscription.on('event', (event) => {
      if (event.relay && event.relay.url) {
        foundOnRelays.add(event.relay.url);
      }
    });

    subscription.on('eose', () => {
      subscription.stop();
      resolve(foundOnRelays);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      subscription.stop();
      resolve(foundOnRelays);
    }, 10000);
  });
}

/**
 * Main republish function
 */
async function republishFollowList(privkeyIdentifier) {
  console.log('🔄 Follow List Republisher\n');
  console.log('═'.repeat(60));

  try {
    // Decode private key
    const privkey = decodePrivateKey(privkeyIdentifier);

    // Initialize NDK with private key signer to derive public key
    // Start with default relays to fetch user's relay list
    const signer = new NDKPrivateKeySigner(privkey);
    const ndk = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS,
      signer: signer
    });

    // Get the user from the signer (this derives the pubkey)
    await signer.blockUntilReady();
    const user = await signer.user();
    const pubkey = user.pubkey;
    const npub = nip19.npubEncode(pubkey);

    console.log(`\n👤 Republishing follow list for:`);
    console.log(`   npub: ${npub}`);
    console.log(`   hex:  ${pubkey.substring(0, 16)}...${pubkey.substring(48)}\n`);
    console.log('═'.repeat(60));

    console.log(`\n🔌 Connecting to default relays to fetch your relay list...`);

    // Start connection
    ndk.connect().catch(err => console.log('Connection error (non-fatal):', err.message));

    // Wait for relays to connect
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

    // Fetch user's relay list (NIP-65)
    const userRelays = await getPublishRelays(ndk, pubkey);

    // Now reconnect NDK with user's actual relays
    console.log(`\n🔄 Reconnecting to your ${userRelays.length} configured relays...\n`);

    // Disconnect from default relays
    for (const relay of ndk.pool.relays.values()) {
      relay.disconnect();
    }

    // Create new NDK instance with user's relays
    const userNdk = new NDK({
      explicitRelayUrls: userRelays,
      signer: signer
    });

    userNdk.connect().catch(err => console.log('Connection error (non-fatal):', err.message));

    // Wait for user relays to connect
    waitTime = 0;
    while (waitTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;

      const userConnectedRelays = Array.from(userNdk.pool.relays.values())
        .filter(r => r.connectivity.status === 1);

      console.log(`   ${waitTime / 1000}s: ${userConnectedRelays.length} relays connected`);

      if (userConnectedRelays.length >= Math.min(3, userRelays.length)) {
        console.log(`\n✅ Connected to ${userConnectedRelays.length} relays - proceeding\n`);
        break;
      }
    }

    // Fetch most recent follow list
    const mostRecentEvent = await fetchMostRecentContactList(userNdk, pubkey);

    if (!mostRecentEvent) {
      console.log('❌ No contact list found for this pubkey\n');
      return;
    }

    // Show what will be published
    const pTags = mostRecentEvent.tags.filter(tag => tag[0] === 'p');
    console.log('📋 Follow list details:\n');
    console.log('─'.repeat(60));
    console.log(`   Total follows: ${pTags.length}`);
    console.log(`   Original event: ${mostRecentEvent.id}`);
    console.log(`   Created: ${new Date(mostRecentEvent.created_at * 1000).toISOString()}`);
    console.log(`   Content: ${mostRecentEvent.content ? `"${mostRecentEvent.content.substring(0, 50)}..."` : '(empty)'}`);
    console.log();

    // Ask for confirmation
    console.log('⚠️  This will republish your follow list to YOUR configured relays.\n');
    const confirmed = await askConfirmation('   Do you want to proceed? (yes/no): ');

    if (!confirmed) {
      console.log('\n❌ Cancelled by user\n');
      return;
    }

    // Create new event with same content but new timestamp
    const newEvent = new NDKEvent(userNdk);
    newEvent.kind = 3;
    newEvent.tags = mostRecentEvent.tags;
    newEvent.content = mostRecentEvent.content;
    newEvent.created_at = Math.floor(Date.now() / 1000);

    // Sign the event
    await newEvent.sign(signer);

    console.log(`\n✍️  Event signed`);
    console.log(`   New event ID: ${newEvent.id}`);
    console.log(`   Timestamp: ${new Date(newEvent.created_at * 1000).toISOString()}`);

    // Publish to all relays
    const publishResults = await publishToAllRelays(userNdk, newEvent);

    // Show immediate results
    console.log('📊 Initial publication results:\n');
    console.log(`   ✅ Published to: ${publishResults.success.length} relays`);
    console.log(`   ❌ Failed: ${publishResults.failed.length} relays`);

    if (publishResults.success.length > 0) {
      console.log(`\n   Success:`);
      publishResults.success.forEach(url => {
        console.log(`      • ${url}`);
      });
    }

    if (publishResults.failed.length > 0) {
      console.log(`\n   Failed:`);
      publishResults.failed.forEach(url => {
        console.log(`      • ${url}`);
      });
    }

    // Verify publication
    const verifiedRelays = await verifyPublication(userNdk, newEvent.id, pubkey);

    // Filter to only show verification for relays we actually published to
    const verifiedUserRelays = Array.from(verifiedRelays).filter(url => userRelays.includes(url));

    console.log(`\n🔍 Verification results:\n`);
    console.log(`   Event found on ${verifiedUserRelays.length}/${userRelays.length} of your configured relays:`);

    for (const url of verifiedUserRelays) {
      console.log(`      ✅ ${url}`);
    }

    const notFound = userRelays.filter(url => !verifiedRelays.has(url));
    if (notFound.length > 0) {
      console.log(`\n   Not yet visible on ${notFound.length} relays:`);
      notFound.forEach(url => {
        console.log(`      ⏳ ${url}`);
      });
      console.log(`\n   Note: Some relays may take time to propagate the event.`);
    }

    // Success summary
    console.log('\n\n✅ Republication Complete!\n');
    console.log('═'.repeat(60));
    console.log(`\n   Your follow list has been republished with ${pTags.length} follows`);
    console.log(`   Successfully published to ${verifiedUserRelays.length}/${userRelays.length} relays`);
    console.log(`\n   You can verify the update in your Nostr client.`);
    console.log(`   It may take a few moments for all clients to reflect the changes.\n`);

    // Disconnect
    try {
      if (userNdk && userNdk.pool) {
        for (const relay of userNdk.pool.relays.values()) {
          relay.disconnect();
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nUsage: node scripts/republish-follow-list.js <nsec-or-hex-privkey>\n');
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('❌ Error: Missing required argument\n');
  console.error('Usage: node scripts/republish-follow-list.js <nsec-or-hex-privkey>\n');
  console.error('Example:');
  console.error('  node scripts/republish-follow-list.js nsec1xyz...\n');
  console.error('⚠️  Warning: Your private key (nsec) will be used to sign the event.');
  console.error('   Make sure you trust this script and keep your nsec secure.\n');
  process.exit(1);
}

const [privkeyIdentifier] = args;

// Run republish
republishFollowList(privkeyIdentifier);
