import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { HabrCareerFetcher } from './habr-career-fetcher.js';
import { HabrCareerMapper } from './habr-career-mapper.js';
import { HabrCareerNormalizer } from './habr-career-normalizer.js';

export const HABR_CAREER_PROVIDER_INFO: ProviderInfo = {
  id: 'habr_career',
  name: 'Habr Career',
  version: '1.0.0',
  supportedCountries: ['RU', 'BY', 'KZ', 'UA', 'GE', 'AM', 'AZ', 'KG', 'UZ', 'TJ', 'MD'],
  supportedLanguages: ['ru'],
  auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: false },
  supportsRemote: true,
  baseUrl: 'https://career.habr.com/vacancies/rss',
  docsUrl: 'https://career.habr.com/vacancies',
};

export const HABR_CAREER_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 200, supportsKeyword: false, supportsLocation: false, supportsTechnology: false },
  pagination: { strategy: 'none', maxPageSize: 200, defaultPageSize: 200 },
  sync: { incremental: true, fullSync: true, minSyncIntervalMs: 2 * 60 * 60 * 1000 },
  filtering: { experienceLevels: ['intern', 'junior', 'middle', 'senior', 'lead', 'principal'], salaryFilter: false, remoteFilter: false, technologyFilter: false, dateFilter: false },
  rateLimits: { perMinute: 60, providesHeaders: false, providesInfo: false },
  // The RSS feed carries no structured company/salary fields — title/location
  // and salary are best-effort text extraction (see habr-career-fetcher.ts),
  // so companyDetails/salaryData are left false rather than overclaimed.
  characteristics: { avgResponseTimeMs: 2000, fullDescription: true, salaryData: false, companyDetails: false },
};

export interface HabrCareerProviderConfig {
  readonly baseUrl?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createHabrCareerProvider(config: HabrCareerProviderConfig): DefaultProviderJob {
  return new DefaultProviderJob(
    HABR_CAREER_PROVIDER_INFO,
    HABR_CAREER_PROVIDER_CAPABILITIES,
    new HabrCareerFetcher({
      baseUrl: config.baseUrl ?? HABR_CAREER_PROVIDER_INFO.baseUrl,
      logger: config.logger,
      metrics: config.metrics,
      tracer: config.tracer,
    }),
    new HabrCareerMapper(),
    new HabrCareerNormalizer(),
    new DefaultSyncStrategy('habr_career'),
  );
}
