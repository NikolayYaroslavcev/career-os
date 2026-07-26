import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { LeverFetcher } from './lever-fetcher.js';
import { LeverMapper } from './lever-mapper.js';
import { LeverNormalizer } from './lever-normalizer.js';

export const LEVER_PROVIDER_INFO: ProviderInfo = {
  id: 'lever',
  name: 'Lever',
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
  baseUrl: 'https://api.lever.co/v0/postings',
  docsUrl: 'https://github.com/lever/postings-api',
};

export const LEVER_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: {
    supported: true,
    maxResults: 500,
    supportsKeyword: true,
    supportsLocation: true,
    supportsTechnology: true,
  },
  pagination: {
    strategy: 'offset',
    maxPageSize: 100,
    defaultPageSize: 100,
  },
  sync: {
    incremental: true,
    fullSync: true,
    minSyncIntervalMs: 30 * 60 * 1000, // 30 minutes
  },
  filtering: {
    experienceLevels: [],
    salaryFilter: true,
    remoteFilter: true,
    technologyFilter: true,
    dateFilter: false,
  },
  rateLimits: {
    perMinute: 120,
    providesHeaders: false,
    providesInfo: false,
  },
  characteristics: {
    avgResponseTimeMs: 1000,
    fullDescription: true,
    salaryData: true,
    companyDetails: false,
  },
};

export interface LeverProviderConfig {
  readonly company: string;
  readonly companyName: string;
  readonly baseUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createLeverProvider(config: LeverProviderConfig): DefaultProviderJob {
  const baseUrl = config.baseUrl ?? LEVER_PROVIDER_INFO.baseUrl;

  const fetcher = new LeverFetcher({
    baseUrl,
    company: config.company,
    companyName: config.companyName,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new LeverMapper();
  const normalizer = new LeverNormalizer();
  const syncStrategy = new DefaultSyncStrategy(LEVER_PROVIDER_INFO.id, {
    fullSyncPageSize: LEVER_PROVIDER_CAPABILITIES.pagination.defaultPageSize,
    maxSyncWindowMs: 24 * 60 * 60 * 1000,
  });

  return new DefaultProviderJob(
    LEVER_PROVIDER_INFO,
    LEVER_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}
