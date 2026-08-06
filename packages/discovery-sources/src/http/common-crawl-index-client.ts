import { retryFetch } from './retry-fetch.js';

/**
 * Common Crawl's CDX Index Server (index.commoncrawl.org) — live-verified
 * during ADR-035 Phase 4 implementation. `output=json` returns
 * newline-delimited JSON (NOT a JSON array), one record per matched
 * captured URL. This is the same underlying crawl data ADR-035 §1 scoped
 * as "Common Crawl JobPosting extract", reached without downloading and
 * streaming the multi-GB WARC/N-Quads files the original research
 * (research/free-provider-expansion/EPIC.md Phase 3) assumed were required.
 */
export interface CommonCrawlRecord {
  readonly urlkey: string;
  readonly url: string;
  readonly timestamp: string;
  readonly status: string;
  readonly mime?: string;
  /** Present on 301/302 records — live-verified (2026-07-30) that this is how Common Crawl surfaces e.g. Greenhouse's boards.greenhouse.io -> job-boards.greenhouse.io host migration, which CommonCrawlAtsDiscoverySource uses to prefer the current canonical host over a since-retired one. */
  readonly redirect?: string;
}

export interface CommonCrawlPageResult {
  readonly records: readonly CommonCrawlRecord[];
  readonly page: number;
  readonly totalPages: number;
}

const COLLINFO_URL = 'https://index.commoncrawl.org/collinfo.json';
const USER_AGENT = 'CareerOS-CompanyDiscovery/1.0 (+https://careeros.io/bot)';

interface CollInfoEntry {
  readonly id: string;
  readonly 'cdx-api': string;
}

/** Resolves the most recent crawl's CDX API endpoint — Common Crawl publishes a new index roughly monthly, so this is looked up rather than hardcoded. */
export async function resolveLatestCrawlIndex(): Promise<string> {
  const response = await retryFetch(COLLINFO_URL, { headers: { 'User-Agent': USER_AGENT } });
  const entries = (await response.json()) as CollInfoEntry[];
  const latest = entries[0];
  if (!latest) throw new Error('Common Crawl collinfo.json returned no indexes');
  return latest['cdx-api'];
}

/**
 * Queries one page of a URL pattern against a CDX API endpoint. `page`/`pageSize`
 * map directly onto CC-Index's own blocked-index pagination (matches this
 * package's DiscoveryCursor "opaque page number" convention).
 */
export async function queryCommonCrawlIndex(
  cdxApiUrl: string,
  urlPattern: string,
  page: number,
  pageSize: number = 5
): Promise<CommonCrawlPageResult> {
  const params = new URLSearchParams({
    url: urlPattern,
    output: 'json',
    page: String(page),
    pageSize: String(pageSize),
  });

  const response = await retryFetch(`${cdxApiUrl}?${params.toString()}`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (response.status === 404) {
    // CC-Index returns 404 once `page` exceeds the available block count.
    return { records: [], page, totalPages: page };
  }

  const text = await response.text();
  const records = parseNdjson<CommonCrawlRecord>(text);
  return { records, page, totalPages: page + (records.length > 0 ? 1 : 0) };
}

export function parseNdjson<T>(text: string): T[] {
  const results: T[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      results.push(JSON.parse(trimmed) as T);
    } catch {
      // Skip malformed lines rather than aborting the whole page (ADR §13: one bad record can't stall a batch).
    }
  }
  return results;
}
