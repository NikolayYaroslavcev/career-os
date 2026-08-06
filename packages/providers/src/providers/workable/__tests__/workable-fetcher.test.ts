import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkableFetcher } from '../workable-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import fixtureResponse from '../../../../../ats-adapters/src/__fixtures__/workable-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('WorkableFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new WorkableFetcher({
    accountSlug: 'acme-ai',
    companyName: 'Acme AI',
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

  it('should fetch and parse jobs from the widget endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.sourceId).toBe('F4C096B22E');
    expect(result.data[0]?.companyName).toBe('Acme AI');
    expect(result.data[0]?.url).toBe('https://apply.workable.com/j/F4C096B22E/apply');
    expect(result.data[0]?.remote).toBe(true);
    expect(result.data[0]?.experienceLevel).toBe('middle'); // "Mid-Senior level" -> middle
    expect(result.data[0]?.employmentType).toBe('full_time');
    expect(result.data[0]?.technologies).toContain('kafka');
    expect(result.data[1]?.remote).toBe(false);
    expect(result.data[1]?.experienceLevel).toBe('junior'); // "Entry level" -> junior
  });

  it('should apply client-side filtering by remote-only', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({ remoteOnly: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.sourceId).toBe('F4C096B22E');
  });

  it('should return a network error on HTTP 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 500 }));

    const result = await fetcher.search({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NETWORK_ERROR');
    expect(result.retryable).toBe(true);
  });

  it('should report an exhausted none-cursor for fetchWithCursor since Workable has no pagination', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.fetchWithCursor({}, { type: 'none', message: '' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hasMore).toBe(false);
    expect(result.data.cursor.exhausted).toBe(true);
  });

  it('should return null from getVacancy when the shortcode is not present', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.getVacancy('does-not-exist');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('should ping successfully when the widget responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse, { ok: true, status: 200 }));

    const result = await fetcher.ping();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(true);
  });
});
