import { describe, it, expect, beforeEach } from 'vitest';
import { FakeProvider, type FakeProviderBehavior } from './fake-provider.js';
import { ProviderRegistry } from '../registry/provider-registry.js';
import { TokenBucketRateLimiter } from '../rate-limit/rate-limiter.js';
import { RetryPolicy, DEFAULT_RETRY_CONFIG } from '../retry/retry-policy.js';
import { ProviderHealthMonitor } from '../health/provider-health-monitor.js';
import { DeduplicationEngine } from '../deduplication/deduplication-engine.js';
import { DefaultNormalizationPipeline } from '../normalization/normalization-pipeline.js';
import { PipelineOrchestratorImpl } from '../pipeline/pipeline-orchestrator.js';
import { createPipelineRunId } from '../pipeline/stage-types.js';
import { InMemoryMetricsCollector, PROVIDER_METRICS } from '../observability/metrics.js';
import { ConsoleLogger, NoopLogger } from '../observability/logger.js';
import { InMemoryTracer, NoopTracer } from '../observability/tracer.js';
import { ProviderErrorType } from '../errors/provider-errors.js';
import { createInitialCursor, advanceCursor } from '../interfaces/sync-cursor.js';
import { createInitialState } from '../interfaces/provider-state.js';
import type { ProviderResult } from '../interfaces/result.js';
import type { NormalizedVacancy } from '../interfaces/normalized-vacancy.js';
import type { ProviderJob } from '../interfaces/provider-job.js';

function createVacancy(overrides: Partial<NormalizedVacancy> = {}): NormalizedVacancy {
  return {
    id: 'test:1',
    source: 'test',
    sourceId: '1',
    title: 'Software Engineer',
    description: 'Build great things',
    companyName: 'Tech Corp',
    location: { raw: 'Remote', remoteEligible: true },
    technologies: ['typescript', 'react'],
    url: 'https://example.com/job/1',
    publishedAt: new Date('2024-01-01'),
    fetchedAt: new Date(),
    remote: { level: 'remote_only', explicit: true },
    normalizedAt: new Date(),
    contentHash: 'abc123',
    ...overrides,
  };
}

describe('Provider SDK Stress Test - 100 Providers', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('should register 100 providers without degradation', () => {
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      const provider = new FakeProvider(`provider-${i}`);
      registry.register(provider);
    }
    const duration = Date.now() - start;

    expect(registry.getAll()).toHaveLength(100);
    expect(duration).toBeLessThan(1000);
  });

  it('should initialize 100 providers concurrently', async () => {
    for (let i = 0; i < 100; i++) {
      registry.register(new FakeProvider(`provider-${i}`));
    }

    const start = Date.now();
    const configs = new Map<string, Record<string, string>>();
    for (let i = 0; i < 100; i++) {
      configs.set(`provider-${i}`, { apiKey: 'test' });
    }
    await registry.initializeAll(configs);
    const duration = Date.now() - start;

    for (let i = 0; i < 100; i++) {
      expect(registry.isReady(`provider-${i}`)).toBe(true);
    }
    expect(duration).toBeLessThan(5000);
  });

  it('should search across 100 providers independently', async () => {
    const behaviors: FakeProviderBehavior[] = [
      { fetchResult: 'success', jobsToReturn: 5 },
      { fetchResult: 'timeout' },
      { fetchResult: 'network_error' },
      { fetchResult: 'rate_limited' },
      { fetchResult: 'malformed' },
      { fetchResult: 'success', jobsToReturn: 50, duplicateRate: 0.2 },
      { fetchResult: 'partial', jobsToReturn: 3 },
    ];

    for (let i = 0; i < 100; i++) {
      const behavior = behaviors[i % behaviors.length]!;
      registry.register(new FakeProvider(`provider-${i}`, behavior));
    }

    const results = await Promise.allSettled(
      Array.from({ length: 100 }, (_, i) => {
        const provider = registry.get(`provider-${i}`);
        return provider.search({});
      }),
    );

    let successes = 0;
    let failures = 0;
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.ok) successes++;
      else failures++;
    }

    expect(successes + failures).toBe(100);
    expect(successes).toBeGreaterThan(0);
    expect(failures).toBeGreaterThan(0);
  });

  it('should handle health checks for 100 providers', async () => {
    for (let i = 0; i < 100; i++) {
      const behavior: FakeProviderBehavior = i % 2 === 0
        ? { healthResult: 'healthy' }
        : { healthResult: 'unhealthy' };
      registry.register(new FakeProvider(`provider-${i}`, behavior));
    }

    const monitor = new ProviderHealthMonitor({
      checkIntervalMs: 60000,
      unhealthyThreshold: 3,
      degradedThresholdMs: 500,
      healthyThresholdMs: 200,
    });

    const start = Date.now();
    const results = await monitor.checkAll(registry.getAll());
    const duration = Date.now() - start;

    expect(results).toHaveLength(100);
    expect(duration).toBeLessThan(10000);

    const healthy = results.filter((r) => r.state === 'healthy');
    const unhealthy = results.filter((r) => r.state === 'unhealthy');

    expect(healthy.length + unhealthy.length).toBe(100);
    expect(healthy.length).toBe(50);
    expect(unhealthy.length).toBe(50);
  });
});

