#!/usr/bin/env node

/**
 * Manually add one or more npubs to the following.space event
 *
 * Usage: node scripts/add-npub-to-following-space.js <npub1> [npub2] [npub3] ...
 * Examples:
 *   node scripts/add-npub-to-following-space.js npub1abc123...
 *   node scripts/add-npub-to-following-space.js npub1abc... npub1def... npub1ghi...
 */

import { nip19, finalizeEvent, getPublicKey } from 'nostr-tools';
import { SimplePool } from 'nostr-tools/pool';

// Configuration (same as main script)
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

// Get command-line arguments (all npubs after script name)
const npubsToAdd = process.argv.slice(2);

if (npubsToAdd.length === 0) {
  console.error('❌ Error: Please provide at least one npub to add');
  console.error('\nUsage: node scripts/add-npub-to-following-space.js <npub1> [npub2] [npub3] ...');
  console.error('Examples:');
  console.error('  node scripts/add-npub-to-following-space.js npub1abc123...');
  console.error('  node scripts/add-npub-to-following-space.js npub1abc... npub1def... npub1ghi...\n');
  process.exit(1);
}

// Get private key from environment variable
const PRIVATE_KEY_HEX = process.env.NOSTR_PRIVATE_KEY;

if (!PRIVATE_KEY_HEX) {
  console.error('❌ Error: NOSTR_PRIVATE_KEY environment variable not set');
  console.error('\nTo set it:');
  console.error('export NOSTR_PRIVATE_KEY="your-private-key-hex"\n');
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

// Decode all npubs to get pubkeys
console.log(`📝 Decoding ${npubsToAdd.length} npub${npubsToAdd.length === 1 ? '' : 's'}...\n`);

const pubkeysToAdd = [];
let hasErrors = false;

for (let i = 0; i < npubsToAdd.length; i++) {
  const npub = npubsToAdd[i];
  try {
    const decoded = nip19.decode(npub);
    if (decoded.type !== 'npub') {
      throw new Error('Not an npub');
    }
    pubkeysToAdd.push(decoded.data);
    console.log(`   ✅ [${i + 1}/${npubsToAdd.length}] ${npub.substring(0, 16)}... → ${decoded.data.substring(0, 16)}...`);
  } catch (error) {
    console.error(`   ❌ [${i + 1}/${npubsToAdd.length}] Invalid: ${npub}`);
    console.error(`      Error: ${error.message}`);
    hasErrors = true;
  }
}

console.log('');

if (hasErrors) {
  console.error('❌ Some npubs could not be decoded. Aborting.\n');
  process.exit(1);
}

console.log(`✅ Successfully decoded ${pubkeysToAdd.length} pubkey${pubkeysToAdd.length === 1 ? '' : 's'}\n`);

/**
 * Fetch the current following.space event
 */
async function fetchCurrentEvent(pool) {
  console.log('📡 Fetching current following.space event...\n');

  const events = await pool.querySync(RELAYS, {
    kinds: [EVENT_KIND],
    authors: [EXPECTED_AUTHOR],
    '#d': [D_TAG]
  });

  if (events.length === 0) {
    throw new Error('Could not find the following.space event');
  }

  const event = events.sort((a, b) => b.created_at - a.created_at)[0];

  console.log(`✅ Found event (kind ${event.kind})`);
  console.log(`   Event ID: ${event.id}`);
  console.log(`   Created: ${new Date(event.created_at * 1000).toISOString()}`);
  console.log(`   Current participants: ${event.tags.filter(t => t[0] === 'p').length}\n`);

  return event;
}

/**
 * Create updated event with the new participants
 */
function createUpdatedEvent(currentEvent, pubkeysToAdd) {
  console.log('🔨 Creating updated event...\n');

  // Extract existing p-tags
  const existingPubkeys = new Set(
    currentEvent.tags
      .filter(tag => tag[0] === 'p')
      .map(tag => tag[1])
  );

  console.log(`   Existing participants: ${existingPubkeys.size}`);

  // Check which pubkeys are new
  const newPubkeys = [];
  const alreadyExists = [];

  for (const pubkey of pubkeysToAdd) {
    if (existingPubkeys.has(pubkey)) {
      alreadyExists.push(pubkey);
    } else {
      newPubkeys.push(pubkey);
    }
  }

  // Report status
  if (alreadyExists.length > 0) {
    console.log(`   ⚠️  Already in list: ${alreadyExists.length} participant${alreadyExists.length === 1 ? '' : 's'}`);
    alreadyExists.forEach(pk => {
      console.log(`      - ${nip19.npubEncode(pk).substring(0, 20)}...`);
    });
  }

  if (newPubkeys.length === 0) {
    console.log(`   ℹ️  No new participants to add.\n`);
    return null;
  }

  console.log(`   Adding new participants: ${newPubkeys.length}`);
  newPubkeys.forEach(pk => {
    console.log(`      + ${nip19.npubEncode(pk).substring(0, 20)}...`);
  });
  console.log('');

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

  // Add all new p-tags
  for (const pubkey of newPubkeys) {
    newTags.push(['p', pubkey]);
  }

  console.log(`   Total participants after update: ${newTags.filter(t => t[0] === 'p').length}\n`);

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
  console.log('║  Add User(s) to Following.Space Event                 ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const pool = new SimplePool();

  try {
    // Fetch current event
    const currentEvent = await fetchCurrentEvent(pool);

    // Create updated event
    const updatedEvent = createUpdatedEvent(currentEvent, pubkeysToAdd);

    if (!updatedEvent) {
      console.log('✨ Done! No new users to add.\n');
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

// Run the script
main();
