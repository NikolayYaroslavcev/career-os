import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { JobicyFetcher } from './jobicy-fetcher.js';
import { JobicyMapper } from './jobicy-mapper.js';
import { JobicyNormalizer } from './jobicy-normalizer.js';

export const JOBICY_PROVIDER_INFO: ProviderInfo = {
  id: 'jobicy', name: 'Jobicy', version: '1.0.0',
  supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK', 'FI'],
  supportedLanguages: ['en'], auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: false },
  supportsRemote: true, baseUrl: 'https://jobicy.com/api/v2/remote-jobs', docsUrl: 'https://jobicy.com/api',
};

export const JOBICY_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 50, supportsKeyword: false, supportsLocation: false, supportsTechnology: true },
  pagination: { strategy: 'none', maxPageSize: 50, defaultPageSize: 50 },
  sync: { incremental: true, fullSync: true, minSyncIntervalMs: 60 * 60 * 1000 },
  filtering: { experienceLevels: [], salaryFilter: false, remoteFilter: false, technologyFilter: true, dateFilter: false },
  rateLimits: { perMinute: 60, providesHeaders: false, providesInfo: false },
  characteristics: { avgResponseTimeMs: 2000, fullDescription: false, salaryData: true, companyDetails: false },
};

export interface JobicyProviderConfig { readonly baseUrl?: string; readonly logger: Logger; readonly metrics: MetricsCollector; readonly tracer: Tracer; }

export function createJobicyProvider(config: JobicyProviderConfig): DefaultProviderJob {
  return new DefaultProviderJob(
    JOBICY_PROVIDER_INFO, JOBICY_PROVIDER_CAPABILITIES,
    new JobicyFetcher({ baseUrl: config.baseUrl ?? JOBICY_PROVIDER_INFO.baseUrl, logger: config.logger, metrics: config.metrics, tracer: config.tracer }),
    new JobicyMapper(),
    new JobicyNormalizer(),
    new DefaultSyncStrategy('jobicy'),
  );
}
