/**
 * ADR-035 §1: bulk sources emit raw tuples, not CompanyCandidate rows
 * directly — intake/fingerprinting stays a separate step (owned by
 * @careeros/company-watch's CompanyDiscoveryIntakeService) so a slow bulk
 * parse never blocks per-candidate HTTP probing.
 */
export interface RawCompanyTuple {
  readonly name: string;
  /** Best-known URL to fingerprint — a career page, an ATS board URL, or the bare homepage. */
  readonly url: string;
  /** Per ADR §2 "source authority" category — set once per DiscoverySource, not per tuple. */
  readonly sourceAuthorityScore: number;
  /** Preserved onto the resulting CompanyCandidate.metadata (ADR-035 "Metadata" requirement). */
  readonly crawlMetadata?: Record<string, unknown>;
}

export const DISCOVERY_SOURCE_IDS = [
  'common_crawl_ats',
  'web_data_commons_jobposting',
  'jsonld_crawl',
  'sitemap_crawl',
  'robots_crawl',
  'rss_career_feed',
  'github_orgs',
  'cncf_landscape',
] as const;

export type DiscoverySourceId = (typeof DISCOVERY_SOURCE_IDS)[number];

/** Mirrors packages/providers' SyncCursor shape/discipline (ADR §13) without importing it directly — this cursor is opaque to the orchestrator, only meaningful to the fetcher that produced it. */
export interface DiscoveryCursor {
  readonly [key: string]: unknown;
}

export interface DiscoveryFetchResult {
  readonly tuples: readonly RawCompanyTuple[];
  readonly cursor: DiscoveryCursor;
  /** false once the source has no more incremental work for this cursor (ADR §13: don't advance the watermark past what was actually processed). */
  readonly hasMore: boolean;
}

/**
 * One fetcher per DiscoverySource (ADR §1: "each source is a scheduled BullMQ
 * job... own cadence, own queue"). Implementations must be idempotent re-scans
 * — a failed/partial run simply doesn't advance the cursor (ADR §13).
 */
export interface DiscoverySourceFetcher {
  readonly id: DiscoverySourceId;
  /** ADR §2 "source authority": which curated/bulk source found the candidate. */
  readonly defaultAuthorityScore: number;
  fetch(cursor: DiscoveryCursor | null): Promise<DiscoveryFetchResult>;
}
