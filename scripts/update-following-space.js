#!/usr/bin/env node

/**
 * Update the following.space "Zombie Hunters" event with new leaderboard participants
 *
 * This script:
 * 1. Fetches the current following.space event
 * 2. Extracts all existing p-tags (participants)
 * 3. Adds new leaderboard participants who aren't already in the list
 * 4. Creates and publishes an updated replaceable event
 *
 * Usage: node scripts/update-following-space.js
 */

import { nip19, finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { SimplePool } from 'nostr-tools/pool';
import { bytesToHex } from '@noble/hashes/utils';

// Configuration
// Note: EVENT_ID changes each time the event is updated (replaceable event)
// We fetch by kind + author + d-tag instead
const EXPECTED_AUTHOR = '0b04ac14550f78ad19ae493aaab5e0bcf53c9c412b1d2e10ced28aeb48acbd3f';
const D_TAG = 'a9pxvkdhuo61';
const EVENT_KIND = 39089;
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://nostr.land'
];

// Get private key from environment variable
const PRIVATE_KEY_HEX = process.env.NOSTR_PRIVATE_KEY;

if (!PRIVATE_KEY_HEX) {
  console.error('❌ Error: NOSTR_PRIVATE_KEY environment variable not set');
  console.error('\nTo set it:');
  console.error('export NOSTR_PRIVATE_KEY="your-private-key-hex"');
  process.exit(1);
}

// Validate private key format
if (!/^[0-9a-f]{64}$/i.test(PRIVATE_KEY_HEX)) {
  console.error('❌ Error: Invalid private key format. Must be 64 character hex string');
  process.exit(1);
}

