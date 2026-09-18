import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nip46Service from '../src/services/nip46Service.js';

// The service reads window.location to decide whether a relay is reachable
// from the current page. Tests run in vitest's default node environment, so
// stand up a minimal window rather than pulling in jsdom.
const realWindow = globalThis.window;

function setPage(protocol, hostname) {
  globalThis.window = {
    location: { protocol, hostname, origin: `${protocol}//${hostname}` },
    open: () => {},
  };
}

// Relay URLs Aegis actually advertises in its bunker:// URL.
const AEGIS_WS = 'ws://127.0.0.1:8081';
const AEGIS_WSS = 'wss://127.0.0.1:28443';
const PUBLIC_RELAY = 'wss://relay.damus.io';

afterEach(() => {
  globalThis.window = realWindow;
});

describe('_relayUnreachableReason', () => {
  it('rejects an insecure ws:// relay from an https page as mixed content', () => {
    setPage('https:', 'plebsvszombies.cc');
    const reason = nip46Service._relayUnreachableReason(AEGIS_WS);
    expect(reason).toMatch(/mixed content/);
  });

  it("rejects a loopback wss:// relay as being on the signer's own device", () => {
    setPage('https:', 'plebsvszombies.cc');
    const reason = nip46Service._relayUnreachableReason(AEGIS_WSS);
    expect(reason).toMatch(/signer's own device/);
  });

  it('accepts a public wss:// relay', () => {
    setPage('https:', 'plebsvszombies.cc');
    expect(nip46Service._relayUnreachableReason(PUBLIC_RELAY)).toBeNull();
  });

  it('allows a loopback ws:// relay when the page itself is on localhost', () => {
    setPage('http:', 'localhost');
    expect(nip46Service._relayUnreachableReason(AEGIS_WS)).toBeNull();
  });

  it('reports a malformed relay URL', () => {
    setPage('https:', 'plebsvszombies.cc');
    expect(nip46Service._relayUnreachableReason('not a url')).toMatch(
      /not a valid relay URL/,
    );
  });
});

describe('_assertRelaysReachable', () => {
  beforeEach(() => setPage('https:', 'plebsvszombies.cc'));

  it("throws actionable advice for Aegis' on-device relay", () => {
    let caught;
    try {
      nip46Service._assertRelaysReachable([AEGIS_WS]);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeDefined();
    expect(caught.nip46Actionable).toBe(true);
    // Must name the working alternative, not just state the failure.
    expect(caught.message).toMatch(/QR code/);
    expect(caught.message).toContain(AEGIS_WS);
  });

  it('throws when every advertised relay is unreachable', () => {
    expect(() =>
      nip46Service._assertRelaysReachable([AEGIS_WS, AEGIS_WSS]),
    ).toThrow(/can't reach/);
  });

  it('passes when at least one relay is reachable', () => {
    expect(() =>
      nip46Service._assertRelaysReachable([AEGIS_WS, PUBLIC_RELAY]),
    ).not.toThrow();
  });

  it('passes for an all-public relay list', () => {
    expect(() =>
      nip46Service._assertRelaysReachable([PUBLIC_RELAY, 'wss://nos.lol']),
    ).not.toThrow();
  });

  // parseBunkerInput yields relays: [] for a bunker URL with no ?relay= param.
  it('explains a bunker URL that specifies no relay at all', () => {
    expect(() => nip46Service._assertRelaysReachable([])).toThrow(
      /does not specify a relay/,
    );
  });
});

describe('_humanizeRelayFailure', () => {
  beforeEach(() => setPage('https:', 'plebsvszombies.cc'));

  // This is the exact error nostr-tools surfaces when Promise.any() over
  // pool.publish() finds every relay rejecting.
  it('translates an AggregateError into a readable message naming the relays', () => {
    const aggregate = new AggregateError([], 'All promises were rejected');
    const humanized = nip46Service._humanizeRelayFailure(aggregate, [AEGIS_WS]);

    expect(humanized).toBeInstanceOf(Error);
    expect(humanized.nip46Actionable).toBe(true);
    expect(humanized.message).toContain(AEGIS_WS);
    expect(humanized.message).not.toMatch(/All promises were rejected/);
  });

  it('matches on message text even when the error is not an AggregateError', () => {
    const plain = new Error('All promises were rejected');
    expect(nip46Service._humanizeRelayFailure(plain, [])).toBeInstanceOf(Error);
  });

  it('uses singular/plural to match the relay count', () => {
    const aggregate = new AggregateError([], 'All promises were rejected');
    expect(
      nip46Service._humanizeRelayFailure(aggregate, [AEGIS_WS]).message,
    ).toMatch(/signer's relay \(/);
    expect(
      nip46Service._humanizeRelayFailure(aggregate, [AEGIS_WS, PUBLIC_RELAY])
        .message,
    ).toMatch(/signer's relays \(/);
  });

  it('leaves unrelated errors alone so their real message survives', () => {
    expect(
      nip46Service._humanizeRelayFailure(new Error('user rejected'), []),
    ).toBeNull();
  });
});

describe('auth_url handling', () => {
  beforeEach(() => {
    setPage('https:', 'plebsvszombies.cc');
    nip46Service.onAuthUrl = null;
    nip46Service.pendingAuthUrl = null;
  });

  afterEach(() => {
    nip46Service.onAuthUrl = null;
    nip46Service.pendingAuthUrl = null;
  });

  // Without an onauth callback nostr-tools only console.warns, leaving the
  // request pending until it times out.
  it('supplies an onauth callback to BunkerSigner', () => {
    const params = nip46Service._buildSignerParams();
    expect(typeof params.onauth).toBe('function');
  });

  it('prefers a registered UI hook over opening a popup', () => {
    const seen = [];
    nip46Service.onAuthUrl = (url) => seen.push(url);

    nip46Service._buildSignerParams().onauth('https://signer.example/approve');

    expect(seen).toEqual(['https://signer.example/approve']);
    expect(nip46Service.pendingAuthUrl).toBe('https://signer.example/approve');
  });

  it('records the URL for the UI even when no hook is registered', () => {
    let opened = null;
    globalThis.window.open = (url) => {
      opened = url;
    };

    nip46Service._handleAuthUrl('https://signer.example/approve');

    expect(opened).toBe('https://signer.example/approve');
    expect(nip46Service.pendingAuthUrl).toBe('https://signer.example/approve');
  });

  it('still records the URL if the popup is blocked', () => {
    globalThis.window.open = () => {
      throw new Error('blocked by popup blocker');
    };

    expect(() =>
      nip46Service._handleAuthUrl('https://signer.example/approve'),
    ).not.toThrow();
    expect(nip46Service.pendingAuthUrl).toBe('https://signer.example/approve');
  });
});
