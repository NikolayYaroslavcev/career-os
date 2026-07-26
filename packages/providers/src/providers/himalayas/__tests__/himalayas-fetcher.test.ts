import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HimalayasFetcher } from '../himalayas-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import fixtureResponse from '../__fixtures__/himalayas-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('HimalayasFetcher (contract)', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new HimalayasFetcher({
    baseUrl: 'https://himalayas.app/jobs/api',
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

  it('maps a recorded API response without throwing, preserving required fields', async () => {
    // totalCount matches the single page returned here, so the paginating
    // `search()` loop stops after the first page.
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(3);

    const [full, minimal, noGuid] = result.data;
    expect(full?.sourceId).toBe('https://himalayas.app/companies/acme/jobs/staff-backend-engineer');
    expect(full?.title).toBe('Staff Backend Engineer');
    expect(full?.companyName).toBe('Acme Himalayas');
    expect(full?.salary).toEqual({ from: 140000, to: 190000, currency: 'USD', period: 'yearly' });
    expect(full?.technologies).toEqual(['backend', 'golang']);
    expect(full?.location).toBe('United States, Canada');

    // Optional fields (salary, categories) missing from the API response are handled safely.
    expect(minimal?.title).toBe('Marketing Manager');
    expect(minimal?.salary).toBeUndefined();
    expect(minimal?.technologies).toEqual(['marketing']);
    expect(minimal?.location).toBe('Remote');

    // A job with neither guid nor applicationLink still gets a deterministic, non-empty sourceId.
    expect(noGuid?.sourceId).toBeTruthy();
    expect(noGuid?.salary).toBeUndefined();
  });

  it('does not throw and returns an empty list when the jobs array is missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ totalCount: 0, offset: 0, limit: 20 }));
    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('does not crash sync on a malformed job entry with null salary fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        totalCount: 1,
        offset: 0,
        limit: 20,
        jobs: [{ guid: 'g1', title: 'Broken Job', minSalary: null, maxSalary: null, categories: null, locationRestrictions: null }],
      })
    );

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.salary).toBeUndefined();
    expect(result.data[0]?.technologies).toEqual([]);
    expect(result.data[0]?.location).toBe('Remote');
  });

  it('returns a network error instead of throwing on a non-ok HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));
    const result = await fetcher.search({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NETWORK_ERROR');
  });
});
