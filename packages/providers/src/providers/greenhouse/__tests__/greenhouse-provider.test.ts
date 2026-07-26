import { describe, it, expect } from 'vitest';
import { createGreenhouseProvider } from '../greenhouse-provider.js';
import { GreenhouseFetcher } from '../greenhouse-fetcher.js';
import { GreenhouseMapper } from '../greenhouse-mapper.js';
import { GreenhouseNormalizer } from '../greenhouse-normalizer.js';
import { DefaultSyncStrategy } from '../../../interfaces/default-sync-strategy.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

describe('GreenhouseProvider', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  describe('createGreenhouseProvider', () => {
    it('should create a provider with correct info', () => {
      const provider = createGreenhouseProvider({ boardToken: 'acme', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.info.id).toBe('greenhouse');
      expect(provider.info.name).toBe('Greenhouse');
      expect(provider.info.supportsRemote).toBe(true);
    });

    it('should create a provider with correct capabilities', () => {
      const provider = createGreenhouseProvider({ boardToken: 'acme', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.capabilities.search.supported).toBe(true);
      expect(provider.capabilities.pagination.strategy).toBe('none');
      expect(provider.capabilities.sync.incremental).toBe(true);
    });

    it('should have all required components, reusing the shared sync strategy', () => {
      const provider = createGreenhouseProvider({ boardToken: 'acme', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.fetcher).toBeInstanceOf(GreenhouseFetcher);
      expect(provider.mapper).toBeInstanceOf(GreenhouseMapper);
      expect(provider.normalizer).toBeInstanceOf(GreenhouseNormalizer);
      expect(provider.syncStrategy).toBeInstanceOf(DefaultSyncStrategy);
    });

    it('should default the base URL and allow overriding it', () => {
      const provider = createGreenhouseProvider({
        boardToken: 'acme',
        companyName: 'Acme Corp',
        baseUrl: 'https://boards-api.greenhouse.io/v1/boards',
        logger,
        metrics,
        tracer,
      });

      expect(provider.info.baseUrl).toBe('https://boards-api.greenhouse.io/v1/boards');
    });
  });
});
