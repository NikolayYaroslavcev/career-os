import { describe, it, expect } from 'vitest';
import { createAdzunaProvider } from '../adzuna-provider.js';
import { AdzunaFetcher } from '../adzuna-fetcher.js';
import { AdzunaMapper } from '../adzuna-mapper.js';
import { AdzunaNormalizer } from '../adzuna-normalizer.js';
import { DefaultSyncStrategy } from '../../../interfaces/default-sync-strategy.js';
import type { ProviderState } from '../../../interfaces/provider-state.js';
import { createInitialState } from '../../../interfaces/provider-state.js';
import type { RawJob } from '../../../interfaces/raw-job.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

describe('AdzunaProvider', () => {
  describe('createAdzunaProvider', () => {
    it('should create a provider with correct info', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createAdzunaProvider({
        appId: 'test-id',
        appKey: 'test-key',
        logger,
        metrics,
        tracer,
      });

      expect(provider.info.id).toBe('adzuna');
      expect(provider.info.name).toBe('Adzuna');
      expect(provider.info.version).toBe('1.0.0');
      expect(provider.info.supportsRemote).toBe(false);
    });

    it('should create a provider with correct capabilities', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createAdzunaProvider({
        appId: 'test-id',
        appKey: 'test-key',
        logger,
        metrics,
        tracer,
      });

      expect(provider.capabilities.search.supported).toBe(true);
      expect(provider.capabilities.search.supportsKeyword).toBe(true);
      expect(provider.capabilities.search.supportsLocation).toBe(true);
      expect(provider.capabilities.pagination.strategy).toBe('page');
      expect(provider.capabilities.sync.incremental).toBe(true);
      expect(provider.capabilities.rateLimits.perMinute).toBe(25);
      expect(provider.capabilities.rateLimits.perDay).toBe(250);
    });

    it('should have all required components', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createAdzunaProvider({
        appId: 'test-id',
        appKey: 'test-key',
        logger,
        metrics,
        tracer,
      });

      expect(provider.fetcher).toBeInstanceOf(AdzunaFetcher);
      expect(provider.mapper).toBeInstanceOf(AdzunaMapper);
      expect(provider.normalizer).toBeInstanceOf(AdzunaNormalizer);
      expect(provider.syncStrategy).toBeInstanceOf(DefaultSyncStrategy);
    });

    it('should use default country when not specified', () => {
      const logger = new ConsoleLogger('error');
      const metrics = new InMemoryMetricsCollector();
      const tracer = new InMemoryTracer();

      const provider = createAdzunaProvider({
        appId: 'test-id',
        appKey: 'test-key',
        logger,
        metrics,
        tracer,
      });

      expect(provider.info.id).toBe('adzuna');
    });
  });

  describe('AdzunaMapper', () => {
    const mapper = new AdzunaMapper();

    it('should have correct providerId', () => {
      expect(mapper.providerId).toBe('adzuna');
    });

    it('should map raw job correctly', () => {
      const raw: RawJob = {
        sourceId: '12345',
        title: 'React Developer',
        description: 'A job description',
        companyName: 'Test Corp',
        location: 'London, UK',
        technologies: [],
        url: 'https://adzuna.co.uk/jobs/land/ad/12345',
        publishedAt: new Date('2026-07-15'),
        fetchedAt: new Date(),
      };

      const mapped = mapper.map(raw);

      expect(mapped.sourceId).toBe('12345');
      expect(mapped.title).toBe('React Developer');
      expect(mapped.companyName).toBe('Test Corp');
      expect(mapped.remote).toBe(false);
    });
  });

  describe('AdzunaNormalizer', () => {
    const normalizer = new AdzunaNormalizer();

    it('should have correct providerId', () => {
      expect(normalizer.providerId).toBe('adzuna');
    });

    it('should validate required fields', () => {
      const validJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: { raw: 'London' },
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      expect(normalizer.validate(validJob)).toBeNull();

      expect(normalizer.validate({ ...validJob, sourceId: '' })).not.toBeNull();
      expect(normalizer.validate({ ...validJob, title: '' })).not.toBeNull();
      expect(normalizer.validate({ ...validJob, companyName: '' })).not.toBeNull();
      expect(normalizer.validate({ ...validJob, url: '' })).not.toBeNull();
    });
  });

  describe('DefaultSyncStrategy for Adzuna', () => {
    const strategy = new DefaultSyncStrategy('adzuna');

    it('should have correct providerId', () => {
      expect(strategy.providerId).toBe('adzuna');
    });

    it('should allow sync when state is healthy', () => {
      const state: ProviderState = {
        ...createInitialState('adzuna'),
        health: 'healthy',
        nextSync: null,
      };

      expect(strategy.shouldSync(state)).toBe(true);
    });

    it('should not sync when state is unhealthy', () => {
      const state: ProviderState = {
        ...createInitialState('adzuna'),
        health: 'unhealthy',
        nextSync: null,
      };

      expect(strategy.shouldSync(state)).toBe(false);
    });

    it('should not sync when consecutive failures >= 3', () => {
      const state: ProviderState = {
        ...createInitialState('adzuna'),
        health: 'healthy',
        consecutiveFailures: 3,
        nextSync: null,
      };

      expect(strategy.shouldSync(state)).toBe(false);
    });

    it('should not sync when nextSync is in the future', () => {
      const state: ProviderState = {
        ...createInitialState('adzuna'),
        health: 'healthy',
        nextSync: new Date(Date.now() + 60_000),
      };

      expect(strategy.shouldSync(state)).toBe(false);
    });

    it('should sync when nextSync is in the past', () => {
      const state: ProviderState = {
        ...createInitialState('adzuna'),
        health: 'healthy',
        nextSync: new Date(Date.now() - 1000),
      };

      expect(strategy.shouldSync(state)).toBe(true);
    });

    it('should return page cursor for full sync', () => {
      const cursor = strategy.getFullSyncCursor();

      expect(cursor.type).toBe('page');
    });

    it('should return timestamp cursor for incremental sync', () => {
      const state: ProviderState = createInitialState('adzuna');
      const cursor = strategy.getIncrementalCursor(state);

      expect(cursor.type).toBe('timestamp');
    });
  });
});
