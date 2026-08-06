import type { DiscoveryFetchResult, DiscoverySourceFetcher, RawCompanyTuple, DiscoveryCursor } from '../types.js';
import { fetchNextCcIndexPage } from './cc-index-seeded-page.js';
import { fetchPageContent } from '../http/page-fetcher.js';

const USER_AGENT = 'CareerOS-CompanyDiscovery/1.0 (+https://careeros.io/bot)';
const CAREER_PATH_PATTERN = /\/(careers?|jobs?|positions?|openings?|hiring)(\/|\?|$)/i;
const LOC_PATTERN = /<loc>([^<]+)<\/loc>/gi;

function hostnameToCompanyName(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

/**
 * ADR-035 §1 priority 4: Sitemap discovery. CC-Index-seeded (see
 * cc-index-seeded-page.ts) rather than a standalone crawler — sitemap
 * discovery can't find a brand-new company from nothing, it needs a
 * candidate domain first, and CC-Index's own general index already has
 * millions of sitemap.xml 200-status entries to seed from.
 */
export class SitemapDiscoverySource implements DiscoverySourceFetcher {
  readonly id = 'sitemap_crawl' as const;
  /** ADR §2 "source authority": a generic sitemap match carries no ATS-vendor signal at all — lowest bulk-source tier. */
  readonly defaultAuthorityScore = 25;

  async fetch(cursor: DiscoveryCursor | null): Promise<DiscoveryFetchResult> {
    const page = await fetchNextCcIndexPage(cursor, '*/sitemap.xml');
    const tuples: RawCompanyTuple[] = [];

    for (const record of page.records) {
      const content = await fetchPageContent(record.url, USER_AGENT);
      if (!content) continue;

      const locs = [...content.matchAll(LOC_PATTERN)].map((m) => m[1]!);
      const careerLoc = locs.find((loc) => CAREER_PATH_PATTERN.test(loc));
      if (!careerLoc) continue;

      let hostname: string;
      try {
        hostname = new URL(record.url).hostname;
      } catch {
        continue;
      }

      tuples.push({
        name: hostnameToCompanyName(hostname),
        url: careerLoc,
        sourceAuthorityScore: this.defaultAuthorityScore,
        crawlMetadata: { matchedSitemap: record.url, crawlTimestamp: record.timestamp },
      });
    }

    return { tuples, cursor: page.nextCursor, hasMore: page.hasMore };
  }
}
