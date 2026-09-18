#!/usr/bin/env node

/**
 * NIP-07 Extension Debug Tool
 * 
 * This script tests common NIP-07 extension issues that could prevent login.
 * Run in browser console or use this as reference for debugging.
 */

console.log('🔍 NIP-07 Extension Debug Tool');
console.log('================================');

// Test 1: Check if window.nostr exists
console.log('\n1. Checking if window.nostr exists...');
if (typeof window !== 'undefined' && typeof window.nostr !== 'undefined') {
  console.log('✅ window.nostr is available');
  console.log('   Extension type:', window.nostr.constructor?.name || 'unknown');
  
  // Test 2: Check available methods
  console.log('\n2. Checking available methods...');
  const methods = ['getPublicKey', 'signEvent', 'getRelays', 'nip04'];
  methods.forEach(method => {
    if (typeof window.nostr[method] === 'function') {
      console.log(`   ✅ ${method}() is available`);
    } else {
      console.log(`   ❌ ${method}() is missing`);
    }
  });
  
  // Test 3: Try to get public key
  console.log('\n3. Testing getPublicKey()...');
  window.nostr.getPublicKey()
    .then(pubkey => {
      console.log('✅ getPublicKey() successful');
      console.log('   Public key:', pubkey.substring(0, 8) + '...');
      console.log('   Length:', pubkey.length);
      console.log('   Valid hex?', /^[0-9a-fA-F]{64}$/.test(pubkey));
    })
    .catch(error => {
      console.log('❌ getPublicKey() failed:', error.message);
      
      // Common error analysis
      if (error.message.toLowerCase().includes('user rejected')) {
        console.log('   💡 User rejected the request - try again and approve');
      } else if (error.message.toLowerCase().includes('timeout')) {
        console.log('   💡 Request timed out - extension may be locked');
      } else if (error.message.toLowerCase().includes('not authorized')) {
        console.log('   💡 Not authorized - check extension permissions');
      }
    });
    
  // Test 4: Test signing (with dummy event)
  console.log('\n4. Testing signEvent() with dummy event...');
  const dummyEvent = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: 'NIP-07 test event'
  };
  
  window.nostr.signEvent(dummyEvent)
    .then(signedEvent => {
      console.log('✅ signEvent() successful');
      console.log('   Event ID:', signedEvent.id);
      console.log('   Signature length:', signedEvent.sig?.length || 0);
    })
    .catch(error => {
      console.log('❌ signEvent() failed:', error.message);
    });
    
} else {
  console.log('❌ window.nostr is not available');
  console.log('\n💡 Troubleshooting steps:');
  console.log('   1. Install a NIP-07 extension (Alby, nos2x, etc.)');
  console.log('   2. Make sure the extension is enabled');
  console.log('   3. Check if the extension is unlocked');
  console.log('   4. Try refreshing the page');
  console.log('   5. Check browser developer tools for errors');
}

// Test 5: Check for conflicting extensions
console.log('\n5. Checking for potential conflicts...');
if (typeof window !== 'undefined') {
  const potentialConflicts = ['ethereum', 'bitcoin', 'webln'];
  potentialConflicts.forEach(prop => {
    if (typeof window[prop] !== 'undefined') {
      console.log(`   ⚠️  window.${prop} detected - could conflict with Nostr extension`);
    }
  });
}

console.log('\n📋 Debug complete. Check the results above for issues.');