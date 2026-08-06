import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { WorkableFetcher } from './workable-fetcher.js';
import { WorkableMapper } from './workable-mapper.js';
import { WorkableNormalizer } from './workable-normalizer.js';

export const WORKABLE_PROVIDER_INFO: ProviderInfo = {
  id: 'workable',
  name: 'Workable',
  version: '1.0.0',
  supportedCountries: ['US', 'GB', 'DE', 'FR', 'NL', 'IE', 'CA', 'AU'],
  supportedLanguages: ['en'],
  auth: {
    type: 'none',
    requiresApiKey: false,
    requiresOAuth: false,
    optional: true,
  },
  supportsRemote: true,
  baseUrl: 'https://apply.workable.com/api/v1/widget/accounts',
  docsUrl: 'https://help.workable.com/hc/en-us/articles/115012801727-How-to-embed-jobs-on-your-website-job-widget',
};

export const WORKABLE_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: {
    supported: true,
    maxResults: 500,
    supportsKeyword: true,
    supportsLocation: true,
    supportsTechnology: true,
  },
  pagination: {
    strategy: 'none',
    maxPageSize: 500,
    defaultPageSize: 500,
  },
  sync: {
    incremental: true,
    fullSync: true,
    minSyncIntervalMs: 30 * 60 * 1000, // 30 minutes
  },
  filtering: {
    experienceLevels: ['intern', 'junior', 'middle', 'senior', 'lead', 'principal'],
    salaryFilter: false,
    remoteFilter: true,
    technologyFilter: true,
    dateFilter: false,
  },
  rateLimits: {
    perMinute: 60,
    providesHeaders: false,
    providesInfo: false,
  },
  characteristics: {
    avgResponseTimeMs: 1200,
    fullDescription: true,
    salaryData: false,
    companyDetails: false,
  },
};

export interface WorkableProviderConfig {
  readonly accountSlug: string;
  readonly companyName: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createWorkableProvider(config: WorkableProviderConfig): DefaultProviderJob {
  const fetcher = new WorkableFetcher({
    accountSlug: config.accountSlug,
    companyName: config.companyName,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new WorkableMapper();
  const normalizer = new WorkableNormalizer();
  const syncStrategy = new DefaultSyncStrategy(WORKABLE_PROVIDER_INFO.id, {
    fullSyncPageSize: WORKABLE_PROVIDER_CAPABILITIES.pagination.defaultPageSize,
    maxSyncWindowMs: 24 * 60 * 60 * 1000,
  });

  return new DefaultProviderJob(
    WORKABLE_PROVIDER_INFO,
    WORKABLE_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}
