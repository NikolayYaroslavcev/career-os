import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecruiteeFetcher } from '../recruitee-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import fixtureResponse from '../__fixtures__/recruitee-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('RecruiteeFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new RecruiteeFetcher({
    baseUrl: 'https://api.recruitee.com/v3',
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

  it('fetches and parses offers from a single page', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(3);
    expect(result.data[0]?.sourceId).toBe('1001');
    expect(result.data[0]?.location).toBe('Berlin, Germany');
    expect(result.data[0]?.salary).toEqual({ from: 50000, to: 70000, currency: 'EUR', period: 'yearly' });
    expect(result.data[0]?.companyName).toBe('Unknown');
    // Technology extraction is not performed at the fetcher layer for Recruitee.
    expect(result.data[0]?.technologies).toEqual([]);
  });

  it('defaults location to "Unknown" when the offer has an empty location', async () => {
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

  it('carries remote directly from the offer, unlike SmartRecruiters which never sets it', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.remote).toBe(false);
    expect(result.data[1]?.remote).toBe(true);
  });

  it('keeps department/team in extensions rather than a canonical departments array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.extensions).toMatchObject({ department: 'Engineering', team: 'Platform' });
  });

  it('stops paginating once a page reports it is the last page (total_pages), issuing a single request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetcher.search({});

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sends page/per_page/q query params, mirroring the original buildSearchUrl', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ offers: [], meta: { total: 0, per_page: 50, current_page: 1, total_pages: 1 } }),
    );

    await fetcher.search({ query: 'engineer' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.recruitee.com/v3/companies/acme/offers?page=1&per_page=50&q=engineer',
      expect.anything(),
    );
  });

  it('returns a NETWORK_ERROR on an HTTP failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429, statusText: 'Too Many Requests' }));

    const result = await fetcher.search({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NETWORK_ERROR');
    expect(result.retryable).toBe(true);
  });

  it('getVacancy re-fetches the listing and finds the job client-side — no true single-offer endpoint is used, matching the original', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.getVacancy('1001');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.sourceId).toBe('1001');
  });

  it('getVacancy returns null when no offer matches', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.getVacancy('does-not-exist');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('fetchWithCursor reports hasMore based on total_pages', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.fetchWithCursor({}, { type: 'page', page: 1, perPage: 50 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hasMore).toBe(false);
    expect(result.data.cursor.exhausted).toBe(true);
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
