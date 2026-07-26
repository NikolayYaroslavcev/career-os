import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RemoteOKFetcher } from '../providers/remoteok/remoteok-fetcher.js';
import { RemoteOKMapper } from '../providers/remoteok/remoteok-mapper.js';
import { RemoteOKNormalizer } from '../providers/remoteok/remoteok-normalizer.js';
import { RemoteOKSyncStrategy } from '../providers/remoteok/remoteok-sync-strategy.js';
import { createRemoteOKProvider } from '../providers/remoteok/remoteok-provider.js';
import { ConsoleLogger } from '../observability/logger.js';
import { InMemoryMetricsCollector } from '../observability/metrics.js';
import { InMemoryTracer } from '../observability/tracer.js';
import { createInitialState } from '../interfaces/provider-state.js';
import type { RawJob } from '../interfaces/raw-job.js';
import type { MappedJob } from '../interfaces/mapper.js';

const mockApiResponse = [
  {
    last_updated: 1784102593,
    legal: 'API Terms of Service',
  },
  {
    id: '1134805',
    slug: 'remote-senior-react-developer-techcorp-1134805',
    epoch: 1784030676,
    date: '2026-07-14T12:04:36+00:00',
    company: 'TechCorp',
    company_logo: 'https://example.com/logo.png',
    position: 'Senior React Developer',
    tags: ['react', 'typescript', 'javascript', 'node.js', 'full time'],
    description: '<p>We are looking for a Senior React Developer with 5+ years of experience.</p>',
    location: 'New York, US',
    apply_url: 'https://remoteOK.com/remote-jobs/remote-senior-react-developer-techcorp-1134805',
    salary_min: 120000,
    salary_max: 150000,
    logo: 'https://example.com/logo.png',
    url: 'https://remoteOK.com/remote-jobs/remote-senior-react-developer-techcorp-1134805',
  },
];

describe('RemoteOKFetcher', () => {
  let fetcher: RemoteOKFetcher;
  let logger: ConsoleLogger;
  let metrics: InMemoryMetricsCollector;
  let tracer: InMemoryTracer;

  beforeEach(() => {
    logger = new ConsoleLogger('error');
    metrics = new InMemoryMetricsCollector();
    tracer = new InMemoryTracer();

    fetcher = new RemoteOKFetcher({
      baseUrl: 'https://remoteok.com/api',
      logger,
      metrics,
      tracer,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });
  });

  it('should fetch jobs successfully', async () => {
    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.sourceId).toBe('1134805');
      expect(result.data[0]?.title).toBe('Senior React Developer');
    }
  });

  it('should return error when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetcher.search({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('UNKNOWN_ERROR');
    }
  });

  it('should ping successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
    });

    const result = await fetcher.ping();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(true);
    }
  });
});

describe('RemoteOKMapper', () => {
  let mapper: RemoteOKMapper;

  beforeEach(() => {
    mapper = new RemoteOKMapper();
  });

  it('should map raw job to mapped job', () => {
    const rawJob: RawJob = {
      sourceId: '1134805',
      title: 'Senior React Developer',
      description: '<p>We are looking for a Senior React Developer.</p>',
      companyName: 'TechCorp',
      location: 'New York, US',
      salary: {
        from: 120000,
        to: 150000,
        currency: 'USD',
        period: 'yearly',
      },
      technologies: ['react', 'typescript', 'javascript'],
      url: 'https://remoteOK.com/remote-jobs/remote-senior-react-developer-techcorp-1134805',
      publishedAt: new Date('2026-07-14T12:04:36+00:00'),
      remote: true,
      fetchedAt: new Date(),
    };

    const mapped = mapper.map(rawJob);

    expect(mapped.sourceId).toBe('1134805');
    expect(mapped.title).toBe('Senior React Developer');
    expect(mapped.description).toBe('We are looking for a Senior React Developer.');
    expect(mapped.companyName).toBe('TechCorp');
    expect(mapped.location.raw).toBe('New York, US');
    expect(mapped.location.city).toBe('New York');
    expect(mapped.location.country).toBe('US');
    expect(mapped.salary?.min).toBe(120000);
    expect(mapped.salary?.max).toBe(150000);
    expect(mapped.technologies).toEqual(['react', 'typescript', 'javascript']);
    expect(mapped.remote).toBe(true);
  });

  it('should handle empty location', () => {
    const rawJob: RawJob = {
      sourceId: '1134805',
      title: 'Senior React Developer',
      description: '<p>Job description</p>',
      companyName: 'TechCorp',
      location: '',
      technologies: ['react'],
      url: 'https://example.com',
      publishedAt: new Date(),
      remote: true,
      fetchedAt: new Date(),
    };

    const mapped = mapper.map(rawJob);

    expect(mapped.location.raw).toBe('Remote');
    expect(mapped.location.city).toBeUndefined();
    expect(mapped.location.country).toBeUndefined();
  });

  it('should infer employment type from title', () => {
    const rawJob: RawJob = {
      sourceId: '1134805',
      title: 'Senior React Developer (Full-time)',
      description: '<p>Job description</p>',
      companyName: 'TechCorp',
      location: 'New York, US',
      technologies: ['react'],
      url: 'https://example.com',
      publishedAt: new Date(),
      remote: true,
      fetchedAt: new Date(),
    };

    const mapped = mapper.map(rawJob);

    expect(mapped.employmentType).toBe('full_time');
  });
});

