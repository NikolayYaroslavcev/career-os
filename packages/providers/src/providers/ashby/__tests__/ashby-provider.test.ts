import { describe, it, expect } from 'vitest';
import { createAshbyProvider } from '../ashby-provider.js';
import { AshbyFetcher } from '../ashby-fetcher.js';
import { AshbyMapper } from '../ashby-mapper.js';
import { AshbyNormalizer } from '../ashby-normalizer.js';
import { DefaultSyncStrategy } from '../../../interfaces/default-sync-strategy.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

describe('AshbyProvider', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  describe('createAshbyProvider', () => {
    it('should create a provider with correct info', () => {
      const provider = createAshbyProvider({ jobBoardName: 'acme', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.info.id).toBe('ashby');
      expect(provider.info.name).toBe('Ashby');
      expect(provider.info.supportsRemote).toBe(true);
    });

    it('should create a provider with correct capabilities', () => {
      const provider = createAshbyProvider({ jobBoardName: 'acme', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.capabilities.search.supported).toBe(true);
      expect(provider.capabilities.pagination.strategy).toBe('none');
      expect(provider.capabilities.sync.incremental).toBe(true);
      expect(provider.capabilities.filtering.technologyFilter).toBe(false);
      expect(provider.capabilities.filtering.salaryFilter).toBe(false);
      expect(provider.capabilities.characteristics.salaryData).toBe(false);
    });

    it('should have all required components, reusing the shared sync strategy', () => {
      const provider = createAshbyProvider({ jobBoardName: 'acme', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.fetcher).toBeInstanceOf(AshbyFetcher);
      expect(provider.mapper).toBeInstanceOf(AshbyMapper);
      expect(provider.normalizer).toBeInstanceOf(AshbyNormalizer);
      expect(provider.syncStrategy).toBeInstanceOf(DefaultSyncStrategy);
    });

    it('should default the base URL and allow overriding it', () => {
      const provider = createAshbyProvider({
        jobBoardName: 'acme',
        companyName: 'Acme Corp',
        baseUrl: 'https://api.ashbyhq.com/posting-api/job-board',
        logger,
        metrics,
        tracer,
      });

      expect(provider.info.baseUrl).toBe('https://api.ashbyhq.com/posting-api/job-board');
    });
  });
});
