/**
 * Primal Cache Service
 *
 * WebSocket client for Primal's public cache API
 * Provides fast, comprehensive profile search
 *
 * API: wss://cache2.primal.net/v1
 * Format: ["REQ", "id", {cache: ["user_search", {query: "text", limit: 10}]}]
 */

class PrimalCacheService {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.connecting = false;
    this.pendingRequests = new Map(); // requestId -> {resolve, reject, timeout}
    this.messageQueue = []; // Queue messages if not connected
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.cacheEndpoints = [
      'wss://cache2.primal.net/v1',
      'wss://cache1.primal.net/v1'
    ];
    this.currentEndpointIndex = 0;
  }

  /**
   * Connect to Primal cache WebSocket
   * @returns {Promise<boolean>} - True if connected successfully
   */
  async connect() {
    if (this.connected) {
      return true;
    }

    if (this.connecting) {
      // Wait for existing connection attempt
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.connected || !this.connecting) {
            clearInterval(checkInterval);
            resolve(this.connected);
          }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, 5000);
      });
    }

    this.connecting = true;

    try {
      const endpoint = this.cacheEndpoints[this.currentEndpointIndex];
      console.log(`🔌 Connecting to Primal cache: ${endpoint}`);

      return await new Promise((resolve, reject) => {
        this.ws = new WebSocket(endpoint);

        const connectionTimeout = setTimeout(() => {
          if (!this.connected) {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 5000);

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          this.connected = true;
          this.connecting = false;
          this.reconnectAttempts = 0;
          console.log('✅ Connected to Primal cache');

          // Process queued messages
          this.processMessageQueue();

          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('❌ Primal cache WebSocket error:', error);
          this.connected = false;
          this.connecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('🔌 Primal cache connection closed');
          this.connected = false;
          this.connecting = false;

          // Clear pending requests with error
          this.pendingRequests.forEach(({ reject }) => {
            reject(new Error('Connection closed'));
          });
          this.pendingRequests.clear();

          // Try to reconnect if not intentional
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

            // Try next endpoint
            this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.cacheEndpoints.length;

            setTimeout(() => {
              this.connect().catch(console.error);
            }, 1000 * this.reconnectAttempts);
          }
        };
      });
    } catch (error) {
      console.error('Failed to connect to Primal cache:', error);
      this.connected = false;
      this.connecting = false;
      return false;
    }
  }

  /**
   * Handle incoming WebSocket message
   * @param {string} data - Raw message data
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);

      if (!Array.isArray(message) || message.length < 2) {
        return;
      }

      const [type, requestId, payload] = message;

      // Handle EVENT responses
      if (type === 'EVENT' && this.pendingRequests.has(requestId)) {
        const request = this.pendingRequests.get(requestId);

        // Collect profile events (kind 0)
        if (payload && payload.kind === 0) {
          request.results.push(payload);
        }
      }

      // Handle EOSE (End Of Stored Events) - query complete
      if (type === 'EOSE' && this.pendingRequests.has(requestId)) {
        const request = this.pendingRequests.get(requestId);
        clearTimeout(request.timeout);
        request.resolve(request.results);
        this.pendingRequests.delete(requestId);
      }

      // Handle NOTICE errors
      if (type === 'NOTICE' && this.pendingRequests.has(requestId)) {
        const request = this.pendingRequests.get(requestId);
        console.warn('Primal cache notice:', payload);
        clearTimeout(request.timeout);
        request.reject(new Error(`Primal cache error: ${payload}`));
        this.pendingRequests.delete(requestId);
      }
    } catch (error) {
      console.error('Failed to parse Primal cache message:', error);
    }
  }

  /**
   * Process queued messages after connection
   */
  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.connected) {
      const message = this.messageQueue.shift();
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send message to Primal cache
   * @param {Array} message - Message to send
   */
  send(message) {
    if (!this.connected) {
      this.messageQueue.push(message);
      this.connect().catch(console.error);
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Generate unique request ID
   * @returns {string}
   */
  generateRequestId() {
    return `primal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Search for profiles by query
   * @param {string} query - Search query
   * @param {number} limit - Maximum results (default 10)
   * @returns {Promise<Array>} - Array of profile objects
   */
  async searchUsers(query, limit = 10) {
    if (!query || query.length < 2) {
      return [];
    }

    // Ensure connected
    const connected = await this.connect();
    if (!connected) {
      throw new Error('Failed to connect to Primal cache');
    }

    const requestId = this.generateRequestId();

    return new Promise((resolve, reject) => {
      // Set timeout for request (5 seconds)
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Search timeout'));
      }, 5000);

      // Store request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout,
        results: []
      });

      // Send search request
      const searchQuery = [
        "REQ",
        requestId,
        {
          cache: [
            "user_search",
            {
              query,
              limit
            }
          ]
        }
      ];

      this.send(searchQuery);
    });
  }

  /**
   * Parse profile event into profile object
   * @param {Object} event - Nostr event (kind 0)
   * @returns {Object|null} - Parsed profile or null
   */
  parseProfileEvent(event) {
    try {
      const content = JSON.parse(event.content);

      return {
        pubkey: event.pubkey,
        name: content.name || null,
        display_name: content.display_name || null,
        picture: content.picture || null,
        nip05: content.nip05 || null,
        about: content.about || null,
        banner: content.banner || null,
        lud16: content.lud16 || null,
        website: content.website || null
      };
    } catch (error) {
      console.error('Failed to parse profile event:', error);
      return null;
    }
  }

  /**
   * Close connection
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.connecting = false;
    this.pendingRequests.clear();
    this.messageQueue = [];
  }
}

// Export singleton instance
export default new PrimalCacheService();
