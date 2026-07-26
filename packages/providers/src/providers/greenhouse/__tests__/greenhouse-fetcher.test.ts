import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GreenhouseFetcher } from '../greenhouse-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import fixtureResponse from '../__fixtures__/greenhouse-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('GreenhouseFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new GreenhouseFetcher({
    baseUrl: 'https://boards-api.greenhouse.io/v1/boards',
    boardToken: 'acme',
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
    expect(result.data[0]?.sourceId).toBe('4028547');
    expect(result.data[0]?.companyName).toBe('Acme Corp');
    expect(result.data[0]?.technologies).toEqual(['Go', 'Kubernetes', 'PostgreSQL']);
    expect(result.data[0]?.salary).toEqual({ from: 150000, to: 190000, currency: 'USD', period: 'yearly' });
    expect(result.data[1]?.remote).toBe(false);
  });

  it('should apply client-side filtering by technology since the board API has no server-side search', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({ technologies: ['react'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.sourceId).toBe('4028549');
  });

  it('should return a rate-limited error on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429 }));

    const result = await fetcher.search({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('RATE_LIMITED');
    expect(result.retryable).toBe(true);
  });

  it('should report an exhausted none-cursor for fetchWithCursor since Greenhouse has no pagination', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.fetchWithCursor({}, { type: 'none', message: '' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hasMore).toBe(false);
    expect(result.data.cursor.exhausted).toBe(true);
  });

  it('should return null for getVacancy on a 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));

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
