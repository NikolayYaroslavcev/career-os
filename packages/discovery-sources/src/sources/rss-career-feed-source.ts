import type { DiscoveryCursor, DiscoveryFetchResult, DiscoverySourceFetcher, RawCompanyTuple } from '../types.js';
import { fetchPageContent } from '../http/page-fetcher.js';

const USER_AGENT = 'CareerOS-CompanyDiscovery/1.0 (+https://careeros.io/bot)';
const CANDIDATE_FEED_PATHS = ['/careers/feed', '/careers.rss', '/jobs/feed', '/jobs.rss', '/careers/rss.xml'];
const ITEM_PATTERN = /<item>[\s\S]*?<\/item>/gi;
const TITLE_PATTERN = /<title>([^<]*)<\/title>/i;

interface RssCursor extends DiscoveryCursor {
  readonly seedIndex: number;
}

/**
 * ADR-035 §1 priority 6: RSS career feeds. Same CC-Index host-scoping
 * constraint as JSON-LD discovery (confirmed live, see jsonld-crawl-source.ts)
 * applies here too — a feed can't be found host-agnostically without
 * Common Crawl's heavier full-text index. Operates over a configurable
 * seed domain list, probing the handful of RSS/Atom paths companies
 * conventionally expose for career feeds, and validates the result is
 * actually job-shaped (has <item> entries with titles) rather than trusting
 * a 200 status alone.
 */
export class RssCareerFeedDiscoverySource implements DiscoverySourceFetcher {
  readonly id = 'rss_career_feed' as const;
  readonly defaultAuthorityScore = 40;

  constructor(private readonly seedDomains: readonly string[]) {}

  async fetch(cursor: DiscoveryCursor | null): Promise<DiscoveryFetchResult> {
    const state = (cursor as RssCursor | null) ?? { seedIndex: 0 };
    if (state.seedIndex >= this.seedDomains.length) {
      return { tuples: [], cursor: state, hasMore: false };
    }

    const domain = this.seedDomains[state.seedIndex]!;
    const tuples: RawCompanyTuple[] = [];

    for (const path of CANDIDATE_FEED_PATHS) {
      const url = `https://${domain}${path}`;
      const content = await fetchPageContent(url, USER_AGENT);
      if (!content) continue;

      const items = content.match(ITEM_PATTERN) ?? [];
      if (items.length === 0) continue;

      const channelTitle = TITLE_PATTERN.exec(content)?.[1]?.trim();

      tuples.push({
        name: channelTitle || domain,
        url,
        sourceAuthorityScore: this.defaultAuthorityScore,
        crawlMetadata: { matchedFeedPath: path, seedDomain: domain, itemCount: items.length },
      });
      break; // one confirmed feed per domain is enough.
    }

    const nextIndex = state.seedIndex + 1;
    return { tuples, cursor: { seedIndex: nextIndex }, hasMore: nextIndex < this.seedDomains.length };
  }
}
