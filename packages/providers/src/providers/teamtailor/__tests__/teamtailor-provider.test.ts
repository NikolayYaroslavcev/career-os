import { describe, it, expect } from 'vitest';
import { createTeamtailorProvider } from '../teamtailor-provider.js';
import { TeamtailorFetcher } from '../teamtailor-fetcher.js';
import { TeamtailorMapper } from '../teamtailor-mapper.js';
import { TeamtailorNormalizer } from '../teamtailor-normalizer.js';
import { DefaultSyncStrategy } from '../../../interfaces/default-sync-strategy.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

describe('TeamtailorProvider', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  describe('createTeamtailorProvider', () => {
    it('should create a provider with correct info, requiring an API key', () => {
      const provider = createTeamtailorProvider({ apiKey: 'tt-secret', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.info.id).toBe('teamtailor');
      expect(provider.info.name).toBe('Teamtailor');
      expect(provider.info.auth).toEqual({ type: 'api_key', requiresApiKey: true, requiresOAuth: false, optional: false });
    });

    it('should create a provider with correct capabilities, using page pagination', () => {
      const provider = createTeamtailorProvider({ apiKey: 'tt-secret', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.capabilities.search.supported).toBe(true);
      expect(provider.capabilities.pagination.strategy).toBe('page');
      expect(provider.capabilities.filtering.experienceLevels).toContain('senior');
    });

    it('should have all required components, reusing the shared sync strategy', () => {
      const provider = createTeamtailorProvider({ apiKey: 'tt-secret', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.fetcher).toBeInstanceOf(TeamtailorFetcher);
      expect(provider.mapper).toBeInstanceOf(TeamtailorMapper);
      expect(provider.normalizer).toBeInstanceOf(TeamtailorNormalizer);
      expect(provider.syncStrategy).toBeInstanceOf(DefaultSyncStrategy);
    });

    it('should default the base URL and allow overriding it', () => {
      const provider = createTeamtailorProvider({
        apiKey: 'tt-secret',
        companyName: 'Acme Corp',
        baseUrl: 'https://api.teamtailor.com/v1/jobs',
        logger,
        metrics,
        tracer,
      });

      expect(provider.info.baseUrl).toBe('https://api.teamtailor.com/v1/jobs');
    });
  });
});
