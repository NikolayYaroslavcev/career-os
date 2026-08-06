import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { DefaultSyncStrategy } from '../../interfaces/default-sync-strategy.js';
import { FranceTravailFetcher, FRANCE_TRAVAIL_DEFAULT_ROME_CODES } from './francetravail-fetcher.js';
import { FranceTravailMapper } from './francetravail-mapper.js';
import { FranceTravailNormalizer } from './francetravail-normalizer.js';

export const FRANCE_TRAVAIL_PROVIDER_INFO: ProviderInfo = {
  id: 'france_travail', name: 'France Travail', version: '1.0.0',
  supportedCountries: ['FR'],
  supportedLanguages: ['fr'], auth: { type: 'oauth2', requiresApiKey: false, requiresOAuth: true, optional: false },
  supportsRemote: false, baseUrl: 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search', docsUrl: 'https://francetravail.io/data/api/offres-emploi',
};

export const FRANCE_TRAVAIL_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  search: { supported: true, maxResults: 10000, supportsKeyword: false, supportsLocation: false, supportsTechnology: false },
  pagination: { strategy: 'offset', maxPageSize: 50, defaultPageSize: 50 },
  sync: { incremental: true, fullSync: true, minSyncIntervalMs: 60 * 60 * 1000 },
  filtering: { experienceLevels: [], salaryFilter: false, remoteFilter: false, technologyFilter: false, dateFilter: false },
  rateLimits: { perMinute: 600, providesHeaders: false, providesInfo: false },
  characteristics: { avgResponseTimeMs: 2000, fullDescription: true, salaryData: true, companyDetails: false },
};

export interface FranceTravailProviderConfig {
  readonly baseUrl?: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly romeCodes?: readonly string[];
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

export function createFranceTravailProvider(config: FranceTravailProviderConfig): DefaultProviderJob {
  return new DefaultProviderJob(
    FRANCE_TRAVAIL_PROVIDER_INFO, FRANCE_TRAVAIL_PROVIDER_CAPABILITIES,
    new FranceTravailFetcher({
      baseUrl: config.baseUrl ?? FRANCE_TRAVAIL_PROVIDER_INFO.baseUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      romeCodes: config.romeCodes ?? FRANCE_TRAVAIL_DEFAULT_ROME_CODES,
      logger: config.logger,
      metrics: config.metrics,
      tracer: config.tracer,
    }),
    new FranceTravailMapper(),
    new FranceTravailNormalizer(),
    new DefaultSyncStrategy('france_travail'),
  );
}
