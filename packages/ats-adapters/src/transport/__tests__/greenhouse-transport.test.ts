import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJobsPage, fetchSingleJob, pingBoard } from '../greenhouse-transport.js';
import fixtureResponse from '../../__fixtures__/greenhouse-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('greenhouse-transport', () => {
  const config = { boardToken: 'acme' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the exact same board-listing URL both prior implementations used', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchJobsPage(config);

    expect(fetch).toHaveBeenCalledWith(
      'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('requests the exact same single-job URL both prior implementations used', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { status: 404 }));

    await fetchSingleJob(config, '4028547');

    expect(fetch).toHaveBeenCalledWith(
      'https://boards-api.greenhouse.io/v1/boards/acme/jobs/4028547?questions=false',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('returns null on 404 for a single job instead of throwing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));

    const job = await fetchSingleJob(config, 'does-not-exist');
    expect(job).toBeNull();
  });

  it('throws AtsHttpError with status/statusText on other non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429, statusText: 'Too Many Requests' }));

    await expect(fetchJobsPage(config)).rejects.toMatchObject({
      name: 'AtsHttpError',
      status: 429,
      statusText: 'Too Many Requests',
    });
  });

  it('pings via a HEAD request against the board listing URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));

    const ok = await pingBoard(config);

    expect(ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'HEAD' }));
  });
});
