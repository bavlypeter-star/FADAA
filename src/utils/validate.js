const protocolSet = new Set(['http', 'https', 'tcp', 'udp']);

export function validateTunnelInput(body) {
  const { name, protocol, localHost, localPort } = body;

  if (!name || typeof name !== 'string' || name.length > 120) {
    return 'Name is required and must be <= 120 chars';
  }

  if (!protocolSet.has(protocol)) {
    return 'Protocol must be one of http/https/tcp/udp';
  }

  if (!localHost || typeof localHost !== 'string' || localHost.length > 255) {
    return 'Local host is invalid';
  }

  const port = Number(localPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return 'Local port must be a valid TCP/UDP port';
  }

  return null;
}

export function safePathJoin(base, candidate) {
  const resolved = new URL(candidate, 'file://').pathname;
  return resolved;
}
