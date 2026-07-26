import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TeamtailorFetcher } from '../teamtailor-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import fixtureResponse from '../__fixtures__/teamtailor-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('TeamtailorFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new TeamtailorFetcher({
    baseUrl: 'https://api.teamtailor.com/v1/jobs',
    apiKey: 'tt-secret',
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

  it('should fetch and parse jobs from the JSON:API envelope', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(3);
    expect(result.data[0]?.sourceId).toBe('998877');
    expect(result.data[0]?.companyName).toBe('Acme Corp');
    expect(result.data[0]?.employmentType).toBe('full_time');
    expect(result.data[0]?.experienceLevel).toBe('senior');
    expect(result.data[0]?.remote).toBe(true);
    expect(result.data[1]?.remote).toBe(false);
    expect(result.data[2]?.employmentType).toBeUndefined();
  });

  it('should send the Authorization and X-Api-Version headers on every request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetcher.search({});

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Token token=tt-secret');
    expect(headers['X-Api-Version']).toBeTruthy();
  });

  it('should map a 401 response to AUTHENTICATION_ERROR', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 401 }));

    const result = await fetcher.search({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('AUTHENTICATION_ERROR');
    expect(result.retryable).toBe(false);
  });

  it('should return a rate-limited error on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429 }));

    const result = await fetcher.search({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('RATE_LIMITED');
    expect(result.retryable).toBe(true);
  });

  it('should report hasMore false when meta record-count is fully covered by one page', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.fetchWithCursor({}, { type: 'page', page: 1, perPage: 20 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hasMore).toBe(false);
    expect(result.data.cursor.exhausted).toBe(true);
  });

  it('should find a vacancy by sourceId via getVacancy', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: fixtureResponse.data[0] }));

    const result = await fetcher.getVacancy('998877');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.title).toBe('Backend Engineer');
  });

  it('should return null for getVacancy on a 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));

    const result = await fetcher.getVacancy('does-not-exist');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('should ping successfully with an authenticated GET', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true, status: 200 }));

    const result = await fetcher.ping();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(true);
  });
});
