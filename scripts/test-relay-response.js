#!/usr/bin/env node

/**
 * Relay Response Test Script
 *
 * Tests publishing an event to a specific relay and captures the raw response.
 * This helps diagnose why relays silently reject events.
 *
 * Usage:
 *   node scripts/test-relay-response.js <relay-url> <nsec>
 *
 * Example:
 *   node scripts/test-relay-response.js wss://nostr.bitcoiner.social nsec1...
 */

import WebSocket from 'ws';
import { nip19 } from 'nostr-tools';
import { getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import NDK from '@nostr-dev-kit/ndk';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.wine'
];

/**
 * Decode nsec to hex
 */
function decodePrivateKey(identifier) {
  if (!identifier) {
    throw new Error('No private key provided');
  }

  if (identifier.length === 64 && /^[0-9a-fA-F]+$/.test(identifier)) {
    return identifier;
  }

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
 * Fetch the most recent contact list from default relays
 */
async function fetchMostRecentContactList(pubkey) {
  console.log('\n📡 Fetching your most recent contact list...\n');

  const ndk = new NDK({
    explicitRelayUrls: DEFAULT_RELAYS
  });

  await ndk.connect();

  // Wait for connections
  await new Promise(resolve => setTimeout(resolve, 2000));

  const filter = {
    kinds: [3],
    authors: [pubkey],
    limit: 1
  };

  return new Promise((resolve) => {
    let mostRecent = null;
    const subscription = ndk.subscribe(filter, { closeOnEose: false });

    subscription.on('event', (event) => {
      if (!mostRecent || event.created_at > mostRecent.created_at) {
        mostRecent = event;
      }
    });

    subscription.on('eose', () => {
      subscription.stop();
      resolve(mostRecent);
    });

    setTimeout(() => {
      subscription.stop();
      resolve(mostRecent);
    }, 5000);
  });
}

/**
 * Test publishing to a specific relay via raw WebSocket
 */
async function testRelayPublish(relayUrl, event) {
  console.log(`\n🔌 Connecting to ${relayUrl}...`);

  return new Promise((resolve) => {
    const ws = new WebSocket(relayUrl);
    const messages = [];
    let connected = false;

    const timeout = setTimeout(() => {
      ws.close();
      resolve({
        success: false,
        error: 'Timeout waiting for response',
        messages: messages
      });
    }, 10000);

    ws.on('open', () => {
      connected = true;
      console.log(`✅ Connected to ${relayUrl}`);

      // Send EVENT message
      const eventMessage = JSON.stringify(['EVENT', event]);
      console.log(`\n📤 Sending EVENT...`);
      console.log(`   Event ID: ${event.id}`);
      console.log(`   Event size: ${eventMessage.length.toLocaleString()} bytes (${(eventMessage.length / 1024).toFixed(2)} KB)`);
      console.log(`   Tags: ${event.tags.length}`);

      ws.send(eventMessage);
    });

    ws.on('message', (data) => {
      const message = data.toString();
      messages.push(message);

      console.log(`\n📥 Response from relay:`);
      console.log(`   Raw: ${message}`);

      try {
        const parsed = JSON.parse(message);
        console.log(`   Type: ${parsed[0]}`);

        if (parsed[0] === 'OK') {
          console.log(`   Event ID: ${parsed[1]}`);
          console.log(`   Accepted: ${parsed[2]}`);
          console.log(`   Message: ${parsed[3] || '(none)'}`);

          clearTimeout(timeout);
          ws.close();
          resolve({
            success: parsed[2],
            message: parsed[3],
            messages: messages
          });
        } else if (parsed[0] === 'NOTICE') {
          console.log(`   Notice: ${parsed[1]}`);
        }
      } catch (error) {
        console.log(`   Parse error: ${error.message}`);
      }
    });

    ws.on('error', (error) => {
      console.log(`❌ WebSocket error: ${error.message}`);
      clearTimeout(timeout);
      resolve({
        success: false,
        error: error.message,
        messages: messages
      });
    });

    ws.on('close', () => {
      if (!connected) {
        console.log(`❌ Failed to connect`);
        clearTimeout(timeout);
        resolve({
          success: false,
          error: 'Failed to connect',
          messages: messages
        });
      }
    });
  });
}

/**
 * Main test function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('❌ Error: Missing required arguments\n');
    console.error('Usage: node scripts/test-relay-response.js <relay-url> <nsec>\n');
    console.error('Example:');
    console.error('  node scripts/test-relay-response.js wss://nostr.bitcoiner.social nsec1...\n');
    process.exit(1);
  }

  const [relayUrl, privkeyIdentifier] = args;

  try {
    console.log('🧪 Relay Response Test\n');
    console.log('═'.repeat(60));

    // Decode private key
    const privkey = decodePrivateKey(privkeyIdentifier);
    const pubkey = getPublicKey(privkey);
    const npub = nip19.npubEncode(pubkey);

    console.log(`\n👤 Testing for:`);
    console.log(`   npub: ${npub}`);
    console.log(`   hex:  ${pubkey.substring(0, 16)}...${pubkey.substring(48)}`);
    console.log(`\n🎯 Target relay: ${relayUrl}`);

    // Fetch most recent contact list
    const mostRecentEvent = await fetchMostRecentContactList(pubkey);

    if (!mostRecentEvent) {
      console.log('❌ Could not fetch your contact list\n');
      process.exit(1);
    }

    console.log(`\n✅ Found contact list:`);
    console.log(`   Event ID: ${mostRecentEvent.id}`);
    console.log(`   Created: ${new Date(mostRecentEvent.created_at * 1000).toISOString()}`);
    console.log(`   Follows: ${mostRecentEvent.tags.filter(t => t[0] === 'p').length}`);

    // Create new event with same content but new timestamp
    const eventTemplate = {
      kind: 3,
      created_at: Math.floor(Date.now() / 1000),
      tags: mostRecentEvent.tags,
      content: mostRecentEvent.content || ''
    };

    // Finalize event (adds id, pubkey, and sig)
    const newEvent = finalizeEvent(eventTemplate, privkey);

    console.log(`\n✍️  Created new event:`);
    console.log(`   New Event ID: ${newEvent.id}`);
    console.log(`   Timestamp: ${new Date(newEvent.created_at * 1000).toISOString()}`);

    // Test publishing to the relay
    console.log('\n' + '═'.repeat(60));
    const result = await testRelayPublish(relayUrl, newEvent);

    console.log('\n' + '═'.repeat(60));
    console.log('\n📊 Test Result:\n');

    if (result.success) {
      console.log(`✅ Event was ACCEPTED by the relay`);
      if (result.message) {
        console.log(`   Message: ${result.message}`);
      }
    } else if (result.success === false && result.message) {
      console.log(`❌ Event was REJECTED by the relay`);
      console.log(`   Reason: ${result.message}`);
    } else if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    } else {
      console.log(`⚠️  Unknown result - relay may have accepted silently`);
    }

    if (result.messages.length > 0) {
      console.log(`\n📝 All messages received (${result.messages.length}):`);
      result.messages.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg}`);
      });
    }

    console.log();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
