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
  // Clave's relay proxy keeps a persistent subscription on this relay and
  // wakes Clave via APNs on any kind:24133 event addressed to a paired
  // signer, even while backgrounded. Including it in our nostrconnect URI
  // makes the client -> Clave direction reliable regardless of which of
  // the relays above Clave's own subscription pool has warmed up.
  // https://github.com/DocNR/clave/blob/main/docs/nip46-compatibility.md
  'wss://relay.powr.build',
];

// Hostnames that resolve to "this device". A relay on one of these is only
// reachable if the page itself is running on the same device as the signer.
const LOOPBACK_HOSTS = new Set([
  '127.0.0.1',
  'localhost',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

class Nip46Service {
  constructor() {
    this.bunkerSigner = null;
    this.clientSecretKey = null;
    this.bunkerPointer = null;
    this.connected = false;
    this.connecting = false;
    this.appName = 'Plebs vs Zombies';
    // Set by the UI to render an approval link when a signer replies with an
    // "auth_url" instead of signing straight away. Also mirrored to
    // pendingAuthUrl so a view can pick it up without registering a callback.
    this.onAuthUrl = null;
    this.pendingAuthUrl = null;
  }

  // --- Relay reachability ---

  /**
   * Why this browser page can't open a socket to `relayUrl`, or null if it
   * looks reachable. Catches the two ways a bunker:// URL from a phone-based
   * signer is dead on arrival in a desktop browser.
   */
  _relayUnreachableReason(relayUrl) {
    let url;
    try {
      url = new URL(relayUrl);
    } catch {
      return 'is not a valid relay URL';
    }

    const pageIsSecure = window.location.protocol === 'https:';
    const pageIsLoopback = LOOPBACK_HOSTS.has(window.location.hostname);

    // An https:// page is not allowed to open an insecure ws:// socket; the
    // browser blocks it as mixed content before any network attempt.
    if (pageIsSecure && url.protocol === 'ws:') {
      return 'uses insecure ws://, which this HTTPS page is blocked from opening (mixed content)';
    }

    // A loopback relay lives on the signer's own device. Only reachable if
    // this page is served from that same device (e.g. local dev).
    if (LOOPBACK_HOSTS.has(url.hostname) && !pageIsLoopback) {
      return `points at ${url.hostname}, a relay on the signer's own device that this browser cannot reach`;
    }

    return null;
  }

  /**
   * Throw an actionable error if none of `relays` can be reached from here.
   * Without this the failure surfaces as nostr-tools' opaque AggregateError
   * ("All promises were rejected") the instant connect() publishes.
   */
  _assertRelaysReachable(relays) {
    if (!relays || relays.length === 0) {
      const empty = new Error(
        'This bunker URL does not specify a relay, so there is no way to reach the signer. ' +
          'Copy the full bunker:// URL (it should contain a "?relay=" parameter), ' +
          'or pair with the QR code / Nostr Connect option instead.',
      );
      empty.nip46Actionable = true;
      throw empty;
    }

    const classified = relays.map((relay) => ({
      relay,
      reason: this._relayUnreachableReason(relay),
    }));

    if (classified.some(({ reason }) => reason === null)) {
      return; // at least one relay is worth trying
    }

    const detail = classified
      .map(({ relay, reason }) => `${relay} ${reason}`)
      .join('; ');

    const error = new Error(
      `This bunker URL only lists relays this browser can't reach (${detail}). ` +
        `Signers that run an on-device relay — such as Aegis or Clave on iOS — can't be paired ` +
        `by pasting a bunker:// URL into a browser on another device. ` +
        `Use the QR code / Nostr Connect option instead: it pairs over public relays.`,
    );
    error.nip46Actionable = true;
    throw error;
  }

  /**
   * nostr-tools publishes the connect request with
   * `Promise.any(pool.publish(...))`, so when every relay fails the user sees
   * the AggregateError message "All promises were rejected". Translate it.
   */
  _humanizeRelayFailure(error, relays = []) {
    const message = error?.message || '';
    const isAggregate =
      error instanceof AggregateError ||
      message.includes('All promises were rejected');

    if (!isAggregate) return null;

    const list = relays.length ? ` (${relays.join(', ')})` : '';
    const humanized = new Error(
      `Couldn't reach the signer's relay${relays.length === 1 ? '' : 's'}${list}. ` +
        `The relay may be offline, require authentication, or sit on a network this browser can't see. ` +
        `If your signer runs an on-device relay, pair with the QR code / Nostr Connect option instead.`,
    );
    humanized.nip46Actionable = true;
    return humanized;
  }

  /**
   * Shared BunkerSignerParams. Supplying `onauth` matters: when a signer
   * answers a request with "auth_url", nostr-tools only console.warns if no
   * callback is configured, leaving the request pending until it times out.
   */
  _buildSignerParams() {
    return {
      onauth: (authUrl) => this._handleAuthUrl(authUrl),
    };
  }

  _handleAuthUrl(authUrl) {
    console.log('[NIP-46] Signer requested user authorization:', authUrl);
    this.pendingAuthUrl = authUrl;

    if (typeof this.onAuthUrl === 'function') {
      this.onAuthUrl(authUrl);
      return;
    }

    // No UI hook registered — try a popup. This fires outside the original
    // click, so a blocker may stop it; pendingAuthUrl remains for the UI.
    try {
      window.open(authUrl, 'nip46-auth', 'width=420,height=640');
    } catch (error) {
      console.warn('[NIP-46] Could not open authorization URL:', error);
    }
  }


  /**
   * Some signers (notably Amber) accept the handshake but return an empty or
   * invalid pubkey on the first getPublicKey request. Retry before giving up.
   */
  async getPublicKeyWithRetry(attempts = 3, delayMs = 1500) {
    let lastError = null;
    for (let i = 0; i < attempts; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, delayMs));
      try {
        const pubkey = await this.bunkerSigner.getPublicKey();
        if (pubkey && /^[0-9a-f]{64}$/i.test(pubkey)) return pubkey;
        lastError = new Error('Signer returned an invalid public key');
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('Signer did not return a public key');
  }

  /**
   * Connect using a bunker:// URL (server-initiated flow)
   */
  async connectWithBunkerUrl(bunkerUrl) {
    if (this.connecting) {
      throw new Error('Connection already in progress');
    }

    this.connecting = true;
    // Captured for the error path: this.bunkerSigner may be unset (guard threw
    // first) or still hold a signer from an earlier attempt.
    let relays = [];

    try {
      console.log('[NIP-46] Connecting with bunker URL...');

      const bunkerPointer = await parseBunkerInput(bunkerUrl);
      if (!bunkerPointer) {
        throw new Error('Invalid bunker URL');
      }
      relays = bunkerPointer.relays || [];

      // Fail fast with a useful message rather than letting connect() die on
      // an unreachable relay (on-device signers advertise 127.0.0.1 here).
      this._assertRelaysReachable(bunkerPointer.relays);

      const secretKey = generateSecretKey();

      this.bunkerSigner = BunkerSigner.fromBunker(
        secretKey,
        bunkerPointer,
        this._buildSignerParams(),
      );

      await this.bunkerSigner.connect();

      this.clientSecretKey = secretKey;
      this.bunkerPointer = bunkerPointer;
      this.connected = true;
      this.connecting = false;

      const pubkey = await this.getPublicKeyWithRetry();
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

      const humanized = this._humanizeRelayFailure(error, relays);
      if (humanized) throw humanized;

      // Already-actionable errors (e.g. the reachability guard) explain
      // themselves; re-wrapping them just buries the advice.
      if (error?.nip46Actionable) throw error;

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
      relays: DEFAULT_RELAYS,
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
      relayUrls: DEFAULT_RELAYS,
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

      this.bunkerSigner = await BunkerSigner.fromURI(
        connectionData.secretKey,
        connectionData.connectionString,
        this._buildSignerParams(),
        maxWait,
      );

      this.clientSecretKey = connectionData.secretKey;
      this.bunkerPointer = this.bunkerSigner.bp;
      this.connected = true;
      this.connecting = false;

      const pubkey = await this.getPublicKeyWithRetry();
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

      const humanized = this._humanizeRelayFailure(
        error,
        connectionData?.relayUrls || [],
      );
      if (humanized) throw humanized;

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

      this.bunkerSigner = BunkerSigner.fromBunker(
        clientSecretKey,
        bunkerPointer,
        this._buildSignerParams(),
      );

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
    this.pendingAuthUrl = null;

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
