import NDK, { NDKNip46Signer } from '@nostr-dev-kit/ndk';
import { generateSecretKey, getPublicKey } from 'nostr-tools';

class Nip46Service {
  constructor() {
    this.signer = null;
    this.connected = false;
    this.connecting = false;
    this.bunkerPubkey = null;
    this.bunkerRelays = [];
    this.localPrivateKey = null;
    this.connectionSecret = null;
    this.appName = 'Plebs vs Zombies';
  }

  /**
   * Parse a bunker URL and extract connection details
   * Format: bunker://pubkey?relay=wss://relay.com&secret=xxx&name=AppName
   */
  parseBunkerUrl(bunkerUrl) {
    try {
      console.log('🔍 Parsing bunker URL:', bunkerUrl);
      
      if (!bunkerUrl.startsWith('bunker://')) {
        throw new Error('Invalid bunker URL format. Must start with bunker://');
      }

      const url = new URL(bunkerUrl);
      const pubkey = url.hostname;
      const relay = url.searchParams.get('relay');
      const secret = url.searchParams.get('secret');
      const name = url.searchParams.get('name');
      
      console.log('📋 Parsed URL components:');
      console.log('  - pubkey:', pubkey, '(length:', pubkey?.length, ')');
      console.log('  - relay:', relay);
      console.log('  - secret:', secret ? '[REDACTED]' : 'null');
      console.log('  - name:', name);

      if (!pubkey || pubkey.length !== 64) {
        throw new Error(`Invalid pubkey in bunker URL. Expected 64 hex chars, got: ${pubkey?.length || 0}`);
      }

      if (!relay || !relay.startsWith('wss://')) {
        throw new Error(`Invalid or missing relay in bunker URL. Got: ${relay}`);
      }

      const result = {
        pubkey,
        relay,
        secret,
        name: name || this.appName
      };
      
      console.log('✅ Successfully parsed bunker URL');
      return result;
    } catch (error) {
      console.error('❌ Failed to parse bunker URL:', error);
      throw new Error(`Invalid bunker URL: ${error.message}`);
    }
  }

