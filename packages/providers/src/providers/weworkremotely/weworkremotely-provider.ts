import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { WWRFetcher } from './weworkremotely-fetcher.js';
import { WWRMapper } from './weworkremotely-mapper.js';
import { WWRNormalizer } from './weworkremotely-normalizer.js';

export const WWR_PROVIDER_INFO: ProviderInfo = {
  id: 'we_work_remotely', name: 'We Work Remotely', version: '1.0.0',
  supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK', 'FI'],
  supportedLanguages: ['en'], auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: false },
  supportsRemote: true, baseUrl: 'https://weworkremotely.com/categories/remote-programming-jobs.rss', docsUrl: 'https://weworkremotely.com/remote-jobs',
};

export const WWR_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 200, supportsKeyword: false, supportsLocation: false, supportsTechnology: false },
  pagination: { strategy: 'none', maxPageSize: 200, defaultPageSize: 200 },
  sync: { incremental: true, fullSync: true, minSyncIntervalMs: 60 * 60 * 1000 },
  filtering: { experienceLevels: [], salaryFilter: false, remoteFilter: false, technologyFilter: false, dateFilter: false },
  rateLimits: { perMinute: 60, providesHeaders: false, providesInfo: false },
  characteristics: { avgResponseTimeMs: 2000, fullDescription: true, salaryData: false, companyDetails: false },
};

export interface WWRProviderConfig { readonly baseUrl?: string; readonly logger: Logger; readonly metrics: MetricsCollector; readonly tracer: Tracer; }

export function createWWRProvider(config: WWRProviderConfig): DefaultProviderJob {
  return new DefaultProviderJob(
    WWR_PROVIDER_INFO, WWR_PROVIDER_CAPABILITIES,
    new WWRFetcher({ baseUrl: config.baseUrl ?? WWR_PROVIDER_INFO.baseUrl, logger: config.logger, metrics: config.metrics, tracer: config.tracer }),
    new WWRMapper(),
    new WWRNormalizer(),
    new DefaultSyncStrategy('we_work_remotely'),
  );
}
