/**
 * ADR-035 Phase 4: bulk DiscoverySource ingestion queue — mirrors
 * company-watch.ts's scheduler/sync-job split (one queue sweeps due
 * sources on a fixed interval and enqueues one run-job per source; a
 * separate queue/consumer actually executes that source's fetch+intake).
 */
export const DISCOVERY_SOURCE_SCHEDULER_QUEUE_NAME = 'discovery-source-scheduler';
export const DISCOVERY_SOURCE_SCHEDULER_JOB_NAME = 'sweep-due-discovery-sources';
/** Bulk sources run far less often than CompanyWatch syncs — hourly sweep is enough to catch each source's own (much longer) cadence. */
export const DISCOVERY_SOURCE_SCHEDULER_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export const DISCOVERY_SOURCE_RUN_QUEUE = 'discovery-source-run';
export const DISCOVERY_SOURCE_RUN_JOB = 'discovery-source-run';

/** Wire contract between the scheduler sweep and the DISCOVERY_SOURCE_RUN_QUEUE consumer (both apps/worker) — kept here so producer and consumer can't drift. */
export interface DiscoverySourceRunJob {
  readonly sourceId: string;
}

/** ADR §1: each DiscoverySource has its own cadence — a source not due yet is skipped by the sweep even though the sweep itself runs hourly. */
export const DISCOVERY_SOURCE_DEFAULT_INTERVALS_MS: Record<string, number> = {
  common_crawl_ats: 30 * 24 * 60 * 60 * 1000, // Common Crawl publishes a new index roughly monthly
  web_data_commons_jobposting: 90 * 24 * 60 * 60 * 1000, // quarterly per ADR §14/§15
  jsonld_crawl: 7 * 24 * 60 * 60 * 1000,
  sitemap_crawl: 7 * 24 * 60 * 60 * 1000,
  robots_crawl: 7 * 24 * 60 * 60 * 1000,
  rss_career_feed: 7 * 24 * 60 * 60 * 1000,
  github_orgs: 7 * 24 * 60 * 60 * 1000,
  cncf_landscape: 30 * 24 * 60 * 60 * 1000,
};
