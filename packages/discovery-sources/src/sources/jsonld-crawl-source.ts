import type { DiscoveryCursor, DiscoveryFetchResult, DiscoverySourceFetcher, RawCompanyTuple } from '../types.js';
import { fetchPageContent } from '../http/page-fetcher.js';

const USER_AGENT = 'CareerOS-CompanyDiscovery/1.0 (+https://careeros.io/bot)';
const CANDIDATE_PATHS = ['/careers', '/jobs', '/'];
const JSONLD_PATTERN = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

interface JsonLdCursor extends DiscoveryCursor {
  readonly seedIndex: number;
}

function extractJobPostingOrgName(html: string): string | null {
  let match: RegExpExecArray | null;
  JSONLD_PATTERN.lastIndex = 0;
  while ((match = JSONLD_PATTERN.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]!);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item?.['@type'] !== 'JobPosting') continue;
        const org = item.hiringOrganization;
        const name = typeof org === 'string' ? org : org?.name;
        if (name) return name;
      }
    } catch {
      // Skip invalid JSON-LD, same tolerance CompanyDiscoveryService already applies.
    }
  }
  return null;
}

/**
 * ADR-035 §1 priority 3: JSON-LD JobPosting discovery.
 *
 * Live-checked during this pass: Common Crawl's CDX Index Server requires a
 * host-scoped URL pattern (`*.example.com` or `example.com/*`) — a bare,
 * host-agnostic `*\/careers/*` query returns "No Captures found" (confirmed
 * 2026-07-30). Finding JSON-LD JobPosting markup across the open web with
 * no seed at all requires Common Crawl's columnar/Athena index (full-text
 * search over WARC content), a materially heavier AWS-dependent capability
 * out of scope for this pass. This source instead operates over a
 * configurable seed domain list (e.g. hostnames surfaced by
 * SitemapDiscoverySource/RobotsDiscoverySource's crawlMetadata, or a
 * manually curated list) — the same "reuse a seed, don't build a second
 * full-web crawler" shape ADR-035 §1 already applies to the other
 * CC-Index-seeded sources.
 */
export class JsonLdCrawlDiscoverySource implements DiscoverySourceFetcher {
  readonly id = 'jsonld_crawl' as const;
  /** ADR §2 "source authority": a confirmed schema.org JobPosting on the page itself is a stronger per-page signal than a bare sitemap/robots match. */
  readonly defaultAuthorityScore = 45;

  constructor(private readonly seedDomains: readonly string[]) {}

  async fetch(cursor: DiscoveryCursor | null): Promise<DiscoveryFetchResult> {
    const state = (cursor as JsonLdCursor | null) ?? { seedIndex: 0 };
    if (state.seedIndex >= this.seedDomains.length) {
      return { tuples: [], cursor: state, hasMore: false };
    }

    const domain = this.seedDomains[state.seedIndex]!;
    const tuples: RawCompanyTuple[] = [];

    for (const path of CANDIDATE_PATHS) {
      const url = `https://${domain}${path}`;
      const html = await fetchPageContent(url, USER_AGENT);
      if (!html) continue;

      const orgName = extractJobPostingOrgName(html);
      if (!orgName) continue;

      tuples.push({
        name: orgName,
        url,
        sourceAuthorityScore: this.defaultAuthorityScore,
        crawlMetadata: { matchedPath: path, seedDomain: domain },
      });
      break; // one confirmed hit per domain is enough — don't keep probing paths.
    }

    const nextIndex = state.seedIndex + 1;
    return { tuples, cursor: { seedIndex: nextIndex }, hasMore: nextIndex < this.seedDomains.length };
  }
}
