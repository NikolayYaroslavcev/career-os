import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { PersonioFetcher } from './personio-fetcher.js';
import { PersonioMapper } from './personio-mapper.js';
import { PersonioNormalizer } from './personio-normalizer.js';

export const PERSONIO_PROVIDER_INFO: ProviderInfo = {
  id: 'personio',
  name: 'Personio',
  version: '1.0.0',
  supportedCountries: ['DE', 'AT', 'CH'],
  supportedLanguages: ['de', 'en', 'fr', 'es', 'nl', 'it', 'pt'],
  auth: {
    type: 'none',
    requiresApiKey: false,
    requiresOAuth: false,
    optional: true,
  },
  supportsRemote: true,
  baseUrl: 'https://{company}.jobs.personio.de/xml',
  docsUrl: 'https://support.personio.de/hc/en-us/articles/360015296820',
};

export const PERSONIO_PROVIDER_CAPABILITIES: ProviderCapabilities = {
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
    experienceLevels: ['intern', 'junior', 'middle', 'senior', 'lead'],
    salaryFilter: false,
    remoteFilter: true,
    technologyFilter: true,
    dateFilter: false,
  },
  rateLimits: {
    perMinute: 300,
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

export interface PersonioProviderConfig {
  readonly company: string;
  readonly companyName: string;
  readonly language?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createPersonioProvider(config: PersonioProviderConfig): DefaultProviderJob {
  const fetcher = new PersonioFetcher({
    company: config.company,
    companyName: config.companyName,
    language: config.language,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new PersonioMapper();
  const normalizer = new PersonioNormalizer();
  const syncStrategy = new DefaultSyncStrategy(PERSONIO_PROVIDER_INFO.id, {
    fullSyncPageSize: PERSONIO_PROVIDER_CAPABILITIES.pagination.defaultPageSize,
    maxSyncWindowMs: 24 * 60 * 60 * 1000,
  });

  return new DefaultProviderJob(
    PERSONIO_PROVIDER_INFO,
    PERSONIO_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}
