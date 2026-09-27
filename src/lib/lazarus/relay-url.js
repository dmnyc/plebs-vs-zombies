// Relay URLs compare normalized (spec 0.6.2, the delta rule): scheme and host
// lowercased, a default port dropped, repeated slashes in the path collapsed
// to one, and a trailing slash dropped, so a client that rewrote
// `wss://Relay.Example/` as `wss://relay.example` changed nothing. The path
// keeps its case. Anything that isn't a ws:// or wss:// URL is null.
export function normalizeLazarusRelayUrl(url) {
  const match = /^(wss?):\/\/([^/?#]+)([^?#]*)(.*)$/i.exec(
    typeof url === "string" ? url.trim() : "",
  );
  if (!match) return null;
  const [, scheme, authority, path, rest] = match;
  const lowerScheme = scheme.toLowerCase();
  const defaultPort = lowerScheme === "wss" ? ":443" : ":80";
  let host = authority.toLowerCase();
  if (host.endsWith(defaultPort)) host = host.slice(0, -defaultPort.length);
  const cleanPath = path.replace(/\/{2,}/g, "/").replace(/\/$/, "");
  return `${lowerScheme}://${host}${cleanPath}${rest}`;
}
