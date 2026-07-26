import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { SmartRecruitersFetcher } from './smartrecruiters-fetcher.js';
import { SmartRecruitersMapper } from './smartrecruiters-mapper.js';
import { SmartRecruitersNormalizer } from './smartrecruiters-normalizer.js';

export const SMARTRECRUITERS_PROVIDER_INFO: ProviderInfo = {
  id: 'smartrecruiters',
  name: 'SmartRecruiters',
  version: '1.0.0',
  supportedCountries: ['US', 'GB', 'DE', 'FR', 'NL', 'PL', 'CA', 'AU', 'IN'],
  supportedLanguages: ['en'],
  auth: {
    type: 'none',
    requiresApiKey: false,
    requiresOAuth: false,
    optional: false,
  },
  supportsRemote: false,
  baseUrl: 'https://api.smartrecruiters.com/v1',
  docsUrl: 'https://dev.smartrecruiters.com/sourcing-api/',
};

export const SMARTRECRUITERS_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: {
    supported: true,
    maxResults: 1000,
    supportsKeyword: true,
    supportsLocation: true,
    supportsTechnology: false,
  },
  pagination: {
    strategy: 'offset',
    maxPageSize: 100,
    defaultPageSize: 100,
    maxTotalResults: 1000,
  },
  sync: {
    incremental: true,
    fullSync: true,
    minSyncIntervalMs: 60 * 60 * 1000,
  },
  filtering: {
    experienceLevels: [],
    salaryFilter: false,
    remoteFilter: false,
    technologyFilter: false,
    dateFilter: true,
  },
  rateLimits: {
    perMinute: 60,
    providesHeaders: false,
    providesInfo: false,
  },
  characteristics: {
    avgResponseTimeMs: 1500,
    fullDescription: true,
    salaryData: true,
    companyDetails: false,
  },
};

export interface SmartRecruitersProviderConfig {
  readonly company: string;
  readonly companyName: string;
  readonly baseUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createSmartRecruitersProvider(config: SmartRecruitersProviderConfig): DefaultProviderJob {
  const baseUrl = config.baseUrl ?? SMARTRECRUITERS_PROVIDER_INFO.baseUrl;

  const fetcher = new SmartRecruitersFetcher({
    company: config.company,
    baseUrl,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new SmartRecruitersMapper(config.companyName);
  const normalizer = new SmartRecruitersNormalizer();
  const syncStrategy = new DefaultSyncStrategy('smartrecruiters');

  return new DefaultProviderJob(
    SMARTRECRUITERS_PROVIDER_INFO,
    SMARTRECRUITERS_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}
