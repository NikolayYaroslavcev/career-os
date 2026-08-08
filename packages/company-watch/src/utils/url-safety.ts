import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Known non-company platforms whose URLs sometimes end up in extracted/scraped
 * fields (Telegram channel links, Telegraph/Teletype blog posts) but are never
 * themselves a company's career page — must never become a CompanyCandidate.
 */
const DENIED_DISCOVERY_HOSTNAMES = ['t.me', 'telegram.me', 'telegram.org', 'teletype.in', 'telegra.ph'];

/**
 * Hostname-exact-or-subdomain match against DENIED_DISCOVERY_HOSTNAMES — never
 * a substring/startsWith check, so a lookalike domain like evil-telegram.me or
 * t-me.com is never caught. www. is stripped before comparison so both the
 * bare and www-prefixed form of a denied domain match; a malformed URL fails
 * closed to `false` (not denied) since callers use this purely as a targeted
 * denylist, not general URL validation — assertSafeUrl already owns that.
 */
export function isDeniedDiscoveryHostname(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  const normalized = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  return DENIED_DISCOVERY_HOSTNAMES.some((denied) => normalized === denied || normalized.endsWith(`.${denied}`));
}

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
