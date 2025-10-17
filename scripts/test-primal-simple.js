#!/usr/bin/env node

/**
 * Test Primal Cache Search API
 * Using the correct format discovered from their web app
 */

import WebSocket from 'ws';

const PRIMAL_CACHE_URL = 'wss://cache2.primal.net/v1';

function searchPrimal(query) {
  return new Promise((resolve) => {
    console.log(`\n🔍 Searching Primal for: "${query}"`);
    console.log(`📡 Connecting to ${PRIMAL_CACHE_URL}...\n`);

    const ws = new WebSocket(PRIMAL_CACHE_URL);
    const results = [];

    ws.on('open', () => {
      console.log('✅ Connected!');

      const requestId = 'test_' + Math.random().toString(36).substring(7);
      const searchQuery = [
        "REQ",
        requestId,
        {
          cache: [
            "user_search",
            {
              query,
              limit: 10
            }
          ]
        }
      ];

      console.log('📤 Sending query:');
      console.log(JSON.stringify(searchQuery, null, 2));
      console.log('');

      ws.send(JSON.stringify(searchQuery));

      // Close after 3 seconds
      setTimeout(() => {
        ws.close();
        resolve(results);
      }, 3000);
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📥 Received:');
      console.log(JSON.stringify(message, null, 2));
      console.log('');
      results.push(message);
    });

    ws.on('error', (error) => {
      console.error('❌ Error:', error.message);
    });

    ws.on('close', () => {
      console.log('🔌 Connection closed\n');
    });
  });
}

async function main() {
  console.log('🚀 Primal Cache Search Test\n');

  const results = await searchPrimal('alex');

  console.log('\n📊 Summary:');
  console.log(`Total messages received: ${results.length}`);

  const events = results.filter(r => r[0] === 'EVENT');
  console.log(`Profile events: ${events.length}`);

  if (events.length > 0) {
    console.log('\n✅ SUCCESS! Primal search works!');
    console.log('\nProfiles found:');
    events.forEach(event => {
      const profile = event[2];
      console.log(`- ${profile.display_name || profile.name || 'unnamed'} (${profile.pubkey?.substring(0, 16)}...)`);
    });
  } else {
    console.log('\n⚠️  No profiles returned');
  }
}

main().catch(console.error);
