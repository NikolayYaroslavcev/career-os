import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobicyFetcher } from '../jobicy-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import fixtureResponse from '../__fixtures__/jobicy-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('JobicyFetcher (contract)', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new JobicyFetcher({
    baseUrl: 'https://jobicy.com/api/v2/remote-jobs',
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

    const [full, minimal, zeroSalary] = result.data;
    expect(full?.sourceId).toBe('55001');
    expect(full?.title).toBe('Senior React Developer');
    expect(full?.companyName).toBe('RemoteWorks');
    expect(full?.url).toBe('https://jobicy.com/jobs/55001-senior-react-developer');
    expect(full?.salary).toEqual({ from: 70000, to: 95000, currency: 'USD', period: 'yearly' });
    expect(full?.technologies).toEqual(['dev', 'design']);

    // Optional fields missing from the API response are handled safely.
    expect(minimal?.title).toBe('Remote Copywriter');
    expect(minimal?.salary).toBeUndefined();
    expect(minimal?.technologies).toEqual([]);
    expect(minimal?.description).toBe('Write compelling marketing copy.');

    // salaryMin/salaryMax both 0 is treated as "no salary data", not a $0 salary.
    expect(zeroSalary?.salary).toBeUndefined();
  });

  it('does not throw and returns an empty list when the jobs array is missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ jobCount: 0 }));
    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('does not throw on a malformed job entry with unexpected types', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        jobCount: 1,
        jobs: [{ id: 999, url: 'https://jobicy.com/jobs/999', jobIndustry: null, jobType: null }],
      })
    );

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.title).toBe('');
    expect(result.data[0]?.technologies).toEqual([]);
  });

  it('returns a network error instead of throwing on a non-ok HTTP response', async () => {
    // A non-429 4xx fails resilientFetch's single attempt without retrying,
    // so this stays fast; a 5xx would trigger several seconds of real retry
    // backoff inside resilientFetch.
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));
    const result = await fetcher.search({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NETWORK_ERROR');
    expect(result.retryable).toBe(true);
  });
});
