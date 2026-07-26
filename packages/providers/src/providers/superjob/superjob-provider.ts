import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { SJFetcher } from './superjob-fetcher.js';
import { SJMapper } from './superjob-mapper.js';
import { SJNormalizer } from './superjob-normalizer.js';
import { SJSyncStrategy } from './superjob-sync-strategy.js';

export const SUPERJOB_PROVIDER_INFO: ProviderInfo = {
  id: 'superjob',
  name: 'SuperJob',
  version: '1.0.0',
  supportedCountries: ['RU'],
  supportedLanguages: ['ru'],
  auth: {
    type: 'api_key',
    requiresApiKey: true,
    requiresOAuth: false,
    optional: false,
  },
  supportsRemote: true,
  baseUrl: 'https://api.superjob.ru/2.33',
  docsUrl: 'https://api.superjob.ru/',
};

export const SUPERJOB_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: {
    supported: true,
    maxResults: 2000,
    supportsKeyword: true,
    supportsLocation: true,
    supportsTechnology: true,
  },
  pagination: {
    strategy: 'page',
    maxPageSize: 100,
    defaultPageSize: 100,
    maxTotalResults: 2000,
  },
  sync: {
    incremental: true,
    fullSync: true,
    minSyncIntervalMs: 60 * 60 * 1000, // 1 hour
  },
  filtering: {
    experienceLevels: ['intern', 'junior', 'middle', 'senior', 'lead'],
    salaryFilter: true,
    remoteFilter: false,
    technologyFilter: true,
    dateFilter: false,
  },
  rateLimits: {
    // Not publicly documented anywhere reachable at implementation time (the
    // official docs at api.superjob.ru/ are geo/WAF-blocked from this
    // environment's outbound IP — see ADR/backend README notes for SuperJob).
    // These are conservative placeholders, not measured or confirmed values;
    // re-check against the real docs once a working X-Api-App-Id is issued.
    perMinute: 60,
    providesHeaders: false,
    providesInfo: false,
  },
  characteristics: {
    avgResponseTimeMs: 1500,
    fullDescription: true,
    salaryData: true,
    companyDetails: true,
  },
};

export interface SJProviderConfig {
  readonly baseUrl?: string;
  // X-Api-App-Id — see superjob-fetcher.ts. Every endpoint requires this,
  // including plain vacancy search, unlike HH's optional accessToken.
  readonly apiKey: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createSuperJobProvider(config: SJProviderConfig): DefaultProviderJob {
  const baseUrl = config.baseUrl ?? SUPERJOB_PROVIDER_INFO.baseUrl;

  const fetcher = new SJFetcher({
    baseUrl,
    apiKey: config.apiKey,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new SJMapper();
  const normalizer = new SJNormalizer();
  const syncStrategy = new SJSyncStrategy();

  return new DefaultProviderJob(
    SUPERJOB_PROVIDER_INFO,
    SUPERJOB_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}
