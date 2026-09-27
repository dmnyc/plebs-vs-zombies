// NIP-46 requests travel NIP-44 encrypted, which caps a request's plaintext.
export const NIP46_MAX_REQUEST_BYTES = 65535;

export function getNip46RequestBytes(method, params) {
  return new TextEncoder().encode(
    JSON.stringify({ id: "0".repeat(64), method, params }),
  ).length;
}

export function fitsNip46Request(method, params) {
  return getNip46RequestBytes(method, params) <= NIP46_MAX_REQUEST_BYTES;
}
