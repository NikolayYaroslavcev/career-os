import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { JustJoinItFetcher } from './justjoinit-fetcher.js';
import { JustJoinItMapper } from './justjoinit-mapper.js';
import { JustJoinItNormalizer } from './justjoinit-normalizer.js';

export const JUSTJOINIT_PROVIDER_INFO: ProviderInfo = {
  id: 'justjoin_it',
  name: 'JustJoin.it',
  version: '1.0.0',
  supportedCountries: ['PL'],
  supportedLanguages: ['pl', 'en'],
  auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: false },
  supportsRemote: true,
  baseUrl: 'https://justjoin.it',
  docsUrl: 'https://justjoin.it/sitemaps/active-jobs.xml',
};

export const JUSTJOINIT_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 100, supportsKeyword: false, supportsLocation: false, supportsTechnology: false },
  pagination: { strategy: 'timestamp', maxPageSize: 100, defaultPageSize: 100 },
  sync: { incremental: true, fullSync: false, minSyncIntervalMs: 60 * 60 * 1000 },
  filtering: { experienceLevels: [], salaryFilter: false, remoteFilter: false, technologyFilter: false, dateFilter: false },
  rateLimits: { perMinute: 300, providesHeaders: false, providesInfo: false },
  characteristics: { avgResponseTimeMs: 3000, fullDescription: true, salaryData: true, companyDetails: true },
};

export interface JustJoinItProviderConfig {
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createJustJoinItProvider(config: JustJoinItProviderConfig): DefaultProviderJob {
  return new DefaultProviderJob(
    JUSTJOINIT_PROVIDER_INFO,
    JUSTJOINIT_PROVIDER_CAPABILITIES,
    new JustJoinItFetcher({ logger: config.logger, metrics: config.metrics, tracer: config.tracer }),
    new JustJoinItMapper(),
    new JustJoinItNormalizer(),
    new DefaultSyncStrategy('justjoin_it'),
  );
}
