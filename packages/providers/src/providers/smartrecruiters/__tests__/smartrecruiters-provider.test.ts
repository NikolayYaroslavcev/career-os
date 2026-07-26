import { describe, it, expect } from 'vitest';
import { createSmartRecruitersProvider } from '../smartrecruiters-provider.js';
import { SmartRecruitersFetcher } from '../smartrecruiters-fetcher.js';
import { SmartRecruitersMapper } from '../smartrecruiters-mapper.js';
import { SmartRecruitersNormalizer } from '../smartrecruiters-normalizer.js';
import { DefaultSyncStrategy } from '../../../interfaces/default-sync-strategy.js';
import type { ProviderState } from '../../../interfaces/provider-state.js';
import { createInitialState } from '../../../interfaces/provider-state.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

describe('SmartRecruitersProvider', () => {
  describe('createSmartRecruitersProvider', () => {
    it('should create a provider with correct info', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createSmartRecruitersProvider({
        company: 'test-company',
        companyName: 'Test Company',
        logger,
        metrics,
        tracer,
      });

      expect(provider.info.id).toBe('smartrecruiters');
      expect(provider.info.name).toBe('SmartRecruiters');
      expect(provider.info.version).toBe('1.0.0');
      expect(provider.info.supportsRemote).toBe(false);
    });

    it('should create a provider with correct capabilities', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createSmartRecruitersProvider({
        company: 'test-company',
        companyName: 'Test Company',
        logger,
        metrics,
        tracer,
      });

      expect(provider.capabilities.search.supported).toBe(true);
      expect(provider.capabilities.search.supportsKeyword).toBe(true);
      expect(provider.capabilities.pagination.strategy).toBe('offset');
      expect(provider.capabilities.sync.incremental).toBe(true);
      expect(provider.capabilities.rateLimits.perMinute).toBe(60);
    });

    it('should have all required components', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createSmartRecruitersProvider({
        company: 'test-company',
        companyName: 'Test Company',
        logger,
        metrics,
        tracer,
      });

      expect(provider.fetcher).toBeInstanceOf(SmartRecruitersFetcher);
      expect(provider.mapper).toBeInstanceOf(SmartRecruitersMapper);
      expect(provider.normalizer).toBeInstanceOf(SmartRecruitersNormalizer);
      expect(provider.syncStrategy).toBeInstanceOf(DefaultSyncStrategy);
    });
  });

  describe('DefaultSyncStrategy for SmartRecruiters', () => {
    const strategy = new DefaultSyncStrategy('smartrecruiters');

    it('should have correct providerId', () => {
      expect(strategy.providerId).toBe('smartrecruiters');
    });

    it('should allow sync when state is healthy', () => {
      const state: ProviderState = {
        ...createInitialState('smartrecruiters'),
        health: 'healthy',
        nextSync: null,
      };

      expect(strategy.shouldSync(state)).toBe(true);
    });

    it('should not sync when state is unhealthy', () => {
      const state: ProviderState = {
        ...createInitialState('smartrecruiters'),
        health: 'unhealthy',
        nextSync: null,
      };

      expect(strategy.shouldSync(state)).toBe(false);
    });

    it('should not sync when consecutive failures >= 3', () => {
      const state: ProviderState = {
        ...createInitialState('smartrecruiters'),
        health: 'healthy',
        consecutiveFailures: 3,
        nextSync: null,
      };

      expect(strategy.shouldSync(state)).toBe(false);
    });
  });
});
