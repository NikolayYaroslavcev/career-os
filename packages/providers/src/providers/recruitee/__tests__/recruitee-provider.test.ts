import { describe, it, expect } from 'vitest';
import { createRecruiteeProvider } from '../recruitee-provider.js';
import { RecruiteeFetcher } from '../recruitee-fetcher.js';
import { RecruiteeMapper } from '../recruitee-mapper.js';
import { RecruiteeNormalizer } from '../recruitee-normalizer.js';
import { DefaultSyncStrategy } from '../../../interfaces/default-sync-strategy.js';
import type { ProviderState } from '../../../interfaces/provider-state.js';
import { createInitialState } from '../../../interfaces/provider-state.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

describe('RecruiteeProvider', () => {
  describe('createRecruiteeProvider', () => {
    it('should create a provider with correct info', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createRecruiteeProvider({
        company: 'test-company',
        companyName: 'Test Company',
        logger,
        metrics,
        tracer,
      });

      expect(provider.info.id).toBe('recruitee');
      expect(provider.info.name).toBe('Recruitee');
      expect(provider.info.version).toBe('1.0.0');
    });

    it('should have all required components', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createRecruiteeProvider({
        company: 'test-company',
        companyName: 'Test Company',
        logger,
        metrics,
        tracer,
      });

      expect(provider.fetcher).toBeInstanceOf(RecruiteeFetcher);
      expect(provider.mapper).toBeInstanceOf(RecruiteeMapper);
      expect(provider.normalizer).toBeInstanceOf(RecruiteeNormalizer);
      expect(provider.syncStrategy).toBeInstanceOf(DefaultSyncStrategy);
    });
  });

  describe('DefaultSyncStrategy for Recruitee', () => {
    const strategy = new DefaultSyncStrategy('recruitee');

    it('should have correct providerId', () => {
      expect(strategy.providerId).toBe('recruitee');
    });

    it('should allow sync when state is healthy', () => {
      const state: ProviderState = {
        ...createInitialState('recruitee'),
        health: 'healthy',
        nextSync: null,
      };

      expect(strategy.shouldSync(state)).toBe(true);
    });

    it('should not sync when state is unhealthy', () => {
      const state: ProviderState = {
        ...createInitialState('recruitee'),
        health: 'unhealthy',
        nextSync: null,
      };

      expect(strategy.shouldSync(state)).toBe(false);
    });
  });
});
