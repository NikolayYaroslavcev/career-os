import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { LinkedInFetcher } from './linkedin-fetcher.js';
import { LinkedInMapper } from './linkedin-mapper.js';
import { LinkedInNormalizer } from './linkedin-normalizer.js';
import { LinkedInSyncStrategy } from './linkedin-sync-strategy.js';

export const LINKEDIN_PROVIDER_INFO: ProviderInfo = {
  id: 'linkedin',
  name: 'LinkedIn',
  version: '1.0.0',
  supportedCountries: ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'IN', 'NL', 'SE', 'SG', 'JP', 'BR', 'MX'],
  supportedLanguages: ['en'],
  auth: {
    type: 'none',
    requiresApiKey: false,
    requiresOAuth: false,
    optional: false,
  },
  supportsRemote: true,
  baseUrl: 'https://www.linkedin.com',
  docsUrl: 'https://learn.microsoft.com/en-us/linkedin/',
};

export const LINKEDIN_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: {
    supported: true,
    maxResults: 1000,
    supportsKeyword: true,
    supportsLocation: true,
    supportsTechnology: true,
  },
  pagination: {
    strategy: 'offset',
    maxPageSize: 25,
    defaultPageSize: 25,
    maxTotalResults: 1000,
  },
  sync: {
    incremental: true,
    fullSync: true,
    minSyncIntervalMs: 4 * 60 * 60 * 1000, // 4 hours
  },
  filtering: {
    experienceLevels: ['intern', 'junior', 'middle', 'senior', 'lead', 'principal'],
    salaryFilter: false,
    remoteFilter: true,
    technologyFilter: true,
    dateFilter: false,
  },
  rateLimits: {
    perMinute: 30,
    providesHeaders: false,
    providesInfo: false,
  },
  characteristics: {
    avgResponseTimeMs: 2000,
    fullDescription: false,
    salaryData: false,
    companyDetails: false,
  },
};

export interface LinkedInProviderConfig {
  readonly baseUrl?: string;
  readonly rateLimitMs?: number;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createLinkedInProvider(config: LinkedInProviderConfig): DefaultProviderJob {
  const fetcher = new LinkedInFetcher({
    baseUrl: config.baseUrl,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
    rateLimitMs: config.rateLimitMs,
  });

  const mapper = new LinkedInMapper();
  const normalizer = new LinkedInNormalizer();
  const syncStrategy = new LinkedInSyncStrategy();

  return new DefaultProviderJob(
    LINKEDIN_PROVIDER_INFO,
    LINKEDIN_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
    // LinkedIn's guest search endpoint (jobs-guest/jobs/api/seeMoreJobPostings)
    // returns an empty results page — not an error — when called with no
    // keywords, so the scheduled sync silently imported 0 jobs on every run.
    { query: 'software engineer' },
  );
}
