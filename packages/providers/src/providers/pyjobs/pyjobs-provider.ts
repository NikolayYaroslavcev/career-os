import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { PyJobsFetcher } from './pyjobs-fetcher.js';
import { PyJobsMapper } from './pyjobs-mapper.js';
import { PyJobsNormalizer } from './pyjobs-normalizer.js';

export const PYJOBS_PROVIDER_INFO: ProviderInfo = {
  id: 'pyjobs', name: 'PyJobs', version: '1.0.0',
  supportedCountries: [],
  supportedLanguages: ['en'], auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: false },
  supportsRemote: true, baseUrl: 'https://www.pyjobs.com/rss', docsUrl: 'https://www.pyjobs.com/',
};

export const PYJOBS_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 200, supportsKeyword: false, supportsLocation: false, supportsTechnology: false },
  pagination: { strategy: 'none', maxPageSize: 200, defaultPageSize: 200 },
  sync: { incremental: true, fullSync: true, minSyncIntervalMs: 60 * 60 * 1000 },
  filtering: { experienceLevels: [], salaryFilter: false, remoteFilter: false, technologyFilter: false, dateFilter: false },
  rateLimits: { perMinute: 60, providesHeaders: false, providesInfo: false },
  characteristics: { avgResponseTimeMs: 2000, fullDescription: false, salaryData: false, companyDetails: false },
};

export interface PyJobsProviderConfig { readonly baseUrl?: string; readonly logger: Logger; readonly metrics: MetricsCollector; readonly tracer: Tracer; }

export function createPyJobsProvider(config: PyJobsProviderConfig): DefaultProviderJob {
  return new DefaultProviderJob(
    PYJOBS_PROVIDER_INFO, PYJOBS_PROVIDER_CAPABILITIES,
    new PyJobsFetcher({ baseUrl: config.baseUrl ?? PYJOBS_PROVIDER_INFO.baseUrl, logger: config.logger, metrics: config.metrics, tracer: config.tracer }),
    new PyJobsMapper(),
    new PyJobsNormalizer(),
    new DefaultSyncStrategy('pyjobs'),
  );
}
