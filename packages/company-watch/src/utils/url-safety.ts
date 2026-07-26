import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class UnsafeUrlError extends Error {
  constructor(url: string, reason: string) {
    super(`Refusing to fetch '${url}': ${reason}`);
    this.name = 'UnsafeUrlError';
  }
}

/**
 * Blocks SSRF: only https URLs to public hosts are allowed. Resolves the
 * hostname and checks every returned address (not just the first) so a
 * DNS-rebinding attacker who points a public-looking hostname at a private
 * IP after the fact is still caught.
 */
export async function assertSafeUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeUrlError(url, 'not a valid URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new UnsafeUrlError(url, `protocol '${parsed.protocol}' is not allowed, only https:`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new UnsafeUrlError(url, 'localhost is not allowed');
  }

  if (isIP(hostname)) {
    if (isUnsafeAddress(hostname)) {
      throw new UnsafeUrlError(url, `resolves to a disallowed address (${hostname})`);
    }
    return;
  }

  let addresses: readonly { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError(url, `hostname '${hostname}' could not be resolved`);
  }

  for (const { address } of addresses) {
    if (isUnsafeAddress(address)) {
      throw new UnsafeUrlError(url, `resolves to a disallowed address (${address})`);
    }
  }
}

function isUnsafeAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isUnsafeIpv4(address);
  if (family === 6) return isUnsafeIpv6(address);
  return true; // unrecognized shape — fail closed
}

function isUnsafeIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts as [number, number, number, number];

  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254 cloud metadata
  if (a === 0) return true; // "this network"
  return false;
}

function isUnsafeIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1') return true; // loopback
  if (normalized.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 — check the embedded IPv4 address.
    const mapped = normalized.slice('::ffff:'.length);
    if (isIP(mapped) === 4) return isUnsafeIpv4(mapped);
  }
  if (normalized.startsWith('fe80:') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true; // link-local, fe80::/10
  }
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true; // unique local, fc00::/7
  }
  return false;
}
