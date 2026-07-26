import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { RecruiteeFetcher } from './recruitee-fetcher.js';
import { RecruiteeMapper } from './recruitee-mapper.js';
import { RecruiteeNormalizer } from './recruitee-normalizer.js';

export const RECRUITEE_PROVIDER_INFO: ProviderInfo = {
  id: 'recruitee',
  name: 'Recruitee',
  version: '1.0.0',
  supportedCountries: ['US', 'GB', 'DE', 'NL', 'PL', 'FR', 'CA', 'AU'],
  supportedLanguages: ['en'],
  auth: {
    type: 'none',
    requiresApiKey: false,
    requiresOAuth: false,
    optional: false,
  },
  supportsRemote: false,
  baseUrl: 'https://api.recruitee.com/v3',
  docsUrl: 'https://docs.recruitee.com/',
};

export const RECRUITEE_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: {
    supported: true,
    maxResults: 500,
    supportsKeyword: true,
    supportsLocation: true,
    supportsTechnology: false,
  },
  pagination: {
    strategy: 'page',
    maxPageSize: 50,
    defaultPageSize: 50,
    maxTotalResults: 500,
  },
  sync: {
    incremental: true,
    fullSync: true,
    minSyncIntervalMs: 60 * 60 * 1000,
  },
  filtering: {
    experienceLevels: [],
    salaryFilter: false,
    remoteFilter: true,
    technologyFilter: false,
    dateFilter: false,
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

export interface RecruiteeProviderConfig {
  readonly company: string;
  readonly companyName: string;
  readonly baseUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createRecruiteeProvider(config: RecruiteeProviderConfig): DefaultProviderJob {
  const baseUrl = config.baseUrl ?? RECRUITEE_PROVIDER_INFO.baseUrl;

  const fetcher = new RecruiteeFetcher({
    company: config.company,
    baseUrl,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new RecruiteeMapper(config.companyName);
  const normalizer = new RecruiteeNormalizer();
  const syncStrategy = new DefaultSyncStrategy('recruitee');

  return new DefaultProviderJob(
    RECRUITEE_PROVIDER_INFO,
    RECRUITEE_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}
