import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LeverFetcher } from '../lever-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import fixtureResponse from '../__fixtures__/lever-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('LeverFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new LeverFetcher({
    baseUrl: 'https://api.lever.co/v0/postings',
    company: 'acme',
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

  it('should fetch and parse jobs from the postings listing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(3);
    expect(result.data[0]?.sourceId).toBe('a1b2c3d4-1111-2222-3333-444455556666');
    expect(result.data[0]?.companyName).toBe('Acme Corp');
    expect(result.data[0]?.technologies).toEqual(['go', 'kubernetes']);
    expect(result.data[0]?.salary).toEqual({ from: 150000, to: 190000, currency: 'USD', period: 'yearly' });
    expect(result.data[0]?.remote).toBe(true);
    expect(result.data[1]?.remote).toBe(false);
    expect(result.data[2]?.salary).toBeUndefined();
  });

  it('should apply client-side filtering by technology since the postings API has no server-side search', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({ technologies: ['react'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Postings that carry tags with no overlap are dropped (job 1: go/kubernetes);
    // postings with no tag data at all are kept rather than penalized (job 2);
    // postings matching the requested technology are kept (job 3: react/typescript).
    const sourceIds = result.data.map((job) => job.sourceId);
    expect(sourceIds).not.toContain('a1b2c3d4-1111-2222-3333-444455556666');
    expect(sourceIds).toContain('c3d4e5f6-3333-4444-5555-666677778888');
  });

  it('should return a rate-limited error on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429 }));

    const result = await fetcher.search({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('RATE_LIMITED');
    expect(result.retryable).toBe(true);
  });

  it('should default to offset 0/limit 100 and report exhausted when the page is short', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.fetchWithCursor({}, { type: 'none', message: '' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.jobs).toHaveLength(3);
    expect(result.data.hasMore).toBe(false);
    expect(result.data.cursor.exhausted).toBe(true);
    expect(result.data.cursor.cursor).toEqual({ type: 'offset', offset: 100, limit: 100 });
  });

  it('should report hasMore true when the page is exactly full', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.fetchWithCursor(
      {},
      { type: 'offset', offset: 0, limit: 3 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.jobs).toHaveLength(3);
    expect(result.data.hasMore).toBe(true);
    expect(result.data.cursor.exhausted).toBe(false);
    expect(result.data.cursor.cursor).toEqual({ type: 'offset', offset: 3, limit: 3 });
  });

  it('should request the next page using the offset from the given cursor', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([]));

    await fetcher.fetchWithCursor({}, { type: 'offset', offset: 6, limit: 3 });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.lever.co/v0/postings/acme?mode=json&skip=6&limit=3',
      expect.anything(),
    );
  });

  it('should find a vacancy by sourceId via getVacancy', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.getVacancy('b2c3d4e5-2222-3333-4444-555566667777');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.title).toBe('Office Administrator');
  });

  it('should return null for getVacancy when the id is not found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.getVacancy('does-not-exist');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('should ping successfully when the postings listing responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true, status: 200 }));

    const result = await fetcher.ping();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(true);
  });
});
