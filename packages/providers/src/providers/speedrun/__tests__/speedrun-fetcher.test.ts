import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeedrunFetcher } from '../speedrun-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

function apiJob(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'abc-123',
    title: 'Senior Backend Engineer',
    company: 'Flock Safety',
    url: 'https://speedrun-talent-network.com/jobs/senior-backend-engineer-flock-safety-abc-123',
    location: 'Atlanta, GA',
    workplace_type: 'Hybrid',
    employment_type: 'FullTime',
    seniority: 'senior',
    remote: false,
    comp_min: 170000,
    comp_max: 220000,
    comp_currency: 'USD',
    comp_period: 'year',
    published_at: '2026-07-30T13:01:46.413+00:00',
    ...overrides,
  };
}

describe('SpeedrunFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  function makeFetcher(): SpeedrunFetcher {
    return new SpeedrunFetcher({ baseUrl: 'https://speedrun-talent-network.com/api/v1/jobs', logger, metrics, tracer });
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps structured comp/seniority/employment-type fields directly, no text parsing needed', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      jobs: [apiJob()],
      total: 1, page: 1, page_size: 50, total_pages: 1,
    }));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(1);
    const job = result.data[0]!;
    expect(job.sourceId).toBe('speedrun-abc-123');
    expect(job.companyName).toBe('Flock Safety');
    expect(job.salary).toEqual({ from: 170000, to: 220000, currency: 'USD', period: 'yearly' });
    expect(job.experienceLevel).toBe('senior');
    expect(job.employmentType).toBe('full_time');
    expect(job.remote).toBe(false);
    // Uses the source's own job page, not a per-job detail-endpoint fetch —
    // same accepted precedent as WWR/Arbeitnow/DOU.
    expect(job.url).toBe('https://speedrun-talent-network.com/jobs/senior-backend-engineer-flock-safety-abc-123');
  });

  it('treats workplace_type "Remote" as remote even when the boolean flag is false', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      jobs: [apiJob({ remote: false, workplace_type: 'Remote' })],
      total: 1, page: 1, page_size: 50, total_pages: 1,
    }));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.remote).toBe(true);
  });

  it('paginates through every page and requests the fn=engineering filter each time', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ jobs: [apiJob({ id: 'page-1-job' })], total: 3, page: 1, page_size: 1, total_pages: 3 }))
      .mockResolvedValueOnce(jsonResponse({ jobs: [apiJob({ id: 'page-2-job' })], total: 3, page: 2, page_size: 1, total_pages: 3 }))
      .mockResolvedValueOnce(jsonResponse({ jobs: [apiJob({ id: 'page-3-job' })], total: 3, page: 3, page_size: 1, total_pages: 3 }));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.map((j) => j.sourceId)).toEqual(['speedrun-page-1-job', 'speedrun-page-2-job', 'speedrun-page-3-job']);
    expect(fetch).toHaveBeenCalledTimes(3);
    for (const call of vi.mocked(fetch).mock.calls) {
      expect(String(call[0])).toContain('fn=engineering');
    }
  });

  it('drops salary when both comp bounds are null rather than emitting a zero range', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      jobs: [apiJob({ comp_min: null, comp_max: null, comp_currency: null, comp_period: null })],
      total: 1, page: 1, page_size: 50, total_pages: 1,
    }));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.salary).toBeUndefined();
  });

  it('returns a network error on a permanent HTTP failure', async () => {
    const fetcher = makeFetcher();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404, statusText: 'Not Found' }));

    const result = await fetcher.search({});
    expect(result.ok).toBe(false);
  });
});
