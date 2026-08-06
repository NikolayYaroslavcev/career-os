import type { DiscoveryCursor, DiscoveryFetchResult, DiscoverySourceFetcher, RawCompanyTuple } from '../types.js';
import { retryFetch } from '../http/retry-fetch.js';
import { parseNdjson } from '../http/common-crawl-index-client.js';

/**
 * ADR-035 §1 priority 2: Web Data Commons schema.org JobPosting extract.
 *
 * STATUS (per EPIC-18 "Phase 4 implementation notes"): structurally
 * complete, NOT live-verified. WDC's Schema.org Table Corpus ships as
 * multi-GB-per-crawl files gated behind their download portal — this pass
 * could not locate a directly fetchable subset URL to test against within
 * scope, so this fetcher is disabled by default (see DiscoverySource seed
 * config) pending a human providing the actual file URL.
 *
 * Input format assumption (documented, not live-verified): WDC's per-page
 * grouping tool emits one JSON record per line — `{ url, entities: [{
 * '@type', name, hiringOrganization, ... }] }` — the same per-page grouping
 * shape their own toolkit produces after flattening raw N-Quads. If the
 * actual provisioned file uses raw N-Quads instead, this parser's input
 * stage (parseWdcLine) is the only piece that needs to change — the rest
 * of the pipeline (JobPosting filtering, hiringOrganization extraction,
 * tuple emission) is format-agnostic.
 */
export interface WdcJobPostingEntity {
  readonly '@type'?: string;
  readonly name?: string;
  readonly hiringOrganization?: { readonly name?: string } | string;
  readonly url?: string;
}

export interface WdcPageRecord {
  readonly url: string;
  readonly entities: readonly WdcJobPostingEntity[];
}

interface WdcCursor extends DiscoveryCursor {
  readonly byteOffset: number;
}

function organizationName(entity: WdcJobPostingEntity): string | null {
  if (!entity.hiringOrganization) return null;
  if (typeof entity.hiringOrganization === 'string') return entity.hiringOrganization;
  return entity.hiringOrganization.name ?? null;
}

export class WebDataCommonsJobPostingSource implements DiscoverySourceFetcher {
  readonly id = 'web_data_commons_jobposting' as const;
  /** ADR §2 "source authority": a bulk structured-data extract, not a hand-curated list — same tier as the general Common Crawl scan. */
  readonly defaultAuthorityScore = 35;

  /** Chunk size per run — WDC files are large; this bounds one job's memory/time, next run resumes from byteOffset (ADR §13 incremental watermark). */
  constructor(
    private readonly sourceFileUrl: string,
    private readonly chunkBytes: number = 5 * 1024 * 1024
  ) {}

  async fetch(cursor: DiscoveryCursor | null): Promise<DiscoveryFetchResult> {
    const state = (cursor as WdcCursor | null) ?? { byteOffset: 0 };

    const response = await retryFetch(this.sourceFileUrl, {
      headers: { Range: `bytes=${state.byteOffset}-${state.byteOffset + this.chunkBytes - 1}` },
    });

    if (response.status === 416 || response.status === 404) {
      return { tuples: [], cursor: state, hasMore: false };
    }

    const text = await response.text();
    if (text.length === 0) {
      return { tuples: [], cursor: state, hasMore: false };
    }

    const records = parseNdjson<WdcPageRecord>(text);
    const tuples: RawCompanyTuple[] = [];

    for (const record of records) {
      for (const entity of record.entities ?? []) {
        if (entity['@type'] !== 'JobPosting') continue;
        const orgName = organizationName(entity);
        if (!orgName) continue;
        tuples.push({
          name: orgName,
          url: entity.url ?? record.url,
          sourceAuthorityScore: this.defaultAuthorityScore,
          crawlMetadata: { wdcSourcePage: record.url, jobTitle: entity.name },
        });
      }
    }

    const nextOffset = state.byteOffset + text.length;
    const hasMore = response.status === 206;

    return { tuples, cursor: { byteOffset: nextOffset }, hasMore };
  }
}
