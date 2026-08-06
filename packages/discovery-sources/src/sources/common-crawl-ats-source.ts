import type { DiscoveryCursor, DiscoveryFetchResult, DiscoverySourceFetcher, RawCompanyTuple } from '../types.js';
import { queryCommonCrawlIndex, resolveLatestCrawlIndex, type CommonCrawlRecord } from '../http/common-crawl-index-client.js';

/**
 * ADR-035 §1 priority 1: Common Crawl. Live-verified pattern (2026-07-30):
 * `boards.greenhouse.io/*` and `jobs.lever.co/*` both return real, current
 * matches via the CDX Index API, each URL carrying an extractable company
 * slug (e.g. `boards.greenhouse.io/{slug}/jobs/...`). Scans known ATS-vendor
 * host patterns rather than the general web — the highest-precision slice
 * of "companies discoverable via crawl data" (ADR §2's ATS-type-certainty
 * category scores these STRUCTURED_MATCH once fingerprinted, since the host
 * itself already identifies the ATS).
 */
const ATS_HOST_PATTERNS: ReadonlyArray<{ pattern: string; atsHost: string; buildCareerUrl: (slug: string) => string }> = [
  { pattern: 'boards.greenhouse.io/*', atsHost: 'greenhouse', buildCareerUrl: (slug) => `https://boards.greenhouse.io/${slug}` },
  { pattern: 'jobs.lever.co/*', atsHost: 'lever', buildCareerUrl: (slug) => `https://jobs.lever.co/${slug}` },
  { pattern: 'jobs.ashbyhq.com/*', atsHost: 'ashby', buildCareerUrl: (slug) => `https://jobs.ashbyhq.com/${slug}` },
  { pattern: 'jobs.smartrecruiters.com/*', atsHost: 'smartrecruiters', buildCareerUrl: (slug) => `https://jobs.smartrecruiters.com/${slug}` },
  { pattern: '*.recruitee.com/*', atsHost: 'recruitee', buildCareerUrl: (slug) => `https://${slug}.recruitee.com` },
];

/** Excludes non-company path segments Common Crawl also indexes at these hosts (robots.txt, sitemap.xml, static assets). */
const NON_COMPANY_SLUGS = new Set(['robots.txt', 'sitemap.xml', 'favicon.ico', 'static', 'assets', 'api']);

interface CommonCrawlCursor extends DiscoveryCursor {
  readonly patternIndex: number;
  readonly page: number;
  readonly cdxApiUrl: string;
}

function extractSlug(url: string, pattern: { atsHost: string }): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const slug = pattern.atsHost === 'recruitee' ? parsed.hostname.split('.')[0] : segments[0];
    if (!slug || NON_COMPANY_SLUGS.has(slug.toLowerCase())) return null;
    return slug;
  } catch {
    return null;
  }
}

/**
 * Live-verified (2026-07-30): Greenhouse's legacy `boards.greenhouse.io`
 * host now 301-redirects to `job-boards.greenhouse.io` for at least some
 * tenants, and Common Crawl's CDX record for that capture carries the
 * redirect target — using it instead of the (possibly retired)
 * pattern-derived URL keeps candidates pointed at the live host, which
 * matters for the confidence rubric's reachability/job-signal categories
 * (ADR §2), not just cosmetics.
 */
function resolveCareerUrl(record: CommonCrawlRecord, pattern: { atsHost: string; buildCareerUrl: (slug: string) => string }, slug: string): string {
  if (!record.redirect) return pattern.buildCareerUrl(slug);
  try {
    const redirectUrl = new URL(record.redirect);
    const redirectSlug = extractSlug(record.redirect, pattern);
    if (redirectSlug) return `${redirectUrl.origin}/${redirectSlug}`;
  } catch {
    // Malformed redirect target — fall back to the pattern-derived URL below.
  }
  return pattern.buildCareerUrl(slug);
}

export class CommonCrawlAtsDiscoverySource implements DiscoverySourceFetcher {
  readonly id = 'common_crawl_ats' as const;
  /** ADR §2 "source authority": a bare crawl hit on a known ATS host — lower than a curated list (YC/CNCF/GitHub), higher than nothing. */
  readonly defaultAuthorityScore = 40;

  async fetch(cursor: DiscoveryCursor | null): Promise<DiscoveryFetchResult> {
    const state = (cursor as CommonCrawlCursor | null) ?? {
      patternIndex: 0,
      page: 0,
      cdxApiUrl: await resolveLatestCrawlIndex(),
    };

    if (state.patternIndex >= ATS_HOST_PATTERNS.length) {
      return { tuples: [], cursor: state, hasMore: false };
    }

    const pattern = ATS_HOST_PATTERNS[state.patternIndex]!;
    const result = await queryCommonCrawlIndex(state.cdxApiUrl, pattern.pattern, state.page);

    const seen = new Set<string>();
    const tuples: RawCompanyTuple[] = [];
    for (const record of result.records) {
      if (record.status !== '200' && record.status !== '301' && record.status !== '302') continue;
      const slug = extractSlug(record.url, pattern);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      tuples.push({
        name: slug,
        url: resolveCareerUrl(record, pattern, slug),
        sourceAuthorityScore: this.defaultAuthorityScore,
        crawlMetadata: { atsHost: pattern.atsHost, crawlTimestamp: record.timestamp, matchedUrl: record.url, redirectedTo: record.redirect },
      });
    }

    const exhaustedPattern = result.records.length === 0;
    const nextCursor: CommonCrawlCursor = exhaustedPattern
      ? { patternIndex: state.patternIndex + 1, page: 0, cdxApiUrl: state.cdxApiUrl }
      : { patternIndex: state.patternIndex, page: state.page + 1, cdxApiUrl: state.cdxApiUrl };

    return {
      tuples,
      cursor: nextCursor,
      hasMore: nextCursor.patternIndex < ATS_HOST_PATTERNS.length,
    };
  }
}
