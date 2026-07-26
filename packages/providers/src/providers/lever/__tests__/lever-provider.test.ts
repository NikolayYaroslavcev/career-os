import { describe, it, expect } from 'vitest';
import { createLeverProvider } from '../lever-provider.js';
import { LeverFetcher } from '../lever-fetcher.js';
import { LeverMapper } from '../lever-mapper.js';
import { LeverNormalizer } from '../lever-normalizer.js';
import { DefaultSyncStrategy } from '../../../interfaces/default-sync-strategy.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

describe('LeverProvider', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  describe('createLeverProvider', () => {
    it('should create a provider with correct info', () => {
      const provider = createLeverProvider({ company: 'acme', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.info.id).toBe('lever');
      expect(provider.info.name).toBe('Lever');
      expect(provider.info.supportsRemote).toBe(true);
    });

    it('should create a provider with correct capabilities', () => {
      const provider = createLeverProvider({ company: 'acme', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.capabilities.search.supported).toBe(true);
      expect(provider.capabilities.pagination.strategy).toBe('offset');
      expect(provider.capabilities.pagination.defaultPageSize).toBe(100);
      expect(provider.capabilities.sync.incremental).toBe(true);
    });

    it('should have all required components, reusing the shared sync strategy', () => {
      const provider = createLeverProvider({ company: 'acme', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.fetcher).toBeInstanceOf(LeverFetcher);
      expect(provider.mapper).toBeInstanceOf(LeverMapper);
      expect(provider.normalizer).toBeInstanceOf(LeverNormalizer);
      expect(provider.syncStrategy).toBeInstanceOf(DefaultSyncStrategy);
    });

    it('should default the base URL and allow overriding it', () => {
      const provider = createLeverProvider({
        company: 'acme',
        companyName: 'Acme Corp',
        baseUrl: 'https://api.lever.co/v0/postings',
        logger,
        metrics,
        tracer,
      });

      expect(provider.info.baseUrl).toBe('https://api.lever.co/v0/postings');
    });
  });
});
