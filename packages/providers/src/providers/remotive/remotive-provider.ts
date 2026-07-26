import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { RemotiveFetcher } from './remotive-fetcher.js';
import { RemotiveMapper } from './remotive-mapper.js';
import { RemotiveNormalizer } from './remotive-normalizer.js';
import { RemotiveSyncStrategy } from './remotive-sync-strategy.js';

export const REMOTIVE_PROVIDER_INFO: ProviderInfo = {
  id: 'remotive',
  name: 'Remotive',
  version: '1.0.0',
  supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK', 'FI'],
  supportedLanguages: ['en'],
  auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: false },
  supportsRemote: true,
  baseUrl: 'https://remotive.com/api/remote-jobs',
  docsUrl: 'https://remotive.com/api',
};

export const REMOTIVE_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 500, supportsKeyword: true, supportsLocation: false, supportsTechnology: false },
  pagination: { strategy: 'none', maxPageSize: 500, defaultPageSize: 500 },
  sync: { incremental: true, fullSync: true, minSyncIntervalMs: 60 * 60 * 1000 },
  filtering: { experienceLevels: [], salaryFilter: false, remoteFilter: false, technologyFilter: false, dateFilter: false },
  rateLimits: { perMinute: 60, providesHeaders: false, providesInfo: false },
  characteristics: { avgResponseTimeMs: 2000, fullDescription: true, salaryData: true, companyDetails: false },
};

export interface RemotiveProviderConfig {
  readonly baseUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createRemotiveProvider(config: RemotiveProviderConfig): DefaultProviderJob {
  const baseUrl = config.baseUrl ?? REMOTIVE_PROVIDER_INFO.baseUrl;
  return new DefaultProviderJob(
    REMOTIVE_PROVIDER_INFO,
    REMOTIVE_PROVIDER_CAPABILITIES,
    new RemotiveFetcher({ baseUrl, logger: config.logger, metrics: config.metrics, tracer: config.tracer }),
    new RemotiveMapper(),
    new RemotiveNormalizer(),
    new RemotiveSyncStrategy(),
  );
}
