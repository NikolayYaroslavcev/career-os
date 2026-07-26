import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { HimalayasFetcher } from './himalayas-fetcher.js';
import { HimalayasMapper } from './himalayas-mapper.js';
import { HimalayasNormalizer } from './himalayas-normalizer.js';

export const HIMALAYAS_PROVIDER_INFO: ProviderInfo = {
  id: 'himalayas',
  name: 'Himalayas',
  version: '1.0.0',
  supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR'],
  supportedLanguages: ['en'],
  auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: false },
  supportsRemote: true,
  baseUrl: 'https://himalayas.app/jobs/api',
  docsUrl: 'https://himalayas.app/jobs/api',
};

export const HIMALAYAS_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 500, supportsKeyword: true, supportsLocation: false, supportsTechnology: false },
  pagination: { strategy: 'offset', maxPageSize: 20, defaultPageSize: 20 },
  sync: { incremental: true, fullSync: true, minSyncIntervalMs: 60 * 60 * 1000 },
  filtering: { experienceLevels: [], salaryFilter: false, remoteFilter: false, technologyFilter: false, dateFilter: false },
  rateLimits: { perMinute: 60, providesHeaders: false, providesInfo: false },
  characteristics: { avgResponseTimeMs: 2000, fullDescription: true, salaryData: true, companyDetails: false },
};

export interface HimalayasProviderConfig {
  readonly baseUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createHimalayasProvider(config: HimalayasProviderConfig): DefaultProviderJob {
  return new DefaultProviderJob(
    HIMALAYAS_PROVIDER_INFO,
    HIMALAYAS_PROVIDER_CAPABILITIES,
    new HimalayasFetcher({ baseUrl: config.baseUrl ?? HIMALAYAS_PROVIDER_INFO.baseUrl, logger: config.logger, metrics: config.metrics, tracer: config.tracer }),
    new HimalayasMapper(),
    new HimalayasNormalizer(),
    new DefaultSyncStrategy('himalayas'),
  );
}
