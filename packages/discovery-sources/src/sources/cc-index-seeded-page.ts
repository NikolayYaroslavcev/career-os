import type { DiscoveryCursor } from '../types.js';
import { queryCommonCrawlIndex, resolveLatestCrawlIndex, type CommonCrawlRecord } from '../http/common-crawl-index-client.js';

/** Shared cursor/pagination shape for every CC-Index-seeded source (sitemap/robots/JSON-LD/RSS) — each differs only in urlPattern and how it parses the matched page's content. */
export interface CcIndexSeededCursor extends DiscoveryCursor {
  readonly page: number;
  readonly cdxApiUrl: string;
}

export interface CcIndexSeededPage {
  readonly records: readonly CommonCrawlRecord[];
  readonly nextCursor: CcIndexSeededCursor;
  readonly hasMore: boolean;
}

const MAX_PAGES_PER_SOURCE = 20;

export async function fetchNextCcIndexPage(
  cursor: DiscoveryCursor | null,
  urlPattern: string
): Promise<CcIndexSeededPage> {
  const state = (cursor as CcIndexSeededCursor | null) ?? {
    page: 0,
    cdxApiUrl: await resolveLatestCrawlIndex(),
  };

  const result = await queryCommonCrawlIndex(state.cdxApiUrl, urlPattern, state.page);
  const okRecords = result.records.filter((r) => r.status === '200');

  const nextPage = state.page + 1;
  const hasMore = okRecords.length > 0 && nextPage < MAX_PAGES_PER_SOURCE;

  return {
    records: okRecords,
    nextCursor: { page: nextPage, cdxApiUrl: state.cdxApiUrl },
    hasMore,
  };
}
