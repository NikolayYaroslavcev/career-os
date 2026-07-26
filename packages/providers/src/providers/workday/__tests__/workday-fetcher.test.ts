import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkdayFetcher } from '../workday-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import fixtureResponse from '../__fixtures__/workday-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('WorkdayFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new WorkdayFetcher({
    tenant: 'acme',
    site: 'External',
    host: 'wd1.myworkdayjobs.com',
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

  it('should POST to the CXS jobs endpoint and parse postings', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(3);
    expect(result.data[0]?.sourceId).toBe('R-12345');
    expect(result.data[0]?.companyName).toBe('Acme Corp');
    expect(result.data[0]?.url).toBe('https://acme.wd1.myworkdayjobs.com/job/Remote---USA/Software-Engineer-II_R-12345');
    expect(result.data[1]?.remote).toBe(false);
  });

  it('should construct the request body with offset/limit/searchText', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetcher.search({ query: 'engineer', limit: 20 });

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/External/jobs');
    expect(init).toMatchObject({ method: 'POST' });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ appliedFacets: {}, limit: 20, offset: 0, searchText: 'engineer' });
  });

  it('should parse relative "Posted X Days Ago" text into an approximate publishedAt date', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const today = result.data.find((j) => j.sourceId === 'R-12345')!;
    const threeDaysAgo = result.data.find((j) => j.sourceId === 'R-12346')!;

    expect(today.publishedAt.getTime()).toBeGreaterThan(threeDaysAgo.publishedAt.getTime());
  });

  it('should return a rate-limited error on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429 }));

    const result = await fetcher.search({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('RATE_LIMITED');
    expect(result.retryable).toBe(true);
  });

  it('should report hasMore based on offset vs total via fetchWithCursor', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ total: 47, jobPostings: fixtureResponse.jobPostings }));

    const result = await fetcher.fetchWithCursor({}, { type: 'offset', offset: 0, limit: 3 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hasMore).toBe(true);
    expect(result.data.cursor.cursor).toEqual({ type: 'offset', offset: 3, limit: 3, totalResults: 47 });
  });

  it('should find a vacancy by sourceId via getVacancy', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.getVacancy('R-12346');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.title).toBe('Staff Accountant');
  });

  it('should ping successfully via a minimal POST request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true, status: 200 }));

    const result = await fetcher.ping();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(true);

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init).toMatchObject({ method: 'POST' });
  });
});