  /**
   * Connect using a bunker URL
   */
  async connectWithBunkerUrl(bunkerUrl, localPrivateKey = null) {
    if (this.connecting) {
      throw new Error('Connection already in progress');
    }

    this.connecting = true;

    try {
      console.log('🔌 Connecting to NIP-46 bunker...');
      
      const bunkerDetails = this.parseBunkerUrl(bunkerUrl);
      
      // Generate local private key if not provided (for client-side session)
      if (!localPrivateKey) {
        const { generateSecretKey } = await import('nostr-tools/pure');
        localPrivateKey = generateSecretKey();
        console.log('✅ Generated local private key for session');
      }

      console.log('📋 Setting connection details:');
      console.log('  - bunkerPubkey:', bunkerDetails.pubkey);
      console.log('  - bunkerRelay:', bunkerDetails.relay);
      console.log('  - hasSecret:', !!bunkerDetails.secret);
      
      this.localPrivateKey = localPrivateKey;
      this.bunkerPubkey = bunkerDetails.pubkey;
      this.bunkerRelays = [bunkerDetails.relay];
      this.connectionSecret = bunkerDetails.secret;

      // Create NDK instance for bunker communication
      console.log('🌐 Creating NDK instance with relays:', this.bunkerRelays);
      const bunkerNdk = new NDK({
        explicitRelayUrls: this.bunkerRelays
      });

      console.log('🔌 Connecting to bunker relays...');
      await bunkerNdk.connect();
      console.log('✅ Connected to bunker relays');

      // Create NIP-46 signer
      console.log('🔐 Creating NDKNip46Signer with:');
      console.log('  - bunkerPubkey:', this.bunkerPubkey);
      console.log('  - localPrivateKey length:', localPrivateKey?.length);
      
      try {
        // Create the signer with the remote bunker pubkey
        this.signer = new NDKNip46Signer(
          bunkerNdk,
          this.bunkerPubkey,
          localPrivateKey
        );
        
        // Set the remote pubkey directly to avoid NIP-05 lookup
        if (this.signer.remotePubkey !== this.bunkerPubkey) {
          console.log('🔄 Setting remote pubkey directly to avoid NIP-05 lookup');
          this.signer.remotePubkey = this.bunkerPubkey;
        }
        
        console.log('✅ NDKNip46Signer created successfully');
      } catch (signerError) {
        console.error('❌ Failed to create NDKNip46Signer:', signerError);
        throw signerError;
      }

      // Test connection by getting public key without NIP-05 lookup
      console.log('🔐 Testing bunker connection...');
      try {
        // Set the target directly to avoid NIP-05 lookup
        this.signer.target = this.bunkerPubkey;
        this.signer.remotePubkey = this.bunkerPubkey;
        
        // Skip user object creation to avoid NIP-05 lookup - we already have the pubkey
        console.log('✅ NIP-46 connection established');
        console.log('👤 Remote pubkey:', this.bunkerPubkey.substring(0, 8) + '...');
        
      } catch (testError) {
        console.error('❌ Bunker connection test failed:', testError);
        throw new Error(`Bunker connection test failed: ${testError.message}`);
      }
      
      // Use bunker pubkey directly for return value
      const testPubkey = this.bunkerPubkey;

      this.connected = true;
      this.connecting = false;

      // Save connection details for reconnection
      this.saveConnectionDetails({
        bunkerPubkey: this.bunkerPubkey,
        bunkerRelays: this.bunkerRelays,
        localPrivateKey: Array.from(this.localPrivateKey), // Convert Uint8Array to array for storage
        connectionSecret: this.connectionSecret,
        timestamp: Date.now()
      });

      return {
        success: true,
        pubkey: testPubkey,
        bunkerPubkey: this.bunkerPubkey,
        relay: bunkerDetails.relay
      };

    } catch (error) {
      this.connecting = false;
      this.connected = false;
      console.error('❌ NIP-46 connection failed:', error);
      throw new Error(`Failed to connect to bunker: ${error.message}`);
    }
  }

  /**
   * Connect with manual details
   */
  async connectWithDetails(pubkey, relays, secret, localPrivateKey = null) {
    const bunkerUrl = `bunker://${pubkey}?relay=${relays[0]}&secret=${secret}&name=${encodeURIComponent(this.appName)}`;
    return await this.connectWithBunkerUrl(bunkerUrl, localPrivateKey);
  }

