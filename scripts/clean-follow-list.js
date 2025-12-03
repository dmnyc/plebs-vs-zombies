#!/usr/bin/env node

/**
 * Follow List Cleaner
 *
 * This script removes invalid pubkeys from your Nostr follow list and republishes
 * a clean version to all your relays.
 *
 * IMPORTANT: This requires a signing method (browser extension like Alby, nos2x, etc.)
 *
 * Usage:
 *   node scripts/clean-follow-list.js <your-npub-or-hex-pubkey> [options]
 *
 * Options:
 *   --dry-run       Show what would be cleaned without publishing
 *   --backup        Create a backup JSON file before cleaning
 *   --yes           Skip confirmation prompt (auto-approve)
 *
 * This script will:
 * 1. Fetch your latest contact list
 * 2. Validate all pubkeys and remove invalid ones
 * 3. Preserve all other tags (topics, relay hints, etc.)
 * 4. Show you the changes
 * 5. Ask for confirmation
 * 6. Publish the cleaned list to all relays
 */

import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { nip19, generateSecretKey, getPublicKey } from 'nostr-tools';
import fs from 'fs';
import readline from 'readline';

// Extended relay list for comprehensive publishing
const RELAYS = [
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
 * Validate if a string is a valid hex pubkey
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

  if (identifier.length === 64 && /^[0-9a-fA-F]+$/.test(identifier)) {
    return identifier;
  }

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
 * Fetch the most recent contact list
 */
async function fetchLatestContactList(ndk, pubkey) {
  console.log('\n📡 Fetching your latest contact list...\n');

  const filter = {
    kinds: [3],
    authors: [pubkey],
    limit: 5
  };

  const events = await ndk.fetchEvents(filter);
  const eventArray = Array.from(events);

  if (eventArray.length === 0) {
    throw new Error('No contact list found for this pubkey');
  }

  // Get most recent
  eventArray.sort((a, b) => b.created_at - a.created_at);
  const latest = eventArray[0];

  console.log(`✅ Found contact list from ${new Date(latest.created_at * 1000).toISOString()}\n`);

  return latest;
}

/**
 * Analyze and clean contact list
 */
function analyzeAndClean(event) {
  const pTags = event.tags.filter(tag => tag[0] === 'p');
  const otherTags = event.tags.filter(tag => tag[0] !== 'p');

  const validPTags = [];
  const invalidEntries = [];

  for (const tag of pTags) {
    const pubkey = tag[1];

    if (!pubkey) {
      invalidEntries.push({
        tag: tag,
        pubkey: '(empty)',
        reason: 'Empty pubkey'
      });
      continue;
    }

    if (!isValidPubkey(pubkey)) {
      invalidEntries.push({
        tag: tag,
        pubkey: pubkey,
        reason: pubkey.length !== 64
          ? `Wrong length (${pubkey.length} chars instead of 64)`
          : 'Not valid hex characters'
      });
      continue;
    }

    validPTags.push(tag);
  }

  return {
    original: {
      id: event.id,
      created_at: event.created_at,
      content: event.content,
      totalTags: event.tags.length,
      pTags: pTags.length,
      otherTags: otherTags.length
    },
    validPTags,
    invalidEntries,
    otherTags,
    isClean: invalidEntries.length === 0
  };
}

/**
 * Create backup file in Plebs vs Zombies compatible format
 */
function createBackup(pubkey, event) {
  // Extract follows from event tags
  const follows = event.tags
    .filter(tag => tag[0] === 'p' && tag[1])
    .map(tag => tag[1]);

  // Format compatible with Plebs vs Zombies JSON importer
  const backup = {
    pubkey: pubkey,
    npub: nip19.npubEncode(pubkey),
    timestamp: Date.now(),
    createdAt: Date.now(),
    followCount: follows.length,
    follows: follows,
    notes: 'Backup created before cleaning',

    // Additional metadata for reference
    _metadata: {
      originalEventId: event.id,
      originalEventCreatedAt: new Date(event.created_at * 1000).toISOString(),
      originalContent: event.content,
      originalTags: event.tags,
      backupCreatedBy: 'clean-follow-list.js',
      backupCreatedAt: new Date().toISOString()
    }
  };

  const filename = `follow-list-backup-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(backup, null, 2));
  console.log(`💾 Backup saved to: ${filename}`);
  console.log(`   Format: Plebs vs Zombies compatible`);
  console.log(`   You can import this file at plebsvszombies.cc\n`);
  return filename;
}

/**
 * Ask for user confirmation
 */
function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim() === 'yes' || answer.toLowerCase().trim() === 'y');
    });
  });
}

/**
 * Publish cleaned contact list to relays
 */
async function publishCleanedList(ndk, pubkey, validPTags, otherTags, originalContent, signer) {
  console.log('\n🔐 Creating and signing cleaned contact list event...\n');

  // Combine tags (other tags + valid p tags)
  const allTags = [...otherTags, ...validPTags];

  // Create new event
  const event = new NDKEvent(ndk);
  event.kind = 3;
  event.content = originalContent;
  event.tags = allTags;
  event.pubkey = pubkey;
  event.created_at = Math.floor(Date.now() / 1000);

  // Sign the event
  try {
    await event.sign(signer);
    console.log(`✅ Event signed successfully`);
    console.log(`   Event ID: ${event.id}\n`);
  } catch (error) {
    throw new Error(`Failed to sign event: ${error.message}`);
  }

  // Publish to all relays
  console.log('📡 Publishing to relays...\n');

  const results = await event.publish();

  // Get configured relay URLs
  const configuredRelayUrls = Array.from(ndk.pool.relays.keys());

  // Count only successful publishes to our configured relays
  const successfulConfiguredRelays = Array.from(results).filter(relay =>
    configuredRelayUrls.some(url => relay.url === url)
  );

  const successful = successfulConfiguredRelays.length;

  console.log(`✅ Published to ${successful}/${configuredRelayUrls.length} relays\n`);

  return {
    eventId: event.id,
    publishedToRelays: successful
  };
}

/**
 * Get signing method from environment or prompt
 */
async function getSigner() {
  // Check if nsec is provided in environment (for automation)
  const nsec = process.env.NOSTR_NSEC;

  if (nsec) {
    console.log('🔑 Using private key from NOSTR_NSEC environment variable\n');
    try {
      const { data: privateKeyHex } = nip19.decode(nsec);
      return new NDKPrivateKeySigner(privateKeyHex);
    } catch (error) {
      throw new Error('Invalid NOSTR_NSEC format. Must be nsec1...');
    }
  }

  console.log('⚠️  This script requires signing capability.\n');
  console.log('Options:');
  console.log('  1. Set NOSTR_NSEC environment variable with your nsec key');
  console.log('  2. Use the web-based version at plebsvszombies.cc\n');
  console.log('Example: NOSTR_NSEC=nsec1... node scripts/clean-follow-list.js <npub>\n');

  throw new Error('No signing method available. Please set NOSTR_NSEC or use the web interface.');
}

/**
 * Main function
 */
async function cleanFollowList(identifier, options = {}) {
  console.log('🧹 Follow List Cleaner\n');
  console.log('═'.repeat(60));

  try {
    // Decode identifier
    const pubkey = decodeIdentifier(identifier);
    const npub = nip19.npubEncode(pubkey);

    console.log(`\n👤 Cleaning follow list for:`);
    console.log(`   npub: ${npub}`);
    console.log(`   hex:  ${pubkey.substring(0, 16)}...${pubkey.substring(48)}\n`);
    console.log('═'.repeat(60));

    // Initialize NDK
    const ndk = new NDK({
      explicitRelayUrls: RELAYS
    });

    console.log(`\n🔌 Connecting to ${RELAYS.length} relays...`);

    // Start connection (non-blocking)
    ndk.connect().catch(err => console.log('Connection error (non-fatal):', err.message));

    // Wait for some relays to connect with progress updates
    console.log('⏳ Waiting for relay connections...\n');
    let waitTime = 0;
    const maxWaitTime = 8000; // 8 seconds
    const checkInterval = 1000; // Check every second

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

    // Fetch latest contact list
    const latestEvent = await fetchLatestContactList(ndk, pubkey);

    // Create backup if requested
    if (options.backup) {
      createBackup(pubkey, latestEvent);
    }

    // Analyze and clean
    const analysis = analyzeAndClean(latestEvent);

    console.log('📊 Analysis Results:\n');
    console.log('═'.repeat(60));
    console.log(`\n   Original contact list:`);
    console.log(`   - Total tags: ${analysis.original.totalTags}`);
    console.log(`   - Follow tags (p): ${analysis.original.pTags}`);
    console.log(`   - Other tags: ${analysis.original.otherTags}`);
    console.log(`   - Content: ${analysis.original.content ? `"${analysis.original.content.substring(0, 50)}..."` : '(empty)'}`);

    if (analysis.isClean) {
      console.log(`\n✅ Your follow list is already clean!`);
      console.log(`   No invalid entries found.\n`);
      await ndk.pool.close();
      return;
    }

    console.log(`\n   ⚠️  Found ${analysis.invalidEntries.length} invalid entries:\n`);
    analysis.invalidEntries.forEach((entry, i) => {
      console.log(`   ${i + 1}. "${entry.pubkey}"`);
      console.log(`      Reason: ${entry.reason}`);
    });

    console.log(`\n   Cleaned version:`);
    console.log(`   - Valid follows: ${analysis.validPTags.length}`);
    console.log(`   - Removed: ${analysis.invalidEntries.length}`);
    console.log(`   - Preserved other tags: ${analysis.otherTags.length}`);
    console.log(`   - Total tags: ${analysis.validPTags.length + analysis.otherTags.length}`);

    console.log('\n' + '═'.repeat(60));

    // Dry run mode - just show what would happen
    if (options.dryRun) {
      console.log(`\n🔍 DRY RUN MODE - No changes will be made\n`);
      console.log(`If you proceeded, ${analysis.invalidEntries.length} invalid entries would be removed.`);
      console.log(`The cleaned list would be published to all ${RELAYS.length} relays.\n`);
      await ndk.pool.close();
      return;
    }

    // Ask for confirmation (unless --yes flag)
    if (!options.yes) {
      console.log(`\n⚠️  This will:`);
      console.log(`   1. Remove ${analysis.invalidEntries.length} invalid entries`);
      console.log(`   2. Preserve ${analysis.validPTags.length} valid follows`);
      console.log(`   3. Preserve ${analysis.otherTags.length} other tags`);
      console.log(`   4. Publish to ${RELAYS.length} relays\n`);

      const confirmed = await askConfirmation('Do you want to proceed? (yes/no): ');

      if (!confirmed) {
        console.log('\n❌ Operation cancelled by user\n');
        await ndk.pool.close();
        return;
      }
    }

    // Get signing capability
    const signer = await getSigner();
    ndk.signer = signer;

    // Verify signer matches pubkey
    const signerPubkey = await signer.user().then(u => u.pubkey);
    if (signerPubkey !== pubkey) {
      throw new Error(`Signer pubkey (${signerPubkey}) doesn't match target pubkey (${pubkey})`);
    }

    // Publish cleaned list
    const result = await publishCleanedList(
      ndk,
      pubkey,
      analysis.validPTags,
      analysis.otherTags,
      analysis.original.content,
      signer
    );

    console.log('\n✅ Successfully cleaned and published your follow list!\n');
    console.log('═'.repeat(60));
    console.log(`\n   Removed: ${analysis.invalidEntries.length} invalid entries`);
    console.log(`   Valid follows: ${analysis.validPTags.length}`);
    console.log(`   Published to: ${result.publishedToRelays}/${RELAYS.length} relays`);
    console.log(`   New event ID: ${result.eventId}\n`);
    console.log(`View on njump.me:`);
    const nevent = nip19.neventEncode({ id: result.eventId, author: pubkey });
    console.log(`https://njump.me/${nevent}\n`);

    // Close connections
    try {
      if (ndk && ndk.pool) {
        for (const relay of ndk.pool.relays.values()) {
          relay.disconnect();
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message, '\n');
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const identifier = args.find(arg => !arg.startsWith('--'));
const options = {
  dryRun: args.includes('--dry-run'),
  backup: args.includes('--backup'),
  yes: args.includes('--yes')
};

if (!identifier) {
  console.error('❌ Error: No identifier provided\n');
  console.error('Usage: node scripts/clean-follow-list.js <npub-or-hex-pubkey> [options]\n');
  console.error('Options:');
  console.error('  --dry-run    Show what would be cleaned without publishing');
  console.error('  --backup     Create a backup JSON file before cleaning');
  console.error('  --yes        Skip confirmation prompt (auto-approve)\n');
  console.error('Signing:');
  console.error('  Set NOSTR_NSEC environment variable with your nsec key');
  console.error('  Example: NOSTR_NSEC=nsec1... node scripts/clean-follow-list.js <npub> --backup\n');
  process.exit(1);
}

// Run cleaner
cleanFollowList(identifier, options);
