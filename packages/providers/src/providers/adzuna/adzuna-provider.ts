import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { AdzunaFetcher } from './adzuna-fetcher.js';
import { AdzunaMapper } from './adzuna-mapper.js';
import { AdzunaNormalizer } from './adzuna-normalizer.js';

export const ADZUNA_PROVIDER_INFO: ProviderInfo = {
  id: 'adzuna',
  name: 'Adzuna',
  version: '1.0.0',
  supportedCountries: ['GB', 'US', 'DE', 'FR', 'AT', 'BE', 'BR', 'CA', 'CH', 'IN', 'NL', 'PL', 'SG', 'ZA'],
  supportedLanguages: ['en'],
  auth: {
    type: 'api_key',
    requiresApiKey: true,
    requiresOAuth: false,
    optional: false,
  },
  supportsRemote: false,
  baseUrl: 'https://api.adzuna.com/v1/api',
  docsUrl: 'https://developer.adzuna.com/overview',
};

export const ADZUNA_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: {
    supported: true,
    maxResults: 500,
    supportsKeyword: true,
    supportsLocation: true,
    supportsTechnology: false,
  },
  pagination: {
    strategy: 'page',
    maxPageSize: 50,
    defaultPageSize: 50,
    maxTotalResults: 500,
  },
  sync: {
    incremental: true,
    fullSync: true,
    minSyncIntervalMs: 60 * 60 * 1000, // 1 hour
  },
  filtering: {
    experienceLevels: [],
    salaryFilter: true,
    remoteFilter: false,
    technologyFilter: false,
    dateFilter: true,
  },
  rateLimits: {
    perMinute: 25,
    perDay: 250,
    providesHeaders: false,
    providesInfo: false,
  },
  characteristics: {
    avgResponseTimeMs: 1500,
    fullDescription: false,
    salaryData: true,
    companyDetails: true,
  },
};

export interface AdzunaProviderConfig {
  readonly appId: string;
  readonly appKey: string;
  readonly country?: string;
  readonly baseUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createAdzunaProvider(config: AdzunaProviderConfig): DefaultProviderJob {
  const baseUrl = config.baseUrl ?? ADZUNA_PROVIDER_INFO.baseUrl;

  const fetcher = new AdzunaFetcher({
    appId: config.appId,
    appKey: config.appKey,
    country: config.country ?? 'gb',
    baseUrl,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new AdzunaMapper();
  const normalizer = new AdzunaNormalizer();
  const syncStrategy = new DefaultSyncStrategy('adzuna');

  return new DefaultProviderJob(
    ADZUNA_PROVIDER_INFO,
    ADZUNA_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}
