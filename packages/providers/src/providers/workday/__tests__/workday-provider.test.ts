import { describe, it, expect } from 'vitest';
import { createWorkdayProvider } from '../workday-provider.js';
import { WorkdayFetcher } from '../workday-fetcher.js';
import { WorkdayMapper } from '../workday-mapper.js';
import { WorkdayNormalizer } from '../workday-normalizer.js';
import { DefaultSyncStrategy } from '../../../interfaces/default-sync-strategy.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

describe('WorkdayProvider', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  describe('createWorkdayProvider', () => {
    it('should create a provider with correct info', () => {
      const provider = createWorkdayProvider({ tenant: 'acme', site: 'External', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.info.id).toBe('workday');
      expect(provider.info.name).toBe('Workday');
      expect(provider.info.supportsRemote).toBe(true);
    });

    it('should create a provider with correct capabilities, including offset pagination', () => {
      const provider = createWorkdayProvider({ tenant: 'acme', site: 'External', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.capabilities.search.supported).toBe(true);
      expect(provider.capabilities.pagination.strategy).toBe('offset');
      expect(provider.capabilities.characteristics.fullDescription).toBe(false);
    });

    it('should have all required components, reusing the shared sync strategy', () => {
      const provider = createWorkdayProvider({ tenant: 'acme', site: 'External', companyName: 'Acme Corp', logger, metrics, tracer });

      expect(provider.fetcher).toBeInstanceOf(WorkdayFetcher);
      expect(provider.mapper).toBeInstanceOf(WorkdayMapper);
      expect(provider.normalizer).toBeInstanceOf(WorkdayNormalizer);
      expect(provider.syncStrategy).toBeInstanceOf(DefaultSyncStrategy);
    });

    it('should default the host and allow overriding it', () => {
      const provider = createWorkdayProvider({
        tenant: 'acme',
        site: 'External',
        companyName: 'Acme Corp',
        host: 'wd5.myworkdayjobs.com',
        logger,
        metrics,
        tracer,
      });

      expect(provider.info.id).toBe('workday');
    });
  });
});
