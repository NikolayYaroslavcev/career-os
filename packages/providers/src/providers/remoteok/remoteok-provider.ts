import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { RemoteOKFetcher } from './remoteok-fetcher.js';
import { RemoteOKMapper } from './remoteok-mapper.js';
import { RemoteOKNormalizer } from './remoteok-normalizer.js';
import { RemoteOKSyncStrategy } from './remoteok-sync-strategy.js';

export const REMOTE_OK_PROVIDER_INFO: ProviderInfo = {
  id: 'remote_ok',
  name: 'RemoteOK',
  version: '1.0.0',
  supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK', 'FI'],
  supportedLanguages: ['en'],
  auth: {
    type: 'none',
    requiresApiKey: false,
    requiresOAuth: false,
    optional: true,
  },
  supportsRemote: true,
  baseUrl: 'https://remoteok.com/api',
  docsUrl: 'https://remoteok.com/api',
};

export const REMOTE_OK_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: {
    supported: true,
    maxResults: 1000,
    supportsKeyword: false,
    supportsLocation: false,
    supportsTechnology: true,
  },
  pagination: {
    strategy: 'none',
    maxPageSize: 1000,
    defaultPageSize: 1000,
  },
  sync: {
    incremental: true,
    fullSync: true,
    minSyncIntervalMs: 60 * 60 * 1000, // 1 hour
  },
  filtering: {
    experienceLevels: [],
    salaryFilter: false,
    remoteFilter: false,
    technologyFilter: true,
    dateFilter: false,
  },
  rateLimits: {
    perMinute: 60,
    providesHeaders: false,
    providesInfo: false,
  },
  characteristics: {
    avgResponseTimeMs: 2000,
    fullDescription: true,
    salaryData: true,
    companyDetails: false,
  },
};

export interface RemoteOKProviderConfig {
  readonly baseUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createRemoteOKProvider(config: RemoteOKProviderConfig): DefaultProviderJob {
  const baseUrl = config.baseUrl ?? REMOTE_OK_PROVIDER_INFO.baseUrl;

  const fetcher = new RemoteOKFetcher({
    baseUrl,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new RemoteOKMapper();
  const normalizer = new RemoteOKNormalizer();
  const syncStrategy = new RemoteOKSyncStrategy();

  return new DefaultProviderJob(
    REMOTE_OK_PROVIDER_INFO,
    REMOTE_OK_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}