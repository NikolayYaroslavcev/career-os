import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { HHFetcher } from './hh-fetcher.js';
import { HHMapper } from './hh-mapper.js';
import { HHNormalizer } from './hh-normalizer.js';
import { HHSyncStrategy } from './hh-sync-strategy.js';

export const HH_AREA_IDS = {
  'hh.ru': '113',    // Россия
  'hh.kz': '40',     // Казахстан
  'hh.by': '16',     // Беларусь (api.hh.ru area, not rabota.by)
} as const;

// api.hh.ru area IDs for the CIS countries HH_AREAS defaults to (see
// packages/shared/src/config.ts). Verified against GET https://api.hh.ru/areas/countries.
export const HH_CIS_AREA_IDS = {
  RU: '113', // Россия
  BY: '16',  // Беларусь
  KZ: '40',  // Казахстан
  UZ: '97',  // Узбекистан
  KG: '48',  // Кыргызстан
  AZ: '9',   // Азербайджан
} as const;

export const HH_PROVIDER_INFO: ProviderInfo = {
  id: 'hh',
  name: 'HeadHunter',
  version: '1.0.0',
  supportedCountries: ['RU', 'BY', 'KZ', 'UA', 'GE', 'AM', 'AZ', 'KG', 'UZ', 'TJ', 'MD'],
  supportedLanguages: ['ru', 'en'],
  auth: {
    type: 'api_key',
    requiresApiKey: false,
    requiresOAuth: false,
    optional: true,
  },
  supportsRemote: true,
  baseUrl: 'https://api.hh.ru',
  docsUrl: 'https://github.com/hhru/api',
};

export const HH_PROVIDER_CAPABILITIES: ProviderCapabilities = {
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
    remoteFilter: true,
    technologyFilter: true,
    dateFilter: true,
  },
  rateLimits: {
    perMinute: 60,
    perDay: 5000,
    providesHeaders: true,
    providesInfo: false,
  },
  characteristics: {
    avgResponseTimeMs: 1500,
    fullDescription: true,
    salaryData: true,
    companyDetails: true,
  },
};

export interface HHProviderConfig {
  readonly baseUrl?: string;
  readonly accessToken?: string;
  // Default HH area IDs searched when a call specifies no location. See
  // HH_CIS_AREA_IDS above and HH_AREAS in packages/shared/src/config.ts.
  readonly areas?: readonly string[];
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createHHProvider(config: HHProviderConfig): DefaultProviderJob {
  const baseUrl = config.baseUrl ?? HH_PROVIDER_INFO.baseUrl;

  const fetcher = new HHFetcher({
    baseUrl,
    accessToken: config.accessToken,
    areas: config.areas,
    logger: config.logger,
    metrics: config.metrics,
    tracer: config.tracer,
  });

  const mapper = new HHMapper();
  const normalizer = new HHNormalizer();
  const syncStrategy = new HHSyncStrategy();

  return new DefaultProviderJob(
    HH_PROVIDER_INFO,
    HH_PROVIDER_CAPABILITIES,
    fetcher,
    mapper,
    normalizer,
    syncStrategy,
  );
}
