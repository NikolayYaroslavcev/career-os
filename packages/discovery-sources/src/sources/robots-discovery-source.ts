import type { DiscoveryFetchResult, DiscoverySourceFetcher, RawCompanyTuple, DiscoveryCursor } from '../types.js';
import { fetchNextCcIndexPage } from './cc-index-seeded-page.js';
import { fetchPageContent } from '../http/page-fetcher.js';

const USER_AGENT = 'CareerOS-CompanyDiscovery/1.0 (+https://careeros.io/bot)';
const SITEMAP_DIRECTIVE_PATTERN = /^sitemap:\s*(\S+)/i;
const CAREER_PATH_PATTERN = /(careers?|jobs?|positions?|openings?|hiring)/i;

function hostnameToCompanyName(hostname: string): string {
  return hostname.replace(/^www\./, '');
}

/**
 * ADR-035 §1 priority 5: Robots.txt discovery. Many sites' robots.txt
 * `Sitemap:` directive points directly at a jobs-specific sitemap (a
 * cheaper, one-fetch signal than parsing the general sitemap for career
 * paths, see SitemapDiscoverySource) — this source looks for exactly that,
 * CC-Index-seeded the same way (see cc-index-seeded-page.ts).
 */
export class RobotsDiscoverySource implements DiscoverySourceFetcher {
  readonly id = 'robots_crawl' as const;
  readonly defaultAuthorityScore = 25;

  async fetch(cursor: DiscoveryCursor | null): Promise<DiscoveryFetchResult> {
    const page = await fetchNextCcIndexPage(cursor, '*/robots.txt');
    const tuples: RawCompanyTuple[] = [];

    for (const record of page.records) {
      const content = await fetchPageContent(record.url, USER_AGENT);
      if (!content) continue;

      const jobSitemapUrl = content
        .split('\n')
        .map((line) => SITEMAP_DIRECTIVE_PATTERN.exec(line.trim())?.[1])
        .find((url): url is string => !!url && CAREER_PATH_PATTERN.test(url));

      if (!jobSitemapUrl) continue;

      let hostname: string;
      try {
        hostname = new URL(record.url).hostname;
      } catch {
        continue;
      }

      tuples.push({
        name: hostnameToCompanyName(hostname),
        url: jobSitemapUrl,
        sourceAuthorityScore: this.defaultAuthorityScore,
        crawlMetadata: { matchedRobotsTxt: record.url, crawlTimestamp: record.timestamp },
      });
    }

    return { tuples, cursor: page.nextCursor, hasMore: page.hasMore };
  }
}
