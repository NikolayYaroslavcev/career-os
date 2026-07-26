import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { TeamtailorFetcher } from './teamtailor-fetcher.js';
import { TeamtailorMapper } from './teamtailor-mapper.js';
import { TeamtailorNormalizer } from './teamtailor-normalizer.js';

export const TEAMTAILOR_PROVIDER_INFO: ProviderInfo = {
  id: 'teamtailor',
  name: 'Teamtailor',
  version: '1.0.0',
  supportedCountries: ['US', 'GB', 'SE', 'DE', 'FR', 'NL', 'DK', 'NO'],
  supportedLanguages: ['en'],
  auth: {
    type: 'api_key',
    requiresApiKey: true,
    requiresOAuth: false,
    optional: false,
  },
  supportsRemote: true,
  baseUrl: 'https://api.teamtailor.com/v1/jobs',
  docsUrl: 'https://docs.teamtailor.com/',
};

export const TEAMTAILOR_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: {
    supported: true,
    maxResults: 500,
    supportsKeyword: true,
    supportsLocation: true,
    supportsTechnology: false,
  },
  pagination: {
    strategy: 'page',
    maxPageSize: 30,
    defaultPageSize: 20,
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
    technologyFilter: false,
    dateFilter: false,
  },
  rateLimits: {
    perMinute: 300,
    providesHeaders: true,
    providesInfo: false,
  },
  characteristics: {
    avgResponseTimeMs: 1100,
    fullDescription: true,
    salaryData: false,
    companyDetails: false,
  },
};

export interface TeamtailorProviderConfig {
  readonly apiKey: string;
  readonly companyName: string;
  readonly baseUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createTeamtailorProvider(config: TeamtailorProviderConfig): DefaultProviderJob {
  const baseUrl = config.baseUrl ?? TEAMTAILOR_PROVIDER_INFO.baseUrl;

  const fetcher = new TeamtailorFetcher({
    baseUrl,
    apiKey: config.apiKey,
    companyName: config.companyName,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new TeamtailorMapper();
  const normalizer = new TeamtailorNormalizer();
  const syncStrategy = new DefaultSyncStrategy(TEAMTAILOR_PROVIDER_INFO.id, {
    fullSyncPageSize: TEAMTAILOR_PROVIDER_CAPABILITIES.pagination.defaultPageSize,
    maxSyncWindowMs: 24 * 60 * 60 * 1000,
  });

  return new DefaultProviderJob(
    TEAMTAILOR_PROVIDER_INFO,
    TEAMTAILOR_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}
