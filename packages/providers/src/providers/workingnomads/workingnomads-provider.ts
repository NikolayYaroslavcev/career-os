import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { WorkingNomadsFetcher } from './workingnomads-fetcher.js';
import { WorkingNomadsMapper } from './workingnomads-mapper.js';
import { WorkingNomadsNormalizer } from './workingnomads-normalizer.js';

export const WORKING_NOMADS_PROVIDER_INFO: ProviderInfo = {
  id: 'working_nomads', name: 'Working Nomads', version: '1.0.0',
  supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK', 'FI'],
  supportedLanguages: ['en'], auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: false },
  supportsRemote: true, baseUrl: 'https://www.workingnomads.com/api/exposed_jobs', docsUrl: 'https://www.workingnomads.com/remote-jobs',
};

export const WORKING_NOMADS_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 100, supportsKeyword: false, supportsLocation: false, supportsTechnology: true },
  pagination: { strategy: 'none', maxPageSize: 100, defaultPageSize: 100 },
  sync: { incremental: true, fullSync: true, minSyncIntervalMs: 60 * 60 * 1000 },
  filtering: { experienceLevels: [], salaryFilter: false, remoteFilter: false, technologyFilter: true, dateFilter: false },
  rateLimits: { perMinute: 60, providesHeaders: false, providesInfo: false },
  characteristics: { avgResponseTimeMs: 2000, fullDescription: false, salaryData: false, companyDetails: false },
};

export interface WorkingNomadsProviderConfig { readonly baseUrl?: string; readonly logger: Logger; readonly metrics: MetricsCollector; readonly tracer: Tracer; }

export function createWorkingNomadsProvider(config: WorkingNomadsProviderConfig): DefaultProviderJob {
  return new DefaultProviderJob(
    WORKING_NOMADS_PROVIDER_INFO, WORKING_NOMADS_PROVIDER_CAPABILITIES,
    new WorkingNomadsFetcher({ baseUrl: config.baseUrl ?? WORKING_NOMADS_PROVIDER_INFO.baseUrl, logger: config.logger, metrics: config.metrics, tracer: config.tracer }),
    new WorkingNomadsMapper(),
    new WorkingNomadsNormalizer(),
    new DefaultSyncStrategy('working_nomads'),
  );
}