describe('Registry Performance', () => {
  it('should perform O(1) lookups for 1000 providers', () => {
    const registry = new ProviderRegistry();
    for (let i = 0; i < 1000; i++) {
      registry.register(new FakeProvider(`provider-${i}`));
    }

    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      registry.get(`provider-${Math.floor(Math.random() * 1000)}`);
    }
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('should filter by capability efficiently', () => {
    const registry = new ProviderRegistry();
    for (let i = 0; i < 100; i++) {
      registry.register(new FakeProvider(`provider-${i}`));
    }

    const start = Date.now();
    const result = registry.getByCapability('search');
    const duration = Date.now() - start;

    expect(result).toHaveLength(100);
    expect(duration).toBeLessThan(50);
  });
});

describe('Pipeline Execution', () => {
  it('should execute full pipeline with 10 stages', async () => {
    const orchestrator = new PipelineOrchestratorImpl({
      maxConcurrency: 10,
      stageTimeoutMs: 30000,
      retryPolicy: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2, retryableStages: [] },
      deadLetterQueue: true,
      observability: { metricsEnabled: true, loggingLevel: 'info', tracingEnabled: true, dashboardEnabled: false },
    });

    for (let i = 0; i < 10; i++) {
      orchestrator.addStage(`stage-${i}`, async (input: unknown) => ({
        status: 'success' as const,
        data: input,
        durationMs: 1,
        warnings: [],
      }));
    }

    const run = await orchestrator.execute({
      runId: createPipelineRunId(),
      providerId: 'test',
      workspaceId: 'workspace-1',
      startedAt: new Date(),
      metadata: {},
    });

    expect(run.status).toBe('completed');
    expect(run.stages).toHaveLength(10);
    expect(run.completedAt).toBeDefined();
  });

  it('should handle partial pipeline failure with retry', async () => {
    const orchestrator = new PipelineOrchestratorImpl({
      maxConcurrency: 5,
      stageTimeoutMs: 30000,
      retryPolicy: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2, retryableStages: [] },
      deadLetterQueue: true,
      observability: { metricsEnabled: true, loggingLevel: 'info', tracingEnabled: true, dashboardEnabled: false },
    });

    let fetchAttempts = 0;
    orchestrator.addStage('fetch', async () => {
      fetchAttempts++;
      if (fetchAttempts < 3) {
        return {
          status: 'failure' as const,
          error: { code: 'NETWORK_ERROR', message: 'Connection refused', stage: 'fetch' },
          retryable: true,
          durationMs: 10,
        };
      }
      return { status: 'success' as const, data: 'fetched', durationMs: 10, warnings: [] };
    }, 3);

    orchestrator.addStage('process', async (input: unknown) => ({
      status: 'success' as const,
      data: `processed-${input}`,
      durationMs: 1,
      warnings: [],
    }));

    const run = await orchestrator.execute({
      runId: createPipelineRunId(),
      providerId: 'test',
      workspaceId: 'workspace-1',
      startedAt: new Date(),
      metadata: {},
    });

    expect(run.status).toBe('completed');
    expect(fetchAttempts).toBe(3);
  });
});