describe('RemoteOKNormalizer', () => {
  let normalizer: RemoteOKNormalizer;

  beforeEach(() => {
    normalizer = new RemoteOKNormalizer();
  });

  it('should normalize mapped job to normalized vacancy', () => {
    const mappedJob: MappedJob = {
      sourceId: '1134805',
      title: 'Senior React Developer',
      description: '<p>We are looking for a Senior React Developer.</p>',
      companyName: 'TechCorp',
      location: { raw: 'New York, US', city: 'New York', country: 'US' },
      salary: { min: 120000, max: 150000, currency: 'USD', period: 'yearly' },
      technologies: ['react', 'typescript', 'javascript'],
      url: 'https://remoteOK.com/remote-jobs/remote-senior-react-developer-techcorp-1134805',
      publishedAt: new Date('2026-07-14T12:04:36+00:00'),
      fetchedAt: new Date(),
      remote: true,
    };

    const normalized = normalizer.normalize(mappedJob);

    expect(normalized.id).toBe('remote_ok:1134805');
    expect(normalized.source).toBe('remote_ok');
    expect(normalized.sourceId).toBe('1134805');
    expect(normalized.title).toBe('Senior React Developer');
    expect(normalized.description).toBe('We are looking for a Senior React Developer.');
    expect(normalized.companyName).toBe('TechCorp');
    expect(normalized.location.raw).toBe('New York, US');
    expect(normalized.remote.level).toBe('remote_only');
    expect(normalized.remote.explicit).toBe(true);
    expect(normalized.contentHash).toBeDefined();
  });

  it('should validate mapped job successfully', () => {
    const mappedJob: MappedJob = {
      sourceId: '1134805',
      title: 'Senior React Developer',
      description: '<p>Job description</p>',
      companyName: 'TechCorp',
      location: { raw: 'New York, US' },
      technologies: ['react'],
      url: 'https://example.com',
      publishedAt: new Date(),
      fetchedAt: new Date(),
    };

    const error = normalizer.validate(mappedJob);

    expect(error).toBeNull();
  });

  it('should fail validation for missing title', () => {
    const mappedJob: MappedJob = {
      sourceId: '1134805',
      title: '',
      description: '<p>Job description</p>',
      companyName: 'TechCorp',
      location: { raw: 'New York, US' },
      technologies: ['react'],
      url: 'https://example.com',
      publishedAt: new Date(),
      fetchedAt: new Date(),
    };

    const error = normalizer.validate(mappedJob);

    expect(error).not.toBeNull();
    expect(error?.field).toBe('title');
    expect(error?.severity).toBe('error');
  });
});

describe('RemoteOKSyncStrategy', () => {
  let syncStrategy: RemoteOKSyncStrategy;

  beforeEach(() => {
    syncStrategy = new RemoteOKSyncStrategy();
  });

  it('should determine if sync should run', () => {
    const state = createInitialState('remote_ok');

    expect(syncStrategy.shouldSync(state)).toBe(true);
  });

  it('should not sync when unhealthy', () => {
    const state = createInitialState('remote_ok');
    const unhealthyState = { ...state, health: 'unhealthy' as const };

    expect(syncStrategy.shouldSync(unhealthyState)).toBe(false);
  });

  it('should not sync after 3 consecutive failures', () => {
    const state = createInitialState('remote_ok');
    const failedState = { ...state, consecutiveFailures: 3 };

    expect(syncStrategy.shouldSync(failedState)).toBe(false);
  });

  it('should process results correctly', () => {
    const state = createInitialState('remote_ok');
    const cursor = {
      cursor: { type: 'none' as const, message: 'No pagination' },
      strategy: 'none' as const,
      exhausted: true,
      fetchedCount: 0,
    };

    const result = syncStrategy.processResults(state, [], cursor);

    expect(result.shouldContinue).toBe(false);
    expect(result.metrics.imported).toBe(0);
    expect(result.stateUpdates.providerId).toBe('remote_ok');
  });
});

describe('RemoteOKProvider', () => {
  it('should create provider with default config', () => {
    const logger = new ConsoleLogger('error');
    const metrics = new InMemoryMetricsCollector();
    const tracer = new InMemoryTracer();

    const provider = createRemoteOKProvider({
      logger,
      metrics,
      tracer,
    });

    expect(provider.info.id).toBe('remote_ok');
    expect(provider.info.name).toBe('RemoteOK');
    expect(provider.capabilities.search.supported).toBe(true);
    expect(provider.capabilities.pagination.strategy).toBe('none');
  });
});