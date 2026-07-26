import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { HNHiringFetcher } from './hnhiring-fetcher.js';
import { HNHiringMapper } from './hnhiring-mapper.js';
import { HNHiringNormalizer } from './hnhiring-normalizer.js';

export const HN_HIRING_PROVIDER_INFO: ProviderInfo = {
  id: 'hn_hiring', name: 'HN Who Is Hiring', version: '1.0.0',
  supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK', 'FI'],
  supportedLanguages: ['en'], auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: false },
  supportsRemote: true, baseUrl: 'https://hn.algolia.com/api/v1/search', docsUrl: 'https://news.ycombinator.com',
};

export const HN_HIRING_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 200, supportsKeyword: false, supportsLocation: false, supportsTechnology: true },
  pagination: { strategy: 'none', maxPageSize: 200, defaultPageSize: 200 },
  sync: { incremental: true, fullSync: true, minSyncIntervalMs: 24 * 60 * 60 * 1000 },
  filtering: { experienceLevels: [], salaryFilter: false, remoteFilter: false, technologyFilter: true, dateFilter: false },
  rateLimits: { perMinute: 30, providesHeaders: false, providesInfo: false },
  characteristics: { avgResponseTimeMs: 5000, fullDescription: true, salaryData: false, companyDetails: false },
};

export interface HNHiringProviderConfig { readonly baseUrl?: string; readonly logger: Logger; readonly metrics: MetricsCollector; readonly tracer: Tracer; }

export function createHNHiringProvider(config: HNHiringProviderConfig): DefaultProviderJob {
  return new DefaultProviderJob(
    HN_HIRING_PROVIDER_INFO, HN_HIRING_PROVIDER_CAPABILITIES,
    new HNHiringFetcher({ baseUrl: config.baseUrl ?? HN_HIRING_PROVIDER_INFO.baseUrl, logger: config.logger, metrics: config.metrics, tracer: config.tracer }),
    new HNHiringMapper(),
    new HNHiringNormalizer(),
    new DefaultSyncStrategy('hn_hiring'),
  );
}