describe('Deduplication Engine', () => {
  it('should deduplicate 1000 vacancies efficiently', () => {
    const engine = new DeduplicationEngine({
      keyFields: ['contentHash'],
      similarityThreshold: 0.8,
      timeWindowMs: 86400000,
      enableFuzzyMatching: false,
    });

    const jobs: NormalizedVacancy[] = [];
    for (let i = 0; i < 500; i++) {
      jobs.push(createVacancy({ id: `a:${i}`, source: 'provider-a', sourceId: String(i), contentHash: `hash-${i}` }));
    }
    for (let i = 0; i < 500; i++) {
      jobs.push(createVacancy({ id: `b:${i}`, source: 'provider-b', sourceId: String(i + 500), contentHash: `hash-${i}` }));
    }

    const start = Date.now();
    const result = engine.deduplicate(jobs);
    const duration = Date.now() - start;

    expect(result.unique).toHaveLength(500);
    expect(result.duplicates).toHaveLength(500);
    expect(result.stats.totalInput).toBe(1000);
    expect(result.stats.duplicatesFound).toBe(500);
    expect(duration).toBeLessThan(1000);
  });

  it('should deduplicate cross-provider vacancies', () => {
    const engine = new DeduplicationEngine({
      keyFields: ['contentHash'],
      similarityThreshold: 0.8,
      timeWindowMs: 86400000,
      enableFuzzyMatching: false,
    });

    const jobs = [
      createVacancy({ source: 'hh', contentHash: 'same-hash' }),
      createVacancy({ source: 'linkedin', contentHash: 'same-hash' }),
      createVacancy({ source: 'habr', contentHash: 'same-hash' }),
      createVacancy({ source: 'remoteok', contentHash: 'unique-hash' }),
    ];

    const result = engine.deduplicate(jobs);

    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.sources).toContain('hh');
    expect(result.duplicates[0]?.sources).toContain('linkedin');
    expect(result.duplicates[0]?.sources).toContain('habr');
  });
});

describe('Rate Limiter Performance', () => {
  it('should handle 10000 concurrent acquisitions', async () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 10000,
      refillRate: 1000,
      refillIntervalMs: 1000,
    });

    const start = Date.now();
    const results = await Promise.all(
      Array.from({ length: 10000 }, (_, i) => limiter.acquire(`key-${i % 10}`)),
    );
    const duration = Date.now() - start;

    const acquired = results.filter((r) => r === true);
    expect(acquired.length).toBe(10000);
    expect(duration).toBeLessThan(1000);
  });

  it('should correctly track per-key status', async () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillRate: 1,
      refillIntervalMs: 1000,
    });

    for (let i = 0; i < 3; i++) {
      await limiter.acquire('key-a');
    }

    const statusA = limiter.getStatus('key-a');
    const statusB = limiter.getStatus('key-b');

    expect(statusA.available).toBe(2);
    expect(statusB.available).toBe(5);
  });
});

describe('Retry Policy', () => {
  it('should retry with exponential backoff', async () => {
    const policy = new RetryPolicy({
      ...DEFAULT_RETRY_CONFIG,
      maxAttempts: 5,
      baseDelayMs: 10,
      jitter: false,
    });

    let attempts = 0;
    const operation = async (): Promise<ProviderResult<string>> => {
      attempts++;
      if (attempts < 4) {
        return {
          ok: false,
          error: ProviderErrorType.NETWORK_ERROR,
          message: 'Network error',
          retryable: true,
          meta: { durationMs: 0 },
        };
      }
      return { ok: true, data: 'success', meta: { durationMs: 0 } };
    };

    const result = await policy.execute(operation, { providerId: 'test', operation: 'fetch' });

    expect(result.ok).toBe(true);
    expect(attempts).toBe(4);
  });

  it('should stop retrying on non-retryable error', async () => {
    const policy = new RetryPolicy({
      ...DEFAULT_RETRY_CONFIG,
      maxAttempts: 5,
      baseDelayMs: 10,
    });

    let attempts = 0;
    const operation = async (): Promise<ProviderResult<string>> => {
      attempts++;
      return {
        ok: false,
        error: ProviderErrorType.AUTHENTICATION_ERROR,
        message: 'Auth failed',
        retryable: false,
        meta: { durationMs: 0 },
      };
    };

    const result = await policy.execute(operation, { providerId: 'test', operation: 'fetch' });

    expect(result.ok).toBe(false);
    expect(attempts).toBe(1);
  });
});

