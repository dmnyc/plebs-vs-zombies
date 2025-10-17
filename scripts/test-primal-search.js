#!/usr/bin/env node

/**
 * Test Primal Cache Search API
 *
 * This script tests different query patterns against Primal's cache service
 * to discover their search API format.
 */

import WebSocket from 'ws';

const PRIMAL_CACHE_URL = 'wss://cache2.primal.net/v1';

function generateRequestId() {
  return Math.random().toString(36).substring(2, 12);
}

async function testPrimalSearch(query) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 Testing search for: "${query}"`);
    console.log(`📡 Connecting to ${PRIMAL_CACHE_URL}...`);

    const ws = new WebSocket(PRIMAL_CACHE_URL);
    const results = [];
    let timeout;

    ws.on('open', () => {
      console.log('✅ Connected!');

      // Try different query patterns that might work
      const requestId = generateRequestId();

      // Correct Primal format: user_search
      const searchQuery = [
        "REQ",
        requestId,
        {
          cache: [
            "user_search",
            { query, limit: 10 }
          ]
        }
      ];

      console.log('\n📤 Sending Primal user_search query:');
      console.log(JSON.stringify(searchQuery, null, 2));
      ws.send(JSON.stringify(searchQuery));

      // Close connection after 3 seconds
      timeout = setTimeout(() => {
        ws.close();
        if (results.length === 0) {
          console.log('❌ No results received (might not be the right query format)');
        }
        resolve(results);
      }, 3000);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('\n📥 Received message:');
        console.log(JSON.stringify(message, null, 2));
        results.push(message);
      } catch (error) {
        console.log('⚠️  Received non-JSON message:', data.toString());
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', () => {
      console.log('🔌 Connection closed');
      clearTimeout(timeout);
    });
  });
}

async function testMultiplePatterns(query) {
  const ws = new WebSocket(PRIMAL_CACHE_URL);

  return new Promise((resolve) => {
    const results = [];

    ws.on('open', () => {
      console.log(`\n🔍 Testing multiple patterns for: "${query}"\n`);

      // Test various possible query formats
      const patterns = [
        // Pattern 1: search_users
        ["REQ", "test1", { cache: ["search_users", { query }] }],

        // Pattern 2: search_profiles
        ["REQ", "test2", { cache: ["search_profiles", { query }] }],

        // Pattern 3: user_search (reverse order)
        ["REQ", "test3", { cache: ["user_search", { q: query }] }],

        // Pattern 4: search with limit
        ["REQ", "test4", { cache: ["search_users", { query, limit: 10 }] }],

        // Pattern 5: Like nostr.band trending but with search
        ["REQ", "test5", { cache: ["search", { query, kind: 0 }] }],
      ];

      patterns.forEach((pattern, idx) => {
        console.log(`📤 Sending pattern ${idx + 1}:`);
        console.log(JSON.stringify(pattern, null, 2));
        ws.send(JSON.stringify(pattern));
      });

      // Wait for responses
      setTimeout(() => {
        ws.close();
        resolve(results);
      }, 5000);
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('\n✅ Got response:');
      console.log(JSON.stringify(message, null, 2));
      results.push(message);
    });

    ws.on('error', (error) => {
      console.error('❌ Error:', error.message);
    });
  });
}

// Run tests
async function main() {
  console.log('🚀 Primal Cache Search API Tester\n');
  console.log('This will test different query patterns to discover the search API format.\n');

  try {
    // Test with "alex" search
    await testMultiplePatterns('alex');

    console.log('\n\n✅ Test complete!');
    console.log('\nIf you see responses above, we found the right format!');
    console.log('If not, we need to inspect Primal\'s actual web app network traffic.\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

main().catch(console.error);
