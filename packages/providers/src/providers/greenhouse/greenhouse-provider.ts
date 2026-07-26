import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { GreenhouseFetcher } from './greenhouse-fetcher.js';
import { GreenhouseMapper } from './greenhouse-mapper.js';
import { GreenhouseNormalizer } from './greenhouse-normalizer.js';

export const GREENHOUSE_PROVIDER_INFO: ProviderInfo = {
  id: 'greenhouse',
  name: 'Greenhouse',
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
  baseUrl: 'https://boards-api.greenhouse.io/v1/boards',
  docsUrl: 'https://developers.greenhouse.io/job-board.html',
};

export const GREENHOUSE_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: {
    supported: true,
    maxResults: 500,
    supportsKeyword: true,
    supportsLocation: true,
    supportsTechnology: true,
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
    technologyFilter: true,
    dateFilter: false,
  },
  rateLimits: {
    perMinute: 300,
    providesHeaders: false,
    providesInfo: false,
  },
  characteristics: {
    avgResponseTimeMs: 1200,
    fullDescription: true,
    salaryData: false,
    companyDetails: false,
  },
};

export interface GreenhouseProviderConfig {
  readonly boardToken: string;
  readonly companyName: string;
  readonly baseUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createGreenhouseProvider(config: GreenhouseProviderConfig): DefaultProviderJob {
  const baseUrl = config.baseUrl ?? GREENHOUSE_PROVIDER_INFO.baseUrl;

  const fetcher = new GreenhouseFetcher({
    baseUrl,
    boardToken: config.boardToken,
    companyName: config.companyName,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new GreenhouseMapper();
  const normalizer = new GreenhouseNormalizer();
  const syncStrategy = new DefaultSyncStrategy(GREENHOUSE_PROVIDER_INFO.id, {
    fullSyncPageSize: GREENHOUSE_PROVIDER_CAPABILITIES.pagination.defaultPageSize,
    maxSyncWindowMs: 24 * 60 * 60 * 1000,
  });

  return new DefaultProviderJob(
    GREENHOUSE_PROVIDER_INFO,
    GREENHOUSE_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}
