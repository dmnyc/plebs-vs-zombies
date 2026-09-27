import { getPublicKey } from "nostr-tools";
import nostrService from "../../services/nostrService.js";

// The one place Lazarus touches the app's signer. Everything else in the
// library is pure, so this is also the seam tests replace.

export function isSignerReady() {
  return !!nostrService.isSigningReady();
}

export function usesRemoteSigner() {
  return nostrService.signingMethod === "nip46";
}

export function sessionPubkey() {
  return nostrService.pubkey || null;
}

// Asks the signer itself rather than returning the key cached at login, so an
// account switched inside the extension shows up here before anything is
// signed. The signed event's own pubkey is still checked afterwards.
export async function getSignerPublicKey() {
  const method = nostrService.signingMethod;
  if (method === "nip07") {
    if (!window.nostr?.getPublicKey) {
      throw new Error("Your browser extension isn't available.");
    }
    return await window.nostr.getPublicKey();
  }
  if (method === "nip46") {
    // Amber can answer a key request with an empty key; this retries it.
    return await nostrService.nip46Service.getPublicKeyWithRetry();
  }
  if (method === "nsec") {
    if (!nostrService.secretKey) throw new Error("No secret key available.");
    return getPublicKey(nostrService.secretKey);
  }
  throw new Error("Your signer isn't connected.");
}

// A JSON round-trip drops Vue's reactive proxies: extensions structured-clone
// the event across postMessage, and a proxy can't be cloned.
export async function signEvent(draft) {
  return await nostrService.signEventWithCurrentMethod(
    JSON.parse(JSON.stringify(draft)),
  );
}

// Whether the signer can decrypt this encryption scheme at all. A NIP-07
// extension may lack NIP-44; a bunker or a local key always has both, though
// a bunker can still refuse the request.
export function canDecrypt(encryption) {
  const method = nostrService.signingMethod;
  if (method === "nip07") {
    return encryption === "nip44"
      ? !!window.nostr?.nip44?.decrypt
      : !!window.nostr?.nip04?.decrypt;
  }
  return method === "nip46" || method === "nsec";
}

export async function decrypt(pubkey, content, encryption) {
  return await nostrService.decryptData(content, pubkey, encryption);
}
