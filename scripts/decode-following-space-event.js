#!/usr/bin/env node

/**
 * Decode the following.space nevent and fetch current event data
 */

import { nip19 } from 'nostr-tools';
import WebSocket from 'ws';

// The nevent from following.space
const neventStr = 'nevent1qvzqqqr4xypzqzcy4s292rmc45v6ujf64267p0848jwyz2ca9cgva552ady2e0flqy28wumn8ghj7un9d3shjtnyv9kh2uewd9hsz9nhwden5te0wfjkccte9ehx7um5wghxyctwvsq3gamnwvaz7tmwdaehgu3wdau8gu3wv3jhvqgawaehxw309ahx7um5wgkhqatz9emk2mrvdaexgetj9ehx2aqpp4mhxue69uhkummn9ekx7mqpzemhxue69uhhyetvv9ujuurjd9kkzmpwdejhgqgkwaehxw309a5xjum59ehx7um5wghxcctwvshszrnhwden5te0dehhxtnvdakz7qg3waehxw309ahx7um5wghxcctwvshsz9thwden5te0wfjkccte9ejxzmt4wvhxjme0qythwumn8ghj7un9d3shjtnswf5k6ctv9ehx2ap0qyvhwumn8ghj7un9d3shjtnndehhyapwwdhkx6tpdshsqgrh5u95rqzkkfdt7ygzd38z4r3lxt20vy9xqfspv96z8x6srpsscg655ss4';

console.log('Decoding nevent...\n');

try {
  const decoded = nip19.decode(neventStr);
  console.log('Decoded nevent:');
  console.log(JSON.stringify(decoded, null, 2));
  console.log('\n');

  if (decoded.type === 'nevent') {
    const { id, relays, author } = decoded.data;
    console.log('Event ID:', id);
    console.log('Author:', author || 'Not specified');
    console.log('Relay hints:', relays || 'None');
    console.log('\n');

    // Fetch the event from relays
    const relayUrls = relays && relays.length > 0 ? relays : [
      'wss://relay.damus.io',
      'wss://relay.nostr.band',
      'wss://nos.lol',
      'wss://relay.primal.net'
    ];

    console.log('Fetching event from relays...\n');

    let eventFound = false;

    for (const relayUrl of relayUrls) {
      if (eventFound) break;

      try {
        await new Promise((resolve, reject) => {
          const ws = new WebSocket(relayUrl);
          const timeoutId = setTimeout(() => {
            ws.close();
            reject(new Error('Timeout'));
          }, 10000);

          ws.on('open', () => {
            console.log(`Connected to ${relayUrl}`);
            // REQ for the specific event ID
            const reqMessage = JSON.stringify(['REQ', 'fetch-event', { ids: [id] }]);
            ws.send(reqMessage);
          });

          ws.on('message', (data) => {
            const message = JSON.parse(data.toString());

            if (message[0] === 'EVENT' && message[2]) {
              clearTimeout(timeoutId);
              const event = message[2];
              console.log('\n✅ Event found!\n');
              console.log('Event details:');
              console.log('─────────────────────────────────────');
              console.log('Kind:', event.kind);
              console.log('Created:', new Date(event.created_at * 1000).toISOString());
              console.log('Author pubkey:', event.pubkey);
              console.log('\nTags:');
              event.tags.forEach((tag, i) => {
                if (tag[0] === 'd') {
                  console.log(`  [${i}] d-tag (identifier): ${tag[1]}`);
                } else if (tag[0] === 'title') {
                  console.log(`  [${i}] title: ${tag[1]}`);
                } else if (tag[0] === 'description') {
                  console.log(`  [${i}] description: ${tag[1]}`);
                } else if (tag[0] === 'image') {
                  console.log(`  [${i}] image: ${tag[1]}`);
                } else if (tag[0] === 'p') {
                  console.log(`  [${i}] p-tag: ${tag[1]}`);
                }
              });
              console.log('\nContent:', event.content || '(empty)');
              console.log('\nTotal p-tags (users in list):', event.tags.filter(t => t[0] === 'p').length);
              console.log('\nFull event JSON:');
              console.log(JSON.stringify(event, null, 2));

              eventFound = true;
              ws.close();
              resolve();
            } else if (message[0] === 'EOSE') {
              clearTimeout(timeoutId);
              ws.close();
              resolve();
            }
          });

          ws.on('error', (err) => {
            clearTimeout(timeoutId);
            console.log(`Error connecting to ${relayUrl}:`, err.message);
            reject(err);
          });

          ws.on('close', () => {
            clearTimeout(timeoutId);
            resolve();
          });
        });
      } catch (err) {
        console.log(`Failed to fetch from ${relayUrl}:`, err.message);
      }
    }

    if (!eventFound) {
      console.log('\n⚠️  Event not found on any relay');
    }
  }
} catch (error) {
  console.error('Error decoding nevent:', error);
  process.exit(1);
}