describe('Normalization Pipeline', () => {
  it('should normalize 1000 jobs efficiently', () => {
    const pipeline = new DefaultNormalizationPipeline();

    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      pipeline.normalize('test', {
        sourceId: String(i),
        title: `Senior Software Engineer ${i}`,
        description: `<p>Build great things with TypeScript and React. Junior level preferred.</p>`,
        companyName: `Tech Corp ${i}`,
        location: { raw: 'New York, US', city: 'New York', country: 'US' },
        salary: { min: 100000, max: 150000, currency: 'USD', period: 'yearly' },
        technologies: ['TypeScript', 'React', 'Node.js'],
        url: `https://example.com/job/${i}`,
        publishedAt: new Date('2024-01-01'),
        fetchedAt: new Date(),
        remote: true,
        employmentType: 'full_time',
      });
    }
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000);
  });

  it('should generate consistent content hashes', () => {
    const pipeline = new DefaultNormalizationPipeline();
    const job = {
      sourceId: '1',
      title: 'React Developer',
      description: 'desc',
      companyName: 'Company',
      location: { raw: 'Remote' },
      technologies: ['react'],
      url: 'https://example.com',
      publishedAt: new Date(),
      fetchedAt: new Date(),
    };

    const result1 = pipeline.normalize('test', job);
    const result2 = pipeline.normalize('test', job);

    expect(result1.contentHash).toBe(result2.contentHash);
  });

  it('should infer experience levels correctly', () => {
    const pipeline = new DefaultNormalizationPipeline();

    const cases = [
      { title: 'Junior Developer', expected: 'junior' },
      { title: 'Senior Engineer', expected: 'senior' },
      { title: 'Lead Architect', expected: 'lead' },
      { title: 'Intern Position', expected: 'intern' },
      { title: 'Principal Engineer', expected: 'principal' },
      { title: 'Middle Developer', expected: 'middle' },
    ];

    for (const { title, expected } of cases) {
      const result = pipeline.normalize('test', {
        sourceId: '1',
        title,
        description: 'desc',
        companyName: 'Company',
        location: { raw: 'Remote' },
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      });
      expect(result.experienceLevel).toBe(expected);
    }
  });
});

