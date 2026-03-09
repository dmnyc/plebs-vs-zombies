/**
 * NIP-46 Service - Remote Signer Connection
 *
 * Uses nostr-tools BunkerSigner directly for reliable NIP-46 connections.
 * Supports both bunker:// URLs (server-initiated) and nostrconnect:// (client-initiated/QR).
 * Based on Mutable's proven implementation pattern.
 */

import {
  BunkerSigner,
  parseBunkerInput,
  createNostrConnectURI,
} from 'nostr-tools/nip46';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
];

class Nip46Service {
  constructor() {
    this.bunkerSigner = null;
    this.clientSecretKey = null;
    this.bunkerPointer = null;
    this.connected = false;
    this.connecting = false;
    this.appName = 'Plebs vs Zombies';
  }

  /**
   * Connect using a bunker:// URL (server-initiated flow)
   */
  async connectWithBunkerUrl(bunkerUrl) {
    if (this.connecting) {
      throw new Error('Connection already in progress');
    }

    this.connecting = true;

    try {
      console.log('[NIP-46] Connecting with bunker URL...');

      const bunkerPointer = await parseBunkerInput(bunkerUrl);
      if (!bunkerPointer) {
        throw new Error('Invalid bunker URL');
      }

      const secretKey = generateSecretKey();

      const params = {};
      this.bunkerSigner = BunkerSigner.fromBunker(secretKey, bunkerPointer, params);

      await this.bunkerSigner.connect();

      this.clientSecretKey = secretKey;
      this.bunkerPointer = bunkerPointer;
      this.connected = true;
      this.connecting = false;

      const pubkey = await this.bunkerSigner.getPublicKey();
      console.log('[NIP-46] Connected via bunker URL, pubkey:', pubkey.substring(0, 8) + '...');

      this.saveConnectionDetails({
        bunkerPointer: this.bunkerPointer,
        clientSecretKey: bytesToHex(this.clientSecretKey),
        timestamp: Date.now(),
      });

      return {
        success: true,
        pubkey,
        bunkerPubkey: bunkerPointer.pubkey,
        relay: bunkerPointer.relays[0],
      };
    } catch (error) {
      this.connecting = false;
      this.connected = false;
      console.error('[NIP-46] Bunker connection failed:', error);
      throw new Error(`Failed to connect to bunker: ${error.message}`);
    }
  }

  /**
   * Generate a nostrconnect:// URI for QR code scanning (client-initiated flow)
   * Returns the URI and connection data needed for connectFromURI()
   */
  generateConnectionString() {
    const secretKey = generateSecretKey();
    const clientPubkey = getPublicKey(secretKey);
    const secret = bytesToHex(generateSecretKey()).substring(0, 16);

    const logoUrl = window.location.hostname === 'localhost'
      ? 'https://plebsvszombies.cc/logo.svg'
      : `${window.location.origin}/logo.svg`;

    const uri = createNostrConnectURI({
      clientPubkey,
      relays: DEFAULT_RELAYS.slice(0, 3),
      secret,
      name: this.appName,
      url: window.location.origin,
      image: logoUrl,
    });

    console.log('[NIP-46] Generated nostrconnect URI');

    return {
      connectionString: uri,
      secretKey,
      secret,
      localPubkey: clientPubkey,
      relayUrls: DEFAULT_RELAYS.slice(0, 3),
    };
  }

