import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComeetFetcher } from '../comeet-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import fixtureResponse from '../__fixtures__/comeet-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('ComeetFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new ComeetFetcher({
    baseUrl: 'https://www.comeet.co/careers-api/2.0',
    token: 'secret-token',
    companyUid: 'acme-uid',
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

  it('fetches and parses all positions in a single request — Comeet has no pagination', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.sourceId).toBe('job-001');
    expect(result.data[0]?.location).toBe('Tel Aviv, Israel');
    expect(result.data[0]?.description).toBe('Build APIs using Node.js and React.\n\nExperience with Kubernetes.');
  });

  it('reads companyName from the job payload itself, not a configured company name (Comeet API returns it per-job)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.companyName).toBe('Acme Inc');
  });

  it('defaults location to "Unknown" when the location name is empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[1]?.location).toBe('Unknown');
  });

  it('derives remote from workplace_type or location.is_remote', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.remote).toBe(false);
    expect(result.data[1]?.remote).toBe(true);
  });

  it('never sets salary — Comeet has no salary field', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.salary).toBeUndefined();
  });

  it('sends token and details=true, ignoring criteria.query — Comeet has no server-side keyword filter', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([]));

    await fetcher.search({ query: 'engineer' });

    expect(fetch).toHaveBeenCalledWith(
      'https://www.comeet.co/careers-api/2.0/company/acme-uid/positions?token=secret-token&details=true',
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

  it('getVacancy re-fetches all positions and finds the job client-side — Comeet has no single-job endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.getVacancy('job-001');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.sourceId).toBe('job-001');
  });

  it('getVacancy returns null when no job matches', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.getVacancy('does-not-exist');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('fetchWithCursor always reports hasMore false and an exhausted "none" cursor', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.fetchWithCursor({}, { type: 'none', message: 'not used' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hasMore).toBe(false);
    expect(result.data.cursor.exhausted).toBe(true);
    expect(result.data.jobs).toHaveLength(2);
  });

  it('pings via a plain GET without details=true (not HEAD), matching the original', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));

    const result = await fetcher.ping();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(true);
    expect(fetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'HEAD' }));
  });
});