describe('Health Monitor', () => {
  it('should track health across multiple providers', async () => {
    const monitor = new ProviderHealthMonitor({
      checkIntervalMs: 60000,
      unhealthyThreshold: 3,
      degradedThresholdMs: 500,
      healthyThresholdMs: 200,
    });

    const providers: ProviderJob[] = [];
    for (let i = 0; i < 20; i++) {
      providers.push(new FakeProvider(`provider-${i}`, {
        healthResult: i % 2 === 0 ? 'healthy' : 'unhealthy',
      }));
    }

    const results = await monitor.checkAll(providers);

    expect(results).toHaveLength(20);
    const statuses = monitor.getAllStatuses();
    expect(statuses).toHaveLength(20);

    const healthyCount = statuses.filter((s) => s.state === 'healthy').length;
    const unhealthyCount = statuses.filter((s) => s.state === 'unhealthy').length;
    expect(healthyCount).toBe(10);
    expect(unhealthyCount).toBe(10);
  });

  it('should calculate average latency correctly', async () => {
    const monitor = new ProviderHealthMonitor({
      checkIntervalMs: 60000,
      unhealthyThreshold: 3,
      degradedThresholdMs: 500,
      healthyThresholdMs: 200,
    });

    const provider = new FakeProvider('test', { healthResult: 'healthy' });
    await monitor.checkProvider(provider);

    const status = monitor.getStatus('test');
    expect(status).toBeDefined();
    expect(status?.avgLatencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe('FakeProvider SDK Validation', () => {
  it('should handle success behavior', async () => {
    const provider = new FakeProvider('test-success', { fetchResult: 'success', jobsToReturn: 5 });
    await provider.initialize({});

    const result = await provider.search({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.vacancies).toHaveLength(5);
    }
  });

  it('should handle timeout behavior', async () => {
    const provider = new FakeProvider('test-timeout', { fetchResult: 'timeout' });
    await provider.initialize({});

    const result = await provider.search({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(ProviderErrorType.NETWORK_ERROR);
      expect(result.retryable).toBe(true);
    }
  });

  it('should handle retry behavior', async () => {
    const provider = new FakeProvider('test-retry', { fetchResult: 'network_error' });
    await provider.initialize({});

    const result = await provider.search({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(ProviderErrorType.NETWORK_ERROR);
    }
  });

  it('should handle malformed data behavior', async () => {
    const provider = new FakeProvider('test-malformed', { fetchResult: 'malformed' });
    await provider.initialize({});

    const result = await provider.search({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(ProviderErrorType.INVALID_RESPONSE);
      expect(result.retryable).toBe(false);
    }
  });

  it('should handle partial failures', async () => {
    const provider = new FakeProvider('test-partial', { fetchResult: 'success', jobsToReturn: 10 });
    await provider.initialize({});

    const result = await provider.search({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.vacancies.length).toBeGreaterThan(0);
    }
  });

  it('should handle duplicate vacancies', async () => {
    const provider = new FakeProvider('test-duplicates', {
      fetchResult: 'success',
      jobsToReturn: 10,
      duplicateRate: 0.5,
    });
    await provider.initialize({});

    const result = await provider.search({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.vacancies.length).toBeGreaterThan(10);
    }
  });

  it('should perform health check', async () => {
    const healthyProvider = new FakeProvider('healthy', { healthResult: 'healthy' });
    const unhealthyProvider = new FakeProvider('unhealthy', { healthResult: 'unhealthy' });

    const healthyResult = await healthyProvider.healthCheck();
    const unhealthyResult = await unhealthyProvider.healthCheck();

    expect(healthyResult.healthy).toBe(true);
    expect(unhealthyResult.healthy).toBe(false);
  });

  it('should sync with state updates', async () => {
    const provider = new FakeProvider('test-sync', { fetchResult: 'success', jobsToReturn: 5 });
    await provider.initialize({});

    const result = await provider.sync();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.imported).toHaveLength(5);
      expect(result.data.stateUpdates.changes.lastSync).toBeDefined();
      expect(result.data.stateUpdates.changes.importedCount).toBe(5);
    }
  });

  it('should dispose cleanly', async () => {
    const provider = new FakeProvider('test-dispose');
    await provider.initialize({});
    await provider.dispose();

    const result = await provider.search({});
    expect(result.ok).toBe(true);
  });
});

describe('Observability Integration', () => {
  it('should collect metrics across all components', () => {
    const metrics = new InMemoryMetricsCollector();

    metrics.incrementCounter(PROVIDER_METRICS.FETCH_SUCCESS, 10, { providerId: 'test' });
    metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, 100, { providerId: 'test' });
    metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, 150, { providerId: 'test' });
    metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, 200, { providerId: 'test' });
    metrics.setGauge('provider.health.status', 1, { providerId: 'test' });

    expect(metrics.getCounter(PROVIDER_METRICS.FETCH_SUCCESS)).toBe(10);
    expect(metrics.getCounter(PROVIDER_METRICS.VACANCIES_FETCHED)).toBe(100);

    const histogram = metrics.getHistogramStats(PROVIDER_METRICS.FETCH_DURATION);
    expect(histogram).toBeDefined();
    expect(histogram?.count).toBe(2);
    expect(histogram?.min).toBe(150);
    expect(histogram?.max).toBe(200);
    expect(histogram?.avg).toBe(175);

    expect(metrics.getGauge('provider.health.status')).toBe(1);
  });

  it('should trace spans correctly', () => {
    const tracer = new InMemoryTracer();

    const span1 = tracer.startSpan('fetch', { providerId: 'test' });
    span1.setAttribute('jobs.fetched', 10);
    span1.addEvent('fetch.started');
    span1.end();

    const span2 = tracer.startSpan('normalize', { providerId: 'test' });
    span2.setAttribute('jobs.normalized', 10);
    span2.end();

    const spans = tracer.getSpans();
    expect(spans).toHaveLength(2);
    expect(spans[0]?.name).toBe('fetch');
    expect(spans[0]?.attributes['jobs.fetched']).toBe(10);
    expect(spans[0]?.events).toHaveLength(1);
    expect(spans[0]?.endedAt).toBeDefined();
    expect(spans[1]?.name).toBe('normalize');
  });

  it('should log at correct levels', () => {
    const logs: string[] = [];
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.info = (...args: unknown[]) => logs.push(JSON.stringify(args));
    console.warn = (...args: unknown[]) => logs.push(JSON.stringify(args));
    console.error = (...args: unknown[]) => logs.push(JSON.stringify(args));

    const logger = new ConsoleLogger('warn');
    logger.debug('should not appear');
    logger.info('should not appear');
    logger.warn('warning message');
    logger.error('error message');

    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;

    expect(logs).toHaveLength(2);
  });

  it('should have noop implementations that do not throw', () => {
    const noopLogger = new NoopLogger();
    const noopMetrics = new InMemoryMetricsCollector();
    const noopTracer = new NoopTracer();

    noopLogger.debug('test');
    noopLogger.info('test');
    noopLogger.warn('test');
    noopLogger.error('test');

    noopMetrics.incrementCounter('test');
    noopMetrics.recordHistogram('test', 100);
    noopMetrics.setGauge('test', 1);

    const span = noopTracer.startSpan('test');
    span.setAttribute('key', 'value');
    span.addEvent('event');
    span.end();

    expect(true).toBe(true);
  });
});

describe('Sync Cursor Operations', () => {
  it('should create and advance all cursor types', () => {
    const strategies = ['page', 'offset', 'timestamp', 'cursor', 'none'] as const;

    for (const strategy of strategies) {
      const cursor = createInitialCursor(strategy);
      expect(cursor.strategy).toBe(strategy);
      expect(cursor.fetchedCount).toBe(0);

      if (strategy !== 'none') {
        const advanced = advanceCursor(cursor, { count: 10, hasMore: true });
        expect(advanced.fetchedCount).toBe(10);
        expect(advanced.exhausted).toBe(false);
      }
    }
  });

  it('should handle exhaustion correctly', () => {
    const cursor = createInitialCursor('page');
    const exhausted = advanceCursor(cursor, { count: 10, hasMore: false });

    expect(exhausted.exhausted).toBe(true);
    expect(exhausted.fetchedCount).toBe(10);
  });
});

describe('Provider State Management', () => {
  it('should create correct initial state', () => {
    const state = createInitialState('test-provider');

    expect(state.providerId).toBe('test-provider');
    expect(state.lastSync).toBeNull();
    expect(state.health).toBe('unknown');
    expect(state.importedCount).toBe(0);
    expect(state.consecutiveFailures).toBe(0);
    expect(state.totalRequests).toBe(0);
  });

  it('should handle state updates via sync', async () => {
    const provider = new FakeProvider('test-state', { fetchResult: 'success', jobsToReturn: 3 });
    await provider.initialize({});

    const result = await provider.sync();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.stateUpdates.changes.lastSync).toBeDefined();
      expect(result.data.stateUpdates.changes.importedCount).toBe(3);
      expect(result.data.stateUpdates.changes.consecutiveFailures).toBe(0);
    }
  });
});
