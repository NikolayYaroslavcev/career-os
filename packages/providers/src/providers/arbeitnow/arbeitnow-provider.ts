import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { ArbeitnowFetcher } from './arbeitnow-fetcher.js';
import { ArbeitnowMapper } from './arbeitnow-mapper.js';
import { ArbeitnowNormalizer } from './arbeitnow-normalizer.js';

export const ARBEITNOW_PROVIDER_INFO: ProviderInfo = {
  id: 'arbeitnow', name: 'Arbeitnow', version: '1.0.0',
  supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK', 'FI'],
  supportedLanguages: ['en'], auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: false },
  supportsRemote: true, baseUrl: 'https://www.arbeitnow.com/api/job-board-api', docsUrl: 'https://www.arbeitnow.com/api',
};

export const ARBEITNOW_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 1000, supportsKeyword: false, supportsLocation: false, supportsTechnology: false },
  pagination: { strategy: 'page', maxPageSize: 20, defaultPageSize: 20 },
  sync: { incremental: true, fullSync: true, minSyncIntervalMs: 60 * 60 * 1000 },
  filtering: { experienceLevels: [], salaryFilter: false, remoteFilter: false, technologyFilter: false, dateFilter: false },
  rateLimits: { perMinute: 60, providesHeaders: false, providesInfo: false },
  characteristics: { avgResponseTimeMs: 2000, fullDescription: true, salaryData: false, companyDetails: false },
};

export interface ArbeitnowProviderConfig { readonly baseUrl?: string; readonly logger: Logger; readonly metrics: MetricsCollector; readonly tracer: Tracer; }

export function createArbeitnowProvider(config: ArbeitnowProviderConfig): DefaultProviderJob {
  return new DefaultProviderJob(
    ARBEITNOW_PROVIDER_INFO, ARBEITNOW_PROVIDER_CAPABILITIES,
    new ArbeitnowFetcher({ baseUrl: config.baseUrl ?? ARBEITNOW_PROVIDER_INFO.baseUrl, logger: config.logger, metrics: config.metrics, tracer: config.tracer }),
    new ArbeitnowMapper(),
    new ArbeitnowNormalizer(),
    new DefaultSyncStrategy('arbeitnow'),
  );
}
