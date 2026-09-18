// Debug script for investigating "Unknown" user issue
// Run this in the browser console with the app loaded

async function debugSpecificUser() {
  const npub = 'npub1322q93cnsnws5wra8hh5swu039eklhlzd0pgyan8rqs2l9pveflqfcspw0';
  const hex = '8a9402c71384dd0a387d3def483b8f89736fdfe26bc28276671820af942cca7e';
  
  console.log('🔍 DEBUGGING UNKNOWN USER ISSUE');
  console.log('================================');
  console.log(`NPUB: ${npub}`);
  console.log(`HEX:  ${hex}`);
  console.log('');
  
  try {
    // Import services dynamically
    const nostrServiceModule = await import('/src/services/nostrService.js');
    const nostrService = nostrServiceModule.default;
    
    console.log('1. 📋 Fetching profile metadata directly...');
    const profileMap = await nostrService.getProfileMetadata([hex]);
    const profile = profileMap.get(hex);
    
    console.log('Profile data received:');
    console.log('- Raw profile object:', profile);
    console.log('- Name:', profile?.name || 'null');
    console.log('- Display Name:', profile?.display_name || 'null');
    console.log('- About:', profile?.about ? profile.about.substring(0, 100) + '...' : 'null');
    console.log('- Picture:', profile?.picture || 'null');
    console.log('- NIP-05:', profile?.nip05 || 'null');
    console.log('- Deleted:', profile?.deleted);
    console.log('');
    
    // Check what the display logic would show
    const displayName = profile?.display_name || profile?.name || 'Unknown User';
    console.log(`2. 🖥️ Display logic result: "${displayName}"`);
    console.log('');
    
    // Check if user is in current follows list
    console.log('3. 📝 Checking current follows list...');
    const app = document.querySelector('#app')?.__vue_app__;
    if (app) {
      // Try to find the follows manager component
      const followsComponent = app._instance?.proxy?.$children?.find(c => c.$options.name === 'FollowsManagerView');
      if (followsComponent) {
        const userInList = followsComponent.followList.find(f => f.pubkey === hex);
        if (userInList) {
          console.log('User found in follows list:');
          console.log('- Pubkey:', userInList.pubkey);
          console.log('- Profile data:', userInList.profile);
          console.log('- Display name would be:', userInList.profile?.display_name || userInList.profile?.name || 'Unknown User');
        } else {
          console.log('❌ User not found in current follows list');
        }
      } else {
        console.log('❌ FollowsManagerView component not found');
      }
    } else {
      console.log('❌ Vue app not found');
    }
    
    console.log('');
    console.log('4. 🔍 Checking for profile events directly from relays...');
    await nostrService.initialize();
    
    const profileFilter = {
      kinds: [0],
      authors: [hex],
      limit: 5
    };
    
    const events = await nostrService.ndk.fetchEvents(profileFilter);
    console.log(`Found ${events.size} profile events for this user`);
    
    events.forEach((event, index) => {
      console.log(`Event ${index + 1}:`);
      console.log('- Created at:', new Date(event.created_at * 1000).toISOString());
      console.log('- Content length:', event.content.length);
      console.log('- Content preview:', event.content.substring(0, 100) + '...');
      
      try {
        const parsed = JSON.parse(event.content);
        console.log('- Parsed name:', parsed.name);
        console.log('- Parsed display_name:', parsed.display_name);
        console.log('- Parsed deleted:', parsed.deleted);
      } catch (e) {
        console.log('- JSON parse error:', e.message);
      }
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Error during investigation:', error);
  }
  
  console.log('🏁 INVESTIGATION COMPLETE');
}

// Run the investigation
debugSpecificUser().catch(console.error);