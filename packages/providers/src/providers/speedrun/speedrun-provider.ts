import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { SpeedrunFetcher } from './speedrun-fetcher.js';
import { SpeedrunMapper } from './speedrun-mapper.js';
import { SpeedrunNormalizer } from './speedrun-normalizer.js';

export const SPEEDRUN_PROVIDER_INFO: ProviderInfo = {
  id: 'speedrun', name: 'a16z Speedrun Talent Network', version: '1.0.0',
  supportedCountries: [],
  supportedLanguages: ['en'], auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: false },
  supportsRemote: true, baseUrl: 'https://speedrun-talent-network.com/api/v1/jobs', docsUrl: 'https://speedrun-talent-network.com/',
};

export const SPEEDRUN_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 10000, supportsKeyword: false, supportsLocation: false, supportsTechnology: false },
  pagination: { strategy: 'page', maxPageSize: 50, defaultPageSize: 50 },
  sync: { incremental: true, fullSync: true, minSyncIntervalMs: 60 * 60 * 1000 },
  filtering: { experienceLevels: [], salaryFilter: false, remoteFilter: false, technologyFilter: false, dateFilter: false },
  rateLimits: { perMinute: 60, providesHeaders: false, providesInfo: false },
  characteristics: { avgResponseTimeMs: 2000, fullDescription: false, salaryData: true, companyDetails: false },
};

export interface SpeedrunProviderConfig { readonly baseUrl?: string; readonly logger: Logger; readonly metrics: MetricsCollector; readonly tracer: Tracer; }

export function createSpeedrunProvider(config: SpeedrunProviderConfig): DefaultProviderJob {
  return new DefaultProviderJob(
    SPEEDRUN_PROVIDER_INFO, SPEEDRUN_PROVIDER_CAPABILITIES,
    new SpeedrunFetcher({ baseUrl: config.baseUrl ?? SPEEDRUN_PROVIDER_INFO.baseUrl, logger: config.logger, metrics: config.metrics, tracer: config.tracer }),
    new SpeedrunMapper(),
    new SpeedrunNormalizer(),
    new DefaultSyncStrategy('speedrun'),
  );
}
