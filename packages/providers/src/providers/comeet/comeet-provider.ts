import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { ComeetFetcher } from './comeet-fetcher.js';
import { ComeetMapper } from './comeet-mapper.js';
import { ComeetNormalizer } from './comeet-normalizer.js';

export const COMEET_PROVIDER_INFO: ProviderInfo = {
  id: 'comeet',
  name: 'Comeet',
  version: '1.0.0',
  supportedCountries: ['US', 'GB', 'DE', 'FR', 'NL', 'IL'],
  supportedLanguages: ['en'],
  auth: {
    type: 'none',
    requiresApiKey: false,
    requiresOAuth: false,
    optional: false,
  },
  supportsRemote: false,
  baseUrl: 'https://www.comeet.co/careers-api/2.0',
  docsUrl: 'https://developers.comeet.com/reference/careers-api-overview',
};

export const COMEET_PROVIDER_CAPABILITIES: ProviderCapabilities = {
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
    minSyncIntervalMs: 60 * 60 * 1000,
  },
  filtering: {
    experienceLevels: [],
    salaryFilter: false,
    remoteFilter: true,
    technologyFilter: false,
    dateFilter: false,
  },
  rateLimits: {
    perMinute: 60,
    providesHeaders: false,
    providesInfo: false,
  },
  characteristics: {
    avgResponseTimeMs: 1500,
    fullDescription: true,
    salaryData: true,
    companyDetails: false,
  },
};

export interface ComeetProviderConfig {
  readonly token: string;
  readonly companyUid: string;
  readonly companyName: string;
  readonly baseUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createComeetProvider(config: ComeetProviderConfig): DefaultProviderJob {
  const baseUrl = config.baseUrl ?? COMEET_PROVIDER_INFO.baseUrl;

  const fetcher = new ComeetFetcher({
    token: config.token,
    companyUid: config.companyUid,
    baseUrl,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new ComeetMapper(config.companyName);
  const normalizer = new ComeetNormalizer();
  const syncStrategy = new DefaultSyncStrategy('comeet');

  return new DefaultProviderJob(
    COMEET_PROVIDER_INFO,
    COMEET_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}