// Convert hex private key to Uint8Array
const privateKey = new Uint8Array(PRIVATE_KEY_HEX.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

// Verify the key matches the expected author
const derivedPubkey = getPublicKey(privateKey);
if (derivedPubkey !== EXPECTED_AUTHOR) {
  console.error('❌ Error: Private key does not match the expected event author');
  console.error(`\n   Expected: ${EXPECTED_AUTHOR}`);
  console.error(`   Got:      ${derivedPubkey}`);
  console.error(`\n   This private key cannot update the existing event.`);
  console.error(`   You need the private key for npub: ${nip19.npubEncode(EXPECTED_AUTHOR)}\n`);
  process.exit(1);
}

/**
 * Fetch the current following.space event
 */
async function fetchCurrentEvent(pool) {
  console.log('📡 Fetching current following.space event...\n');

  // Fetch by kind + author + d-tag (replaceable event query)
  const events = await pool.querySync(RELAYS, {
    kinds: [EVENT_KIND],
    authors: [EXPECTED_AUTHOR],
    '#d': [D_TAG]
  });

  if (events.length === 0) {
    throw new Error('Could not find the following.space event');
  }

  // Get the most recent event (highest created_at)
  const event = events.sort((a, b) => b.created_at - a.created_at)[0];

  console.log(`✅ Found event (kind ${event.kind})`);
  console.log(`   Event ID: ${event.id}`);
  console.log(`   Created: ${new Date(event.created_at * 1000).toISOString()}`);
  console.log(`   Current participants: ${event.tags.filter(t => t[0] === 'p').length}\n`);

  return event;
}

/**
 * Load leaderboard participants from fetch-leaderboard-profiles.js
 */
async function loadLeaderboardParticipants() {
  console.log('📋 Loading leaderboard participants...\n');

  // Import the participants array from the fetch script
  const module = await import('./fetch-leaderboard-profiles.js');
  const participants = module.participants || [];

  console.log(`   Found ${participants.length} leaderboard participants\n`);

  // Convert npubs to hex pubkeys
  const pubkeys = [];
  for (const participant of participants) {
    try {
      const decoded = nip19.decode(participant.npub);
      if (decoded.type === 'npub') {
        pubkeys.push(decoded.data);
      }
    } catch (error) {
      console.warn(`   ⚠️  Could not decode npub: ${participant.npub}`);
    }
  }

  return pubkeys;
}

/**
 * Create updated event with new participants
 */
function createUpdatedEvent(currentEvent, newPubkeys) {
  console.log('🔨 Creating updated event...\n');

  // Extract existing p-tags
  const existingPubkeys = new Set(
    currentEvent.tags
      .filter(tag => tag[0] === 'p')
      .map(tag => tag[1])
  );

  console.log(`   Existing participants: ${existingPubkeys.size}`);

  // Find new participants to add
  const pubkeysToAdd = newPubkeys.filter(pk => !existingPubkeys.has(pk));

  console.log(`   New participants to add: ${pubkeysToAdd.length}\n`);

  if (pubkeysToAdd.length === 0) {
    console.log('ℹ️  No new participants to add. Event is already up to date.\n');
    return null;
  }

  // Build new tags array
  const newTags = [];

  // Copy all non-p tags from current event (title, d-tag, description, image, etc.)
  for (const tag of currentEvent.tags) {
    if (tag[0] !== 'p') {
      newTags.push(tag);
    }
  }

  // Add all existing p-tags
  for (const pubkey of existingPubkeys) {
    newTags.push(['p', pubkey]);
  }

  // Add new p-tags
  for (const pubkey of pubkeysToAdd) {
    newTags.push(['p', pubkey]);
  }

  console.log(`   Total participants after update: ${newTags.filter(t => t[0] === 'p').length}\n`);
  console.log('   New participants:');
  pubkeysToAdd.forEach(pk => {
    const npub = nip19.npubEncode(pk);
    console.log(`   - ${npub.substring(0, 16)}...`);
  });
  console.log('');

  // Create the event template
  const eventTemplate = {
    kind: EVENT_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: newTags,
    content: currentEvent.content || ''
  };

  // Sign the event
  const signedEvent = finalizeEvent(eventTemplate, privateKey);

  console.log(`✅ Event created and signed`);
  console.log(`   Event ID: ${signedEvent.id}\n`);

  return signedEvent;
}

/**
 * Publish event to relays
 */
async function publishEvent(pool, event) {
  console.log('📤 Publishing to relays...\n');
  console.log(`   Event author pubkey: ${event.pubkey}\n`);

  const publishPromises = RELAYS.map(async (relayUrl) => {
    try {
      const relay = await pool.ensureRelay(relayUrl);
      await relay.publish(event);
      return { relay: relayUrl, success: true, error: null };
    } catch (error) {
      return { relay: relayUrl, success: false, error: error.message || error };
    }
  });

  const results = await Promise.allSettled(publishPromises);

  let successCount = 0;
  let failureCount = 0;

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      const { relay, success, error } = result.value;
      if (success) {
        console.log(`   ✅ ${relay}`);
        successCount++;
      } else {
        console.log(`   ❌ ${relay}`);
        console.log(`      Error: ${error}`);
        failureCount++;
      }
    } else {
      console.log(`   ❌ Promise rejected: ${result.reason}`);
      failureCount++;
    }
  });

  console.log(`\n📊 Results: ${successCount} successful, ${failureCount} failed\n`);

  return successCount > 0;
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Update Following.Space "Zombie Hunters" Event         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const pool = new SimplePool();

  try {
    // Fetch current event
    const currentEvent = await fetchCurrentEvent(pool);

    // Load leaderboard participants
    const leaderboardPubkeys = await loadLeaderboardParticipants();

    // Create updated event
    const updatedEvent = createUpdatedEvent(currentEvent, leaderboardPubkeys);

    if (!updatedEvent) {
      console.log('✨ Done! No updates needed.\n');
      pool.close(RELAYS);
      return;
    }

    // Publish the updated event
    const success = await publishEvent(pool, updatedEvent);

    if (success) {
      console.log('✨ Successfully updated following.space event!\n');

      // Generate nevent for the new event
      const nevent = nip19.neventEncode({
        id: updatedEvent.id,
        relays: RELAYS.slice(0, 3),
        author: updatedEvent.pubkey
      });

      console.log('🔗 New event reference:');
      console.log(`   nostr:${nevent}\n`);
      console.log('🌐 View on following.space:');
      console.log(`   https://following.space\n`);
    } else {
      console.log('⚠️  Event created but failed to publish to any relays\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    pool.close(RELAYS);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as updateFollowingSpace };
