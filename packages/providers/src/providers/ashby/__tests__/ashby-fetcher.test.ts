import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AshbyFetcher } from '../ashby-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import fixtureResponse from '../__fixtures__/ashby-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('AshbyFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new AshbyFetcher({
    baseUrl: 'https://api.ashbyhq.com/posting-api/job-board',
    jobBoardName: 'acme',
    companyName: 'Acme Corp',
    logger,
    metrics,
    tracer,
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should fetch and parse jobs from the board listing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(3);
    expect(result.data[0]?.sourceId).toBe('11111111-2222-3333-4444-555555555555');
    expect(result.data[0]?.companyName).toBe('Acme Corp');
    expect(result.data[0]?.technologies).toEqual([]);
    expect(result.data[0]?.salary).toBeUndefined();
    expect(result.data[0]?.remote).toBe(true);
    expect(result.data[0]?.employmentType).toBe('full_time');
    expect(result.data[1]?.remote).toBe(false);
    expect(result.data[1]?.employmentType).toBe('contract');
    expect(result.data[2]?.employmentType).toBe('internship');
  });

  it('should apply client-side filtering by query since the job board API has no server-side search', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({ query: 'intern' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.sourceId).toBe('33333333-4444-5555-6666-777777777777');
  });

  it('should apply client-side filtering by remoteOnly using isRemote directly', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({ remoteOnly: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(2);
    expect(result.data.every((job) => job.remote)).toBe(true);
  });

  it('should return a rate-limited error on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429 }));

    const result = await fetcher.search({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('RATE_LIMITED');
    expect(result.retryable).toBe(true);
  });

  it('should return a network error on other non-ok HTTP statuses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 500 }));

    const result = await fetcher.search({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NETWORK_ERROR');
    expect(result.retryable).toBe(true);
  });

  it('should report an exhausted none-cursor for fetchWithCursor since Ashby has no pagination', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.fetchWithCursor({}, { type: 'none', message: '' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hasMore).toBe(false);
    expect(result.data.cursor.exhausted).toBe(true);
    expect(result.data.jobs).toHaveLength(3);
  });

  it('should find a vacancy by id by fetching the full board, since Ashby has no single-job endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.getVacancy('22222222-3333-4444-5555-666666666666');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.title).toBe('Office Manager');
  });

  it('should return null for getVacancy when the id is not found on the board', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.getVacancy('does-not-exist');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('should ping successfully when the board listing responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true, status: 200 }));

    const result = await fetcher.ping();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(true);
  });
});
