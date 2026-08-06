import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { DjangoJobsFetcher } from './djangojobs-fetcher.js';
import { DjangoJobsMapper } from './djangojobs-mapper.js';
import { DjangoJobsNormalizer } from './djangojobs-normalizer.js';

export const DJANGO_JOBS_PROVIDER_INFO: ProviderInfo = {
  id: 'django_jobs', name: 'Django Jobs', version: '1.0.0',
  supportedCountries: [],
  supportedLanguages: ['en'], auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: false },
  supportsRemote: true, baseUrl: 'https://builtwithdjango.com/jobs/feed/rss', docsUrl: 'https://www.djangoproject.com/community/jobs/',
};

export const DJANGO_JOBS_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 100, supportsKeyword: false, supportsLocation: false, supportsTechnology: false },
  pagination: { strategy: 'none', maxPageSize: 100, defaultPageSize: 100 },
  sync: { incremental: true, fullSync: true, minSyncIntervalMs: 60 * 60 * 1000 },
  filtering: { experienceLevels: [], salaryFilter: false, remoteFilter: false, technologyFilter: false, dateFilter: false },
  rateLimits: { perMinute: 60, providesHeaders: false, providesInfo: false },
  characteristics: { avgResponseTimeMs: 2000, fullDescription: true, salaryData: false, companyDetails: false },
};

export interface DjangoJobsProviderConfig {
  readonly builtWithDjangoUrl?: string;
  readonly djangoJobBoardUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createDjangoJobsProvider(config: DjangoJobsProviderConfig): DefaultProviderJob {
  return new DefaultProviderJob(
    DJANGO_JOBS_PROVIDER_INFO, DJANGO_JOBS_PROVIDER_CAPABILITIES,
    new DjangoJobsFetcher({
      builtWithDjangoUrl: config.builtWithDjangoUrl ?? DJANGO_JOBS_PROVIDER_INFO.baseUrl,
      djangoJobBoardUrl: config.djangoJobBoardUrl ?? 'https://djangojobboard.com/feed/atom/',
      logger: config.logger,
      metrics: config.metrics,
      tracer: config.tracer,
    }),
    new DjangoJobsMapper(),
    new DjangoJobsNormalizer(),
    new DefaultSyncStrategy('django_jobs'),
  );
}
