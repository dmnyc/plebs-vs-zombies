#!/usr/bin/env node

/**
 * Debug utility to investigate zombie detection false positives
 * Usage: node debug-zombie-detection.js <npub>
 */

import { nip19 } from 'nostr-tools';
import NDK from '@nostr-dev-kit/ndk';

const DEBUG_NPUB = process.argv[2] || 'npub1yaul8k059377u9lsu67de7y637w4jtgeuwcmh5n7788l6xnlnrgs3tvjmf';

// Default relays used by scout service
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band', 
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.wine'
];

// Thresholds from zombie service
const THRESHOLDS = {
  fresh: 90,    // 3 months minimum before considering zombie
  rotting: 180, // 6 months for "rotting" zombie  
  ancient: 365, // 1 year for "ancient" zombie
  conservative: 120 // Ultra conservative threshold from zombie service (4 months)
};

async function debugZombieDetection(npub) {
  try {
    console.log('🔍 Debugging zombie detection for:', npub);
    
    // Decode npub to hex
    const decoded = nip19.decode(npub);
    const pubkey = decoded.data;
    console.log('📋 Hex pubkey:', pubkey);
    console.log('📋 Short pubkey:', pubkey.substring(0, 8) + '...');
    
    // Initialize NDK with same relays as scout service
    console.log('\n🔗 Connecting to relays...');
    const ndk = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS
    });
    
    await ndk.connect();
    console.log('✅ Connected to relays');
    
    // Test 1: Original Scout Mode scanning approach (limited event kinds)
    console.log('\n🔬 TEST 1: Original Scout Mode scanning approach');
    const scoutFilter = {
      kinds: [0, 1, 3, 6, 7, 9735], // Original Scout mode event kinds
      authors: [pubkey],
      limit: 25,
      since: Math.floor(Date.now() / 1000) - (120 * 24 * 60 * 60) // 120 days
    };
    
    console.log('📡 Scout filter:', scoutFilter);
    const scoutEvents = await ndk.fetchEvents(scoutFilter);
    console.log(`🎯 Scout Mode found ${scoutEvents.size} events in last 120 days`);
    
    if (scoutEvents.size > 0) {
      const eventArray = Array.from(scoutEvents);
      eventArray.sort((a, b) => b.created_at - a.created_at);
      
      console.log('📋 Recent events from Scout Mode:');
      eventArray.slice(0, 5).forEach((event, i) => {
        const daysAgo = (Date.now() / 1000 - event.created_at) / (24 * 60 * 60);
        console.log(`  ${i+1}. Kind ${event.kind}, ${daysAgo.toFixed(1)} days ago`);
      });
      
      const mostRecent = eventArray[0];
      const daysSinceRecent = (Date.now() / 1000 - mostRecent.created_at) / (24 * 60 * 60);
      console.log(`🕒 Most recent activity: ${daysSinceRecent.toFixed(1)} days ago`);
      
      // Apply Scout Mode classification logic
      if (daysSinceRecent < THRESHOLDS.conservative) {
        console.log(`✅ Scout Mode classification: ACTIVE (< ${THRESHOLDS.conservative} days - CONSERVATIVE)`);
      } else if (daysSinceRecent >= THRESHOLDS.ancient) {
        console.log(`💀 Scout Mode classification: ANCIENT zombie (>= ${THRESHOLDS.ancient} days)`);
      } else if (daysSinceRecent >= THRESHOLDS.rotting) {
        console.log(`🧟‍♂️ Scout Mode classification: ROTTING zombie (>= ${THRESHOLDS.rotting} days)`);
      } else if (daysSinceRecent >= THRESHOLDS.fresh) {
        console.log(`🧟‍♀️ Scout Mode classification: FRESH zombie (>= ${THRESHOLDS.fresh} days)`);
      } else {
        console.log(`✅ Scout Mode classification: ACTIVE (fallback)`);
      }
    } else {
      console.log('💀 Scout Mode classification: ANCIENT zombie (no activity found)');
    }
    
    // Test 1b: Improved Scout Mode scanning approach (expanded event kinds)
    console.log('\n🔬 TEST 1b: Improved Scout Mode scanning approach');
    const improvedScoutFilter = {
      kinds: [
        0, 1, 3, 6, 7, 9735, // Original Scout Mode kinds
        4, 5, 9734, 10002, // DMs, deletions, zap requests, relay lists
        30023, 30024, 31989, 31990 // Long form, live events, app definitions
      ],
      authors: [pubkey],
      limit: 25,
      since: Math.floor(Date.now() / 1000) - (120 * 24 * 60 * 60) // 120 days
    };
    
    console.log('📡 Improved Scout filter covers', improvedScoutFilter.kinds.length, 'event kinds');
    const improvedScoutEvents = await ndk.fetchEvents(improvedScoutFilter);
    console.log(`🎯 Improved Scout Mode found ${improvedScoutEvents.size} events in last 120 days`);
    
    if (improvedScoutEvents.size > 0) {
      const eventArray = Array.from(improvedScoutEvents);
      eventArray.sort((a, b) => b.created_at - a.created_at);
      
      const mostRecent = eventArray[0];
      const daysSinceRecent = (Date.now() / 1000 - mostRecent.created_at) / (24 * 60 * 60);
      console.log(`🕒 Most recent activity: ${daysSinceRecent.toFixed(1)} days ago`);
      
      if (improvedScoutEvents.size > scoutEvents.size) {
        console.log(`✅ IMPROVEMENT: Found ${improvedScoutEvents.size - scoutEvents.size} additional events with expanded kinds`);
      }
    }

    // Test 2: Comprehensive scanning (all event kinds like authenticated mode)
    console.log('\n🔬 TEST 2: Comprehensive scanning approach');
    const comprehensiveFilter = {
      kinds: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 40, 41, 42, 43, 44,
        1063, 1311, 1984, 1985, 9734, 9735, 10000, 10001, 10002,
        30000, 30001, 30008, 30009, 30017, 30018, 30023, 30024,
        31890, 31922, 31923, 31924, 31925, 31989, 31990, 34550
      ],
      authors: [pubkey],
      limit: 50,
      since: Math.floor(Date.now() / 1000) - (120 * 24 * 60 * 60) // 120 days
    };
    
    console.log('📡 Comprehensive filter covers', comprehensiveFilter.kinds.length, 'event kinds');
    const comprehensiveEvents = await ndk.fetchEvents(comprehensiveFilter);
    console.log(`🎯 Comprehensive scan found ${comprehensiveEvents.size} events in last 120 days`);
    
    if (comprehensiveEvents.size > 0) {
      const eventArray = Array.from(comprehensiveEvents);
      eventArray.sort((a, b) => b.created_at - a.created_at);
      
      console.log('📋 Recent events from comprehensive scan:');
      eventArray.slice(0, 10).forEach((event, i) => {
        const daysAgo = (Date.now() / 1000 - event.created_at) / (24 * 60 * 60);
        console.log(`  ${i+1}. Kind ${event.kind}, ${daysAgo.toFixed(1)} days ago`);
      });
      
      const mostRecent = eventArray[0];
      const daysSinceRecent = (Date.now() / 1000 - mostRecent.created_at) / (24 * 60 * 60);
      console.log(`🕒 Most recent activity: ${daysSinceRecent.toFixed(1)} days ago`);
    }
    
    // Test 3: Longer time window
    console.log('\n🔬 TEST 3: Extended time window (1 year)');
    const extendedFilter = {
      kinds: [0, 1, 3, 6, 7, 9735], // Scout mode event kinds
      authors: [pubkey],
      limit: 50,
      since: Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60) // 1 year
    };
    
    const extendedEvents = await ndk.fetchEvents(extendedFilter);
    console.log(`🎯 Extended scan found ${extendedEvents.size} events in last year`);
    
    if (extendedEvents.size > 0) {
      const eventArray = Array.from(extendedEvents);
      eventArray.sort((a, b) => b.created_at - a.created_at);
      
      const mostRecent = eventArray[0];
      const daysSinceRecent = (Date.now() / 1000 - mostRecent.created_at) / (24 * 60 * 60);
      console.log(`🕒 Most recent activity in full year: ${daysSinceRecent.toFixed(1)} days ago`);
      
      // Show event kind distribution
      const kindCounts = {};
      eventArray.forEach(event => {
        kindCounts[event.kind] = (kindCounts[event.kind] || 0) + 1;
      });
      console.log('📊 Event kind distribution:', kindCounts);
    }
    
    // Test 4: Check specific event kinds that might be missed
    console.log('\n🔬 TEST 4: Checking for specific event kinds');
    const specificKinds = [
      { kind: 0, name: 'Profile' },
      { kind: 1, name: 'Text Note' },
      { kind: 3, name: 'Contact List' },
      { kind: 6, name: 'Repost' },
      { kind: 7, name: 'Reaction' },
      { kind: 9735, name: 'Zap' },
      { kind: 10002, name: 'Relay List' },
      { kind: 30023, name: 'Long Form' }
    ];
    
    for (const { kind, name } of specificKinds) {
      const kindFilter = {
        kinds: [kind],
        authors: [pubkey],
        limit: 5,
        since: Math.floor(Date.now() / 1000) - (180 * 24 * 60 * 60) // 6 months
      };
      
      const kindEvents = await ndk.fetchEvents(kindFilter);
      if (kindEvents.size > 0) {
        const newest = Array.from(kindEvents).sort((a, b) => b.created_at - a.created_at)[0];
        const daysAgo = (Date.now() / 1000 - newest.created_at) / (24 * 60 * 60);
        console.log(`  Kind ${kind} (${name}): ${kindEvents.size} events, newest ${daysAgo.toFixed(1)} days ago`);
      } else {
        console.log(`  Kind ${kind} (${name}): No events found`);
      }
    }
    
    console.log('\n🎯 ANALYSIS COMPLETE');
    console.log('📋 Summary:');
    console.log(`- Original Scout Mode (6 kinds, 120d): ${scoutEvents.size} events`);
    console.log(`- Improved Scout Mode (${improvedScoutFilter.kinds.length} kinds, 120d): ${improvedScoutEvents.size} events`);
    console.log(`- Comprehensive (${comprehensiveFilter.kinds.length} kinds, 120d): ${comprehensiveEvents.size} events`);
    console.log(`- Extended scout (6 kinds, 365d): ${extendedEvents.size} events`);
    
    if (scoutEvents.size === 0 && comprehensiveEvents.size > 0) {
      console.log('❌ FALSE POSITIVE DETECTED: Original Scout Mode missed activity that comprehensive scan found');
      if (improvedScoutEvents.size > 0) {
        console.log('✅ FIXED: Improved Scout Mode would catch this activity');
      } else {
        console.log('⚠️  STILL MISSED: Improved Scout Mode still misses this activity');
      }
    } else if (scoutEvents.size === 0 && extendedEvents.size > 0) {
      console.log('⚠️  POSSIBLE FALSE POSITIVE: No recent activity but historical activity exists');
    } else if (scoutEvents.size > 0) {
      console.log('✅ Original Scout Mode correctly detected activity');
    } else {
      console.log('🤔 No activity found in any scan - may be genuine zombie');
    }
    
    // Additional improvement analysis
    if (improvedScoutEvents.size > scoutEvents.size) {
      console.log(`🚀 IMPROVEMENT: Enhanced Scout Mode found ${improvedScoutEvents.size - scoutEvents.size} additional events`);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugZombieDetection(DEBUG_NPUB).then(() => {
  console.log('\n🏁 Debug complete');
  process.exit(0);
}).catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});