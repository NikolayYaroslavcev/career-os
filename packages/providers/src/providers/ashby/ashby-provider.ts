import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { AshbyFetcher } from './ashby-fetcher.js';
import { AshbyMapper } from './ashby-mapper.js';
import { AshbyNormalizer } from './ashby-normalizer.js';

export const ASHBY_PROVIDER_INFO: ProviderInfo = {
  id: 'ashby',
  name: 'Ashby',
  version: '1.0.0',
  supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'IE'],
  supportedLanguages: ['en'],
  auth: {
    type: 'none',
    requiresApiKey: false,
    requiresOAuth: false,
    optional: true,
  },
  supportsRemote: true,
  baseUrl: 'https://api.ashbyhq.com/posting-api/job-board',
  docsUrl: 'https://developers.ashbyhq.com/reference/job-board-api',
};

export const ASHBY_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: {
    supported: true,
    maxResults: 500,
    supportsKeyword: true,
    supportsLocation: true,
    supportsTechnology: false,
  },
  pagination: {
    strategy: 'none',
    maxPageSize: 500,
    defaultPageSize: 500,
  },
  sync: {
    incremental: true,
    fullSync: true,
    minSyncIntervalMs: 30 * 60 * 1000, // 30 minutes
  },
  filtering: {
    experienceLevels: [],
    salaryFilter: false,
    remoteFilter: true,
    technologyFilter: false,
    dateFilter: false,
  },
  rateLimits: {
    perMinute: 200,
    providesHeaders: false,
    providesInfo: false,
  },
  characteristics: {
    avgResponseTimeMs: 900,
    fullDescription: true,
    salaryData: false,
    companyDetails: false,
  },
};

export interface AshbyProviderConfig {
  readonly jobBoardName: string;
  readonly companyName: string;
  readonly baseUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createAshbyProvider(config: AshbyProviderConfig): DefaultProviderJob {
  const baseUrl = config.baseUrl ?? ASHBY_PROVIDER_INFO.baseUrl;

  const fetcher = new AshbyFetcher({
    baseUrl,
    jobBoardName: config.jobBoardName,
    companyName: config.companyName,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new AshbyMapper();
  const normalizer = new AshbyNormalizer();
  const syncStrategy = new DefaultSyncStrategy(ASHBY_PROVIDER_INFO.id, {
    fullSyncPageSize: ASHBY_PROVIDER_CAPABILITIES.pagination.defaultPageSize,
    maxSyncWindowMs: 24 * 60 * 60 * 1000,
  });

  return new DefaultProviderJob(
    ASHBY_PROVIDER_INFO,
    ASHBY_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}