  /**
   * Wait for a remote signer to connect via the nostrconnect:// URI
   * This replaces the old startListeningForConnection + handleIncomingConnection flow.
   * BunkerSigner.fromURI handles all the NIP-46 handshake internally.
   *
   * @param {Object} connectionData - From generateConnectionString()
   * @param {number} maxWait - Max wait time in ms (default 60s)
   * @returns {Promise<Object>} Connection result with pubkey
   */
  async connectFromURI(connectionData, maxWait = 60000) {
    if (this.connecting) {
      throw new Error('Connection already in progress');
    }

    this.connecting = true;

    try {
      console.log('[NIP-46] Waiting for remote signer to connect...');

      const params = {};

      this.bunkerSigner = await BunkerSigner.fromURI(
        connectionData.secretKey,
        connectionData.connectionString,
        params,
        maxWait,
      );

      this.clientSecretKey = connectionData.secretKey;
      this.bunkerPointer = this.bunkerSigner.bp;
      this.connected = true;
      this.connecting = false;

      const pubkey = await this.bunkerSigner.getPublicKey();
      console.log('[NIP-46] Connected via nostrconnect, pubkey:', pubkey.substring(0, 8) + '...');

      this.saveConnectionDetails({
        bunkerPointer: this.bunkerPointer,
        clientSecretKey: bytesToHex(this.clientSecretKey),
        timestamp: Date.now(),
      });

      return {
        success: true,
        pubkey,
        bunkerPubkey: this.bunkerPointer.pubkey,
        relay: this.bunkerPointer.relays[0],
      };
    } catch (error) {
      this.connecting = false;
      this.connected = false;
      console.error('[NIP-46] nostrconnect failed:', error);
      throw error;
    }
  }

