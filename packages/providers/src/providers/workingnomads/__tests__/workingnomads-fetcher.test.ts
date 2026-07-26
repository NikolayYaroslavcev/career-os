import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkingNomadsFetcher } from '../workingnomads-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import fixtureResponse from '../__fixtures__/workingnomads-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('WorkingNomadsFetcher (contract)', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new WorkingNomadsFetcher({
    baseUrl: 'https://www.workingnomads.com/api/exposed_jobs',
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
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(3);

    const [full, minimal, noTags] = result.data;
    expect(full?.sourceId).toBe('12345');
    expect(full?.title).toBe('Senior Full Stack Engineer');
    expect(full?.companyName).toBe('Nomad Labs');
    expect(full?.technologies).toEqual(['javascript', 'react', 'node']);

    // Optional/empty fields (missing company_name, missing tags) are handled safely.
    expect(minimal?.companyName).toBe('Unknown');
    expect(minimal?.technologies).toEqual(['marketing']);
    expect(minimal?.description).toBe('Content Marketer');

    // A url with no trailing numeric id falls back to the raw url as sourceId.
    expect(noTags?.sourceId).toBe('https://www.workingnomads.com/jobs/data-analyst');
    expect(noTags?.technologies).toEqual(['sql', 'python']);
  });

  it('does not throw and returns an empty list for an empty array response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([]));
    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('does not crash sync when the API returns something other than an array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null));
    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('does not crash on a job with a non-string tags field', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse([{ title: 'Odd Job', url: 'https://www.workingnomads.com/jobs/odd-999', tags: null, category_name: null }])
    );

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.technologies).toEqual([]);
    expect(result.data[0]?.companyName).toBe('Unknown');
  });

  it('returns a network error instead of throwing on a non-ok HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));
    const result = await fetcher.search({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NETWORK_ERROR');
  });
});
