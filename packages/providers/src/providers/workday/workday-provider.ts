import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { WorkdayFetcher } from './workday-fetcher.js';
import { WorkdayMapper } from './workday-mapper.js';
import { WorkdayNormalizer } from './workday-normalizer.js';

const DEFAULT_HOST = 'wd1.myworkdayjobs.com';

export const WORKDAY_PROVIDER_INFO: ProviderInfo = {
  id: 'workday',
  name: 'Workday',
  version: '1.0.0',
  supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'IE'],
  supportedLanguages: ['en'],
  auth: {
    type: 'none',
    requiresApiKey: false,
    requiresOAuth: false,
    optional: true,
  },
  supportsRemote: true,
  // Documentation default only — the fetcher builds its real base URL from
  // `tenant` + `host` + `site`, since Workday has no single universal API host.
  baseUrl: 'https://wd1.myworkdayjobs.com',
  docsUrl: 'https://developer.workday.com/',
};

export const WORKDAY_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: {
    supported: true,
    maxResults: 500,
    supportsKeyword: true,
    supportsLocation: false,
    supportsTechnology: false,
  },
  pagination: {
    strategy: 'offset',
    maxPageSize: 20,
    defaultPageSize: 20,
  },
  sync: {
    incremental: true,
    fullSync: true,
    minSyncIntervalMs: 60 * 60 * 1000, // 1 hour
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
    fullDescription: false,
    salaryData: false,
    companyDetails: false,
  },
};

export interface WorkdayProviderConfig {
  readonly tenant: string;
  readonly site: string;
  readonly companyName: string;
  readonly host?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createWorkdayProvider(config: WorkdayProviderConfig): DefaultProviderJob {
  const fetcher = new WorkdayFetcher({
    tenant: config.tenant,
    site: config.site,
    host: config.host ?? DEFAULT_HOST,
    companyName: config.companyName,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new WorkdayMapper();
  const normalizer = new WorkdayNormalizer();
  const syncStrategy = new DefaultSyncStrategy(WORKDAY_PROVIDER_INFO.id, {
    fullSyncPageSize: WORKDAY_PROVIDER_CAPABILITIES.pagination.defaultPageSize,
    maxSyncWindowMs: 24 * 60 * 60 * 1000,
  });

  return new DefaultProviderJob(
    WORKDAY_PROVIDER_INFO,
    WORKDAY_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}
