# NIP-46 (Nostr Connect) Implementation Investigation

## Overview

This document investigates adding NIP-46 remote signing support to Plebs vs Zombies, allowing users to connect using remote signers (bunkers) in addition to the current NIP-07 browser extension support.

## What is NIP-46?

NIP-46 (Nostr Connect) is a protocol for 2-way communication between a remote signer and a Nostr client:
- **Client**: The user-facing application (Plebs vs Zombies)
- **Remote Signer (Bunker)**: A daemon/service that holds private keys and signs events
- **Communication**: Uses kind 24133 events with NIP-44 encryption over Nostr relays

## Current Implementation

The current `nostrService.js` uses:
- **NDK v2.5.1** with `NDKNip07Signer` for browser extensions
- **nostr-tools v2.1.4** for utility functions
- Direct `window.nostr` API access for signing

## Implementation Requirements

### 1. Connection Methods

#### Option A: Bunker URL Flow (Recommended)
```
bunker://pubkey?relay=wss://relay.example.com&secret=randomstring&name=AppName
```
- User copies URL from bunker app
- App parses URL and connects automatically
- Most secure as bunker generates the secret

#### Option B: NostrConnect URL Flow
```
nostrconnect://pubkey?relay=wss://relay.example.com&secret=randomstring&name=AppName
```
- App generates URL and displays QR/copyable link
- User scans/pastes into bunker app
- Requires one fewer step from user

### 2. Required Dependencies

Current versions are sufficient:
- **NDK 2.5.1+**: Has `NDKNip46Signer` support
- **nostr-tools 2.1.4+**: Has `BunkerSigner` support

### 3. UI/UX Changes Needed

#### Settings Page Connection Options
Add connection method selection:
```
[ ] Browser Extension (NIP-07) - Currently selected
[ ] Remote Signer (NIP-46) - New option
```

#### NIP-46 Connection Flow
1. **Input Method Selection**:
   - Paste bunker URL
   - Scan QR code
   - Manual connection details

2. **Connection Status**:
   - Connecting to bunker...
   - Connected to: nsec.app
   - Ready for signing

3. **Connection Management**:
   - Disconnect button
   - Connection health indicator
   - Relay status

### 4. Technical Implementation

#### A. Service Layer Updates

**New file: `src/services/nip46Service.js`**
```javascript
import { NDKNip46Signer } from '@nostr-dev-kit/ndk';
import { BunkerSigner } from 'nostr-tools/nip46';

class Nip46Service {
  constructor() {
    this.signer = null;
    this.connected = false;
    this.bunkerPubkey = null;
    this.relays = [];
  }

  async connectWithBunkerUrl(bunkerUrl) {
    // Parse bunker://... URL
    // Create NDKNip46Signer
    // Handle connection flow
  }

  async connectWithDetails(pubkey, relays, secret) {
    // Manual connection setup
  }

  async disconnect() {
    // Clean disconnection
  }

  isConnected() {
    return this.connected && this.signer;
  }

  async signEvent(event) {
    if (!this.signer) throw new Error('Not connected');
    return await this.signer.signEvent(event);
  }
}
```

#### B. NostrService Integration

**Modified `src/services/nostrService.js`**
```javascript
import nip46Service from './nip46Service.js';

class NostrService {
  constructor() {
    // ... existing code ...
    this.signingMethod = 'nip07'; // 'nip07' | 'nip46'
    this.nip46Service = nip46Service;
  }

  async initialize() {
    let signer = null;
    
    if (this.signingMethod === 'nip07' && typeof window.nostr !== 'undefined') {
      signer = new NDKNip07Signer();
    } else if (this.signingMethod === 'nip46' && this.nip46Service.isConnected()) {
      signer = this.nip46Service.signer;
    }
    
    this.ndk = new NDK({
      explicitRelayUrls: this.relays,
      signer: signer
    });
    
    await this.ndk.connect();
  }

  async signEvent(event) {
    if (this.signingMethod === 'nip07') {
      return await window.nostr.signEvent(event);
    } else if (this.signingMethod === 'nip46') {
      return await this.nip46Service.signEvent(event);
    }
    throw new Error('No signing method available');
  }
}
```

#### C. UI Components

