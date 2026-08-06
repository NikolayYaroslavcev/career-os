import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmartRecruitersFetcher } from '../smartrecruiters-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import fixtureResponse from '../__fixtures__/smartrecruiters-response.json' with { type: 'json' };
import fixtureSingleJob from '../__fixtures__/smartrecruiters-single-job.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('SmartRecruitersFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new SmartRecruitersFetcher({
    baseUrl: 'https://api.smartrecruiters.com/v1',
    company: 'acme',
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

  it('fetches and parses postings from a single page', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(3);
    expect(result.data[0]?.sourceId).toBe('7f8a9b2c-0001');
    expect(result.data[0]?.location).toBe('Berlin, Germany');
    expect(result.data[0]?.salary).toEqual({ from: 70000, to: 95000, currency: 'EUR', period: 'yearly' });
    // Technology extraction happens downstream in the mapper, not the fetcher.
    expect(result.data[0]?.technologies).toEqual([]);
  });

  it('reproduces the pre-existing bug where companyName is read from the posting department, not the configured company (documented, preserved)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.companyName).toBe('Engineering');
  });

  it('defaults location to "Unknown" when city and country are both empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[1]?.location).toBe('Unknown');
  });

  it('treats a 0/0 salary as absent (falsy check, matching the original)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[2]?.salary).toBeUndefined();
  });

  it('never sets remote, unlike Greenhouse/Lever (SmartRecruiters provider info declares supportsRemote: false)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.remote).toBeUndefined();
  });

  it('sends offset/limit/q query params built server-side, with no client-side post-filtering', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ offset: 0, limit: 100, totalFound: 0, content: [] }));

    await fetcher.search({ query: 'engineer' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.smartrecruiters.com/v1/companies/acme/postings?offset=0&limit=100&q=engineer',
      expect.anything(),
    );
  });

  it('returns a NETWORK_ERROR (not RATE_LIMITED) on HTTP 429 — SmartRecruiters never had a rate-limit-specific branch, unlike Greenhouse/Lever', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429, statusText: 'Too Many Requests' }));

    const result = await fetcher.search({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NETWORK_ERROR');
    expect(result.retryable).toBe(true);
  });

  it('fetchWithCursor returns UNKNOWN_ERROR on an HTTP failure — no NETWORK_ERROR classification here, unlike search() (asymmetry preserved from the original)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429, statusText: 'Too Many Requests' }));

    const result = await fetcher.fetchWithCursor({}, { type: 'offset', offset: 0, limit: 100 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('UNKNOWN_ERROR');
  });

  it('fetchWithCursor reports hasMore based on totalFound', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.fetchWithCursor({}, { type: 'offset', offset: 0, limit: 100 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hasMore).toBe(false);
    expect(result.data.cursor.exhausted).toBe(true);
  });

  it('getVacancy returns the parsed job on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureSingleJob));

    const result = await fetcher.getVacancy('7f8a9b2c-0001');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.sourceId).toBe('7f8a9b2c-0001');
  });

  it('getVacancy returns null for a 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));

    const result = await fetcher.getVacancy('does-not-exist');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('getVacancy also returns null (not an error) on a 500 — every non-ok status was swallowed as "not found" in the original, preserved as-is', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 500, statusText: 'Internal Server Error' }));

    const result = await fetcher.getVacancy('some-id');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('pings via a plain GET (not HEAD), matching the original', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));

    const result = await fetcher.ping();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(true);
    expect(fetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'HEAD' }));
  });
});
