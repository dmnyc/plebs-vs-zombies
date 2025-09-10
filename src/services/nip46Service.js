import NDK, { NDKNip46Signer } from '@nostr-dev-kit/ndk';

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
      if (!bunkerUrl.startsWith('bunker://')) {
        throw new Error('Invalid bunker URL format. Must start with bunker://');
      }

      const url = new URL(bunkerUrl);
      const pubkey = url.hostname;
      const relay = url.searchParams.get('relay');
      const secret = url.searchParams.get('secret');
      const name = url.searchParams.get('name');

      if (!pubkey || pubkey.length !== 64) {
        throw new Error('Invalid pubkey in bunker URL');
      }

      if (!relay || !relay.startsWith('wss://')) {
        throw new Error('Invalid or missing relay in bunker URL');
      }

      return {
        pubkey,
        relay,
        secret,
        name: name || this.appName
      };
    } catch (error) {
      console.error('Failed to parse bunker URL:', error);
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
      }

      this.localPrivateKey = localPrivateKey;
      this.bunkerPubkey = bunkerDetails.pubkey;
      this.bunkerRelays = [bunkerDetails.relay];
      this.connectionSecret = bunkerDetails.secret;

      // Create NDK instance for bunker communication
      const bunkerNdk = new NDK({
        explicitRelayUrls: this.bunkerRelays
      });

      await bunkerNdk.connect();
      console.log('✅ Connected to bunker relays');

      // Create NIP-46 signer
      this.signer = new NDKNip46Signer(
        bunkerNdk,
        this.bunkerPubkey,
        localPrivateKey
      );

      // Test connection by getting public key
      console.log('🔐 Testing bunker connection...');
      const testPubkey = await this.signer.user().then(user => user.pubkey);
      
      if (!testPubkey) {
        throw new Error('Failed to get public key from bunker');
      }

      console.log('✅ NIP-46 connection established');
      console.log('👤 Remote pubkey:', testPubkey.substring(0, 8) + '...');

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
      const user = await this.signer.user();
      return user.pubkey;
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
    return this.signer;
  }
}

// Create singleton instance
const nip46Service = new Nip46Service();
export default nip46Service;