**New component: `src/components/Nip46Connection.vue`**
```vue
<template>
  <div class="card">
    <h3>Remote Signer Connection (NIP-46)</h3>
    
    <!-- Connection Status -->
    <div v-if="connected" class="status-connected">
      <span class="text-zombie-green">✅ Connected to bunker</span>
      <button @click="disconnect">Disconnect</button>
    </div>
    
    <!-- Connection Form -->
    <div v-else class="connection-form">
      <div class="input-group">
        <label>Bunker URL:</label>
        <input 
          v-model="bunkerUrl" 
          placeholder="bunker://..."
          @paste="handleUrlPaste"
        />
      </div>
      
      <button @click="connect" :disabled="connecting">
        {{ connecting ? 'Connecting...' : 'Connect' }}
      </button>
      
      <div class="help-text">
        <p>Get a bunker URL from:</p>
        <ul>
          <li><a href="https://nsec.app" target="_blank">nsec.app</a></li>
          <li><a href="https://nsecbunker.com" target="_blank">nsecBunker</a></li>
        </ul>
      </div>
    </div>
  </div>
</template>
```

### 5. Security Considerations

#### Connection Security
- **Secret Validation**: Ensure bunker validates the secret
- **Relay Trust**: Use trusted relays for NIP-46 communication
- **Connection Persistence**: Store connection details securely

#### Permission Model
- **Method Permissions**: `sign_event`, `nip44_encrypt`, etc.
- **Kind Restrictions**: Limit to specific event kinds if needed
- **User Consent**: Clear indication when remote signing occurs

### 6. User Experience Flow

#### First-Time Setup
1. User goes to Settings
2. Selects "Remote Signer (NIP-46)" option  
3. Chooses connection method (URL paste/QR scan)
4. Enters bunker URL or connection details
5. App connects and requests permissions
6. User approves connection in bunker app
7. Connection confirmed in Plebs vs Zombies

#### Daily Usage
1. App automatically reconnects to stored bunker
2. When signing needed, request is sent to bunker
3. User approves in bunker app (if required)
4. Signed event returned to app
5. Event published to relays

### 7. Error Handling

#### Connection Errors
- Bunker unreachable
- Invalid URL format
- Permission denied
- Network timeouts

#### Signing Errors
- User rejection in bunker
- Connection lost during signing
- Invalid event format

### 8. Testing Strategy

#### Development Testing
- Mock bunker service for local testing
- Unit tests for URL parsing
- Integration tests with real bunkers

#### User Testing
- Test with nsec.app
- Test with nsecBunker
- Connection stability testing
- Performance comparison with NIP-07

## Implementation Effort Estimate

### Phase 1: Core Implementation (2-3 days)
- [ ] Create `nip46Service.js` with basic connection logic
- [ ] Integrate with existing `nostrService.js`
- [ ] Add connection method selection to Settings
- [ ] Implement bunker URL parsing

### Phase 2: UI Enhancement (1-2 days)
- [ ] Create `Nip46Connection.vue` component
- [ ] Add connection status indicators
- [ ] Implement QR code scanning (optional)
- [ ] Add help/documentation

### Phase 3: Polish & Testing (1-2 days)
- [ ] Error handling and user feedback
- [ ] Connection persistence
- [ ] Performance optimization
- [ ] Integration testing

**Total Estimate: 4-7 days**

## Recommended Libraries

### For NDK Implementation
```bash
# Already available in project
@nostr-dev-kit/ndk: ^2.5.1  # Has NDKNip46Signer
```

### For nostr-tools Implementation
```bash
# Already available in project  
nostr-tools: ^2.1.4  # Has BunkerSigner
```

### Additional Dependencies (if needed)
```bash
# For QR code support
qr-code-styling: ^1.6.0-rc.1
html5-qrcode: ^2.3.8
```

## Popular Bunker Services

### For Testing
- **nsec.app**: Web-based bunker service
- **nsecBunker**: Self-hosted option
- **Amber (Android)**: Mobile bunker app

### Production Considerations
- Most users will use nsec.app initially
- Power users may run their own bunkers
- Mobile users may prefer Amber

## Conclusion

Adding NIP-46 support to Plebs vs Zombies is technically feasible with the current dependency versions. The implementation would provide users with an alternative to browser extensions, especially valuable for:

1. **Mobile users** who can't install browser extensions
2. **Security-conscious users** who prefer remote key storage
3. **Power users** who want more control over their signing setup

The estimated implementation effort is moderate (4-7 days) and would significantly improve accessibility and security options for users.

## Next Steps

1. **Prototype**: Create basic NIP-46 connection proof-of-concept
2. **Design Review**: Finalize UI/UX design with stakeholders  
3. **Implementation**: Follow the phased approach outlined above
4. **Testing**: Comprehensive testing with real bunker services
5. **Documentation**: User guide for NIP-46 setup and usage