  /**
   * Restore a saved connection session.
   * Does NOT send connect() again - the remote signer remembers our client keypair.
   * Signers like Primal reject reconnection with new secrets.
   */
  async restoreConnection() {
    try {
      const saved = this.getSavedConnectionDetails();

      if (!saved) {
        console.log('[NIP-46] No saved connection found');
        return false;
      }

      // Check if connection is not too old (7 days)
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - saved.timestamp > maxAge) {
        console.log('[NIP-46] Saved connection expired');
        this.clearSavedConnection();
        return false;
      }

      console.log('[NIP-46] Restoring connection...');

      const clientSecretKey = hexToBytes(saved.clientSecretKey);
      const bunkerPointer = saved.bunkerPointer;

      const params = {};
      this.bunkerSigner = BunkerSigner.fromBunker(clientSecretKey, bunkerPointer, params);

      // Don't call connect() - remote signer remembers our keypair.
      // Just verify connectivity with a ping.
      try {
        await this.bunkerSigner.ping();
      } catch {
        // If ping fails, connection may still work - some signers don't implement ping
        console.warn('[NIP-46] Ping failed during restore, connection may still work');
      }

      this.clientSecretKey = clientSecretKey;
      this.bunkerPointer = bunkerPointer;
      this.connected = true;

      console.log('[NIP-46] Connection restored');
      return true;
    } catch (error) {
      console.warn('[NIP-46] Failed to restore connection:', error.message);
      this.clearSavedConnection();
      return false;
    }
  }

  /**
   * Disconnect from bunker
   */
  async disconnect(clearSavedConnection = false) {
    try {
      if (this.bunkerSigner) {
        await this.bunkerSigner.close();
      }
    } catch (error) {
      console.warn('[NIP-46] Error during disconnect:', error);
    }

    this.bunkerSigner = null;
    this.clientSecretKey = null;
    this.bunkerPointer = null;
    this.connected = false;
    this.connecting = false;

    if (clearSavedConnection) {
      this.clearSavedConnection();
    }

    console.log('[NIP-46] Disconnected');
  }

  // --- Status ---

  isConnected() {
    return this.connected && this.bunkerSigner && !this.connecting;
  }

  getConnectionStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      bunkerPubkey: this.bunkerPointer?.pubkey || null,
      bunkerRelays: this.bunkerPointer?.relays || [],
      hasLocalKey: !!this.clientSecretKey,
    };
  }

  // --- Signing & Encryption ---

  async signEvent(event) {
    if (!this.isConnected()) {
      throw new Error('NIP-46 bunker not connected');
    }

    // Check if event exceeds NIP-46 transport limit (~64KB NIP-44 plaintext)
    const estimatedSize = JSON.stringify(event).length + 100; // +100 for RPC wrapper
    if (estimatedSize > 60000) {
      console.warn(`[NIP-46] Event too large for remote signer (${Math.round(estimatedSize / 1024)} KB). Attempting NIP-07 fallback...`);
      return await this._signLargeEventWithFallback(event, estimatedSize);
    }

    try {
      return await this.bunkerSigner.signEvent(event);
    } catch (error) {
      const msg = error.message || '';
      if (msg.includes('user rejected') || msg.includes('rejected')) {
        throw new Error('Signing was rejected in the bunker app');
      } else if (msg.includes('timeout')) {
        throw new Error('Signing request timed out. Please check your bunker app.');
      } else if (msg.includes('plaintext size') || msg.includes('65535')) {
        // Shouldn't reach here due to pre-check, but handle just in case
        return await this._signLargeEventWithFallback(event, estimatedSize);
      }
      throw new Error(`Bunker signing failed: ${msg}`);
    }
  }

  /**
   * For events exceeding the NIP-46 64KB transport limit, fall back to NIP-07
   * browser extension signing if available.
   */
  async _signLargeEventWithFallback(event, estimatedSize) {
    if (typeof window.nostr !== 'undefined' && typeof window.nostr.signEvent === 'function') {
      console.log('[NIP-46] Using browser extension (NIP-07) to sign oversized event');
      try {
        const signed = await Promise.race([
          window.nostr.signEvent(event),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Browser extension signing timed out')), 60000)
          ),
        ]);
        console.log('[NIP-46] Large event signed via NIP-07 fallback');
        return signed;
      } catch (fallbackError) {
        throw new Error(
          `Event too large for remote signer (${Math.round(estimatedSize / 1024)} KB) ` +
          `and browser extension signing also failed: ${fallbackError.message}`
        );
      }
    }

    throw new Error(
      `Event too large for remote signer (${Math.round(estimatedSize / 1024)} KB). ` +
      `NIP-46 has a 64KB transport limit. Install a browser extension (NIP-07) to sign large events, ` +
      `or reduce your follow list in smaller batches.`
    );
  }

  async getPublicKey() {
    if (!this.isConnected()) {
      throw new Error('NIP-46 bunker not connected');
    }
    return await this.bunkerSigner.getPublicKey();
  }

  async nip44Encrypt(pubkey, plaintext) {
    if (!this.isConnected()) throw new Error('NIP-46 not connected');
    return await this.bunkerSigner.nip44Encrypt(pubkey, plaintext);
  }

  async nip44Decrypt(pubkey, ciphertext) {
    if (!this.isConnected()) throw new Error('NIP-46 not connected');
    return await this.bunkerSigner.nip44Decrypt(pubkey, ciphertext);
  }

  async nip04Encrypt(pubkey, plaintext) {
    if (!this.isConnected()) throw new Error('NIP-46 not connected');
    return await this.bunkerSigner.nip04Encrypt(pubkey, plaintext);
  }

  async nip04Decrypt(pubkey, ciphertext) {
    if (!this.isConnected()) throw new Error('NIP-46 not connected');
    return await this.bunkerSigner.nip04Decrypt(pubkey, ciphertext);
  }

  // --- Signer for NDK integration ---

  /**
   * Get the BunkerSigner instance.
   * nostrService uses this as a signer for NDK operations.
   */
  getSigner() {
    return this.bunkerSigner;
  }

  // --- Persistence ---

  saveConnectionDetails(details) {
    try {
      localStorage.setItem('nip46_connection', JSON.stringify(details));
    } catch (error) {
      console.warn('[NIP-46] Failed to save connection details:', error);
    }
  }

  getSavedConnectionDetails() {
    try {
      const saved = localStorage.getItem('nip46_connection');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      return null;
    }
  }

  hasSavedConnection() {
    return !!this.getSavedConnectionDetails();
  }

  clearSavedConnection() {
    try {
      localStorage.removeItem('nip46_connection');
    } catch (error) {
      console.warn('[NIP-46] Failed to clear connection details:', error);
    }
  }
}

const nip46Service = new Nip46Service();
export default nip46Service;