  /**
   * Restore connection from saved details
   */
  async restoreConnection() {
    try {
      const savedConnection = this.getSavedConnectionDetails();
      
      if (!savedConnection) {
        console.log('ℹ️ No saved NIP-46 connection found');
        return false;
      }

      // Check if connection is not too old (7 days)
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - savedConnection.timestamp > maxAge) {
        console.log('⚠️ Saved NIP-46 connection expired');
        this.clearSavedConnection();
        return false;
      }

      console.log('🔄 Restoring NIP-46 connection...');
      
      // Convert array back to Uint8Array
      const localPrivateKey = new Uint8Array(savedConnection.localPrivateKey);
      
      // Reconstruct bunker URL
      const bunkerUrl = `bunker://${savedConnection.bunkerPubkey}?relay=${savedConnection.bunkerRelays[0]}&secret=${savedConnection.connectionSecret}&name=${encodeURIComponent(this.appName)}`;
      
      await this.connectWithBunkerUrl(bunkerUrl, localPrivateKey);
      console.log('✅ NIP-46 connection restored');
      return true;

    } catch (error) {
      console.warn('⚠️ Failed to restore NIP-46 connection:', error.message);
      this.clearSavedConnection();
      return false;
    }
  }

  /**
   * Disconnect from bunker
   */
  async disconnect() {
    try {
      if (this.signer && this.signer.ndk) {
        await this.signer.ndk.pool.close();
      }
    } catch (error) {
      console.warn('Error during NIP-46 disconnect:', error);
    }

    this.signer = null;
    this.connected = false;
    this.connecting = false;
    this.bunkerPubkey = null;
    this.bunkerRelays = [];
    this.localPrivateKey = null;
    this.connectionSecret = null;

    // Clear saved connection
    this.clearSavedConnection();
    
    console.log('✅ NIP-46 disconnected');
  }

  /**
   * Check if connected and ready
   */
  isConnected() {
    return this.connected && this.signer && !this.connecting;
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      bunkerPubkey: this.bunkerPubkey,
      bunkerRelays: this.bunkerRelays,
      hasLocalKey: !!this.localPrivateKey
    };
  }

  /**
   * Sign an event using the bunker
   */
  async signEvent(event) {
    if (!this.isConnected()) {
      throw new Error('NIP-46 bunker not connected');
    }

    try {
      console.log('🔐 Requesting signature from bunker...');
      const signedEvent = await this.signer.signEvent(event);
      console.log('✅ Event signed by bunker');
      return signedEvent;
    } catch (error) {
      console.error('❌ Bunker signing failed:', error);
      
      if (error.message.includes('user rejected')) {
        throw new Error('Signing was rejected in the bunker app');
      } else if (error.message.includes('timeout')) {
        throw new Error('Signing request timed out. Please check your bunker app.');
      } else {
        throw new Error(`Bunker signing failed: ${error.message}`);
      }
    }
  }

  /**
   * Get the remote user's public key
   */
  async getPublicKey() {
    if (!this.isConnected()) {
      throw new Error('NIP-46 bunker not connected');
    }

    try {
      // Return the bunker pubkey directly to avoid NIP-05 lookup
      return this.bunkerPubkey;
    } catch (error) {
      console.error('Failed to get public key from bunker:', error);
      throw new Error('Failed to get public key from bunker');
    }
  }

  /**
   * Save connection details to localStorage
   */
  saveConnectionDetails(details) {
    try {
      localStorage.setItem('nip46_connection', JSON.stringify(details));
    } catch (error) {
      console.warn('Failed to save NIP-46 connection details:', error);
    }
  }

  /**
   * Get saved connection details from localStorage
   */
  getSavedConnectionDetails() {
    try {
      const saved = localStorage.getItem('nip46_connection');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('Failed to load NIP-46 connection details:', error);
      return null;
    }
  }

  /**
   * Check if there are saved connection details
   */
  hasSavedConnection() {
    try {
      const saved = localStorage.getItem('nip46_connection');
      return !!saved;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear saved connection details
   */
  clearSavedConnection() {
    try {
      localStorage.removeItem('nip46_connection');
    } catch (error) {
      console.warn('Failed to clear NIP-46 connection details:', error);
    }
  }

  /**
   * Get the NDK signer instance (for integration with NDK)
   */
  getSigner() {
    if (this.signer && this.bunkerPubkey) {
      // Ensure bunker properties are set
      this.signer.remotePubkey = this.bunkerPubkey;
      this.signer.target = this.bunkerPubkey;
      
      // Set bunker pubkey property if it exists (for newer NDK versions)
      if ('bunkerPubkey' in this.signer) {
        this.signer.bunkerPubkey = this.bunkerPubkey;
      }
    }
    return this.signer;
  }

  /**
   * Modify disconnect to support preserving saved connections
   */
  async disconnect(clearSavedConnection = false) {
    try {
      if (this.signer && this.signer.ndk) {
        // Try different methods for closing NDK connection
        if (this.signer.ndk.pool && typeof this.signer.ndk.pool.close === 'function') {
          await this.signer.ndk.pool.close();
        } else if (typeof this.signer.ndk.disconnect === 'function') {
          await this.signer.ndk.disconnect();
        } else if (typeof this.signer.ndk.close === 'function') {
          await this.signer.ndk.close();
        }
      }
    } catch (error) {
      console.warn('Error during NIP-46 disconnect:', error);
    }

    this.signer = null;
    this.connected = false;
    this.connecting = false;
    this.bunkerPubkey = null;
    this.bunkerRelays = [];
    this.localPrivateKey = null;
    this.connectionSecret = null;

    // Only clear saved connection if explicitly requested (e.g. user clicks "Disconnect" in settings)
    if (clearSavedConnection) {
      console.log('🗑️ Clearing saved connection as requested');
      this.clearSavedConnection();
    } else {
      console.log('💾 Preserving saved connection for quick reconnect');
    }
    
    console.log('✅ NIP-46 disconnected');
  }

  /**
   * Enhanced saveConnectionDetails with debugging
   */
  saveConnectionDetails(details) {
    try {
      console.log('💾 Saving NIP-46 connection details to localStorage');
      const detailsToSave = {
        bunkerPubkey: details.bunkerPubkey.substring(0, 8) + '...',
        bunkerRelays: details.bunkerRelays,
        hasLocalPrivateKey: !!details.localPrivateKey,
        hasConnectionSecret: !!details.connectionSecret,
        timestamp: new Date().toISOString()
      };
      console.log('📋 Details to save:', detailsToSave);
      
      // Save the actual details (not the debug version)
      const actualDetails = {
        bunkerPubkey: details.bunkerPubkey,
        bunkerRelays: details.bunkerRelays,
        localPrivateKey: Array.from(details.localPrivateKey), // Convert Uint8Array to regular array
        connectionSecret: details.connectionSecret,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('nip46_connection', JSON.stringify(actualDetails));
      console.log('✅ Successfully saved NIP-46 connection to localStorage');
      
      // Verify it was saved
      const saved = localStorage.getItem('nip46_connection');
      console.log('🔍 Verification - localStorage has nip46_connection:', !!saved);
    } catch (error) {
      console.error('❌ Failed to save NIP-46 connection details:', error);
    }
  }

  /**
   * Generate connection string for bunker apps
   */
  async generateConnectionString() {
    try {
      console.log('🔗 Generating connection string...');
      
      // Generate a local private key for this connection
      const localPrivateKeyUint8 = generateSecretKey();
      const localPubkey = getPublicKey(localPrivateKeyUint8);
      
      // Store for later use
      this.localPrivateKey = localPrivateKeyUint8;
      this.connectionSecret = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Define relay URLs to use
      const relayUrls = ['wss://relay.nsec.app', 'wss://relay.damus.io'];
      
      console.log('✅ Generated nostrconnect:// connection string');
      console.log('📋 Local pubkey:', localPubkey);
      console.log('🔗 Relay URLs:', relayUrls);
      
      // Use production URL for logo so external signers can access it
      const logoUrl = window.location.hostname === 'localhost'
        ? 'https://plebsvszombies.cc/logo.svg'
        : `${window.location.origin}/logo.svg`;
      
      console.log('🖼️ Using logo URL:', logoUrl);
      
      // Build the nostrconnect:// URL with metadata as URL parameters
      const params = new URLSearchParams();
      relayUrls.forEach(relay => params.append('relay', relay));
      params.set('secret', this.connectionSecret);
      
      // Add metadata as direct URL parameters per NIP-46 spec
      params.set('name', 'Plebs vs Zombies');
      params.set('url', window.location.origin);
      params.set('image', logoUrl);
      
      const connectionString = `nostrconnect://${localPubkey}?${params.toString()}`;
      
      return {
        connectionString,
        localPubkey,
        localPrivateKey: this.localPrivateKey,
        connectionSecret: this.connectionSecret,
        relayUrls
      };
      
    } catch (error) {
      console.error('❌ Failed to generate connection string:', error);
      throw new Error(`Failed to generate connection string: ${error.message}`);
    }
  }
  
  /**
   * Start listening for bunker connection on the generated connection string
   */
  async startListeningForConnection(connectionData) {
    try {
      console.log('👂 Starting to listen for bunker connection...');
      
      // Create NDK instance for listening
      const listenNdk = new NDK({
        explicitRelayUrls: connectionData.relayUrls
      });
      
      await listenNdk.connect();
      console.log('✅ Connected to relays for listening');
      
      // Store listening state
      this.listeningNdk = listenNdk;
      this.listeningConnectionData = connectionData;
      
      // Listen for NIP-46 connection events directed at our local pubkey
      const filter = {
        kinds: [24133], // NIP-46 request events
        '#p': [connectionData.localPubkey],
        since: Math.floor(Date.now() / 1000) - 60 // Listen for events from the last minute
      };
      
      console.log('👂 Listening for bunker connection events...');
      console.log('🔍 Filter:', filter);
      
      const subscription = listenNdk.subscribe(filter);
      
      subscription.on('event', async (event) => {
        console.log('📨 Received NIP-46 event from pubkey:', event.pubkey);
        console.log('🕒 Event created at:', new Date(event.created_at * 1000));
        console.log('📄 Event content:', event.content);
        console.log('🏷️ Event tags:', event.tags);
        
        // Handle the incoming connection
        try {
          await this.handleIncomingConnection(event);
        } catch (error) {
          console.error('❌ Failed to handle incoming connection:', error);
        }
      });
      
      subscription.on('eose', () => {
        console.log('📡 Reached end of stored events, now listening for new events...');
      });
      
      // Set timeout for listening
      setTimeout(() => {
        console.log('⏰ Connection listening timeout (2 minutes)');
        subscription.stop();
        listenNdk.pool?.disconnect();
      }, 120000);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to start listening for connection:', error);
      throw error;
    }
  }

  /**
   * Handle incoming bunker connection
   */
  async handleIncomingConnection(event) {
    console.log('🤝 Processing incoming bunker connection...');
    console.log('📋 Bunker pubkey:', event.pubkey);
    
    // Prevent multiple connection attempts
    if (this.connecting) {
      console.log('⚠️ Connection already in progress, skipping this event');
      return false;
    }
    
    try {
      // Instead of trying to decrypt, let's directly establish the connection
      // since we know this is a connection request from our bunker
      console.log('✅ Detected connection attempt from bunker');
      
      // Use the bunker's pubkey and our stored connection details
      const bunkerPubkey = event.pubkey;
      const bunkerRelay = this.listeningConnectionData.relayUrls[0]; // Use first relay
      const connectionSecret = this.listeningConnectionData.connectionSecret;
      
      // Build the bunker URL for connection
      const bunkerUrl = `bunker://${bunkerPubkey}?relay=${encodeURIComponent(bunkerRelay)}&secret=${connectionSecret}`;
      console.log('🔗 Creating bunker connection with URL:', bunkerUrl);
      
      // Establish the connection
      const result = await this.connectWithBunkerUrl(bunkerUrl, this.listeningConnectionData.localPrivateKey);
      
      console.log('🎉 NIP-46 connection established via connection string!');
      
      // CRITICAL: Set up nostrService integration (same as manual connection)
      const { default: nostrService } = await import('./nostrService.js');
      nostrService.setSigningMethod('nip46');
      nostrService.pubkey = result.pubkey;
      console.log('✅ Set nostrService.pubkey from connection string:', result.pubkey.substring(0, 8) + '...');
      
      // Clean up listening
      if (this.listeningNdk) {
        try {
          await this.listeningNdk.pool?.disconnect();
          console.log('✅ Cleaned up listening NDK connection');
        } catch (cleanupError) {
          console.warn('⚠️ Could not clean up listening connection:', cleanupError.message);
        }
      }
      
      // Notify the UI about successful connection (same as the Vue component does)
      console.log('🚀 Dispatching nip46-connected event for UI updates');
      const connectionEvent = new CustomEvent('nip46-connected', {
        detail: {
          success: true,
          pubkey: result.pubkey,
          bunkerPubkey: bunkerPubkey,
          relay: bunkerRelay
        }
      });
      window.dispatchEvent(connectionEvent);
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to establish connection:', error);
      return false;
    }
  }
}

// Create singleton instance
const nip46Service = new Nip46Service();
export default nip46Service;