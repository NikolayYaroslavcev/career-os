import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJobsPage, fetchSingleJob, pingJobs } from '../teamtailor-transport.js';
import fixtureResponse from '../../__fixtures__/teamtailor-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('teamtailor-transport', () => {
  const config = { apiKey: 'tt-secret' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the real Authorization/X-Api-Version headers — not the X-Api-Key the prior company-watch adapter used', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchJobsPage(config, 1, 20);

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Token token=tt-secret');
    expect(headers['X-Api-Version']).toBeTruthy();
    expect(headers['X-Api-Key']).toBeUndefined();
  });

  it('requests the jobs listing with page/filter/include params', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchJobsPage(config, 1, 20);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.teamtailor.com/v1/jobs?page%5Bnumber%5D=1&page%5Bsize%5D=20&filter%5Bstatus%5D=published&include=department,role',
      expect.anything(),
    );
  });

  it('requests the exact single-job URL and returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));

    const job = await fetchSingleJob(config, '998877');

    expect(job).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      'https://api.teamtailor.com/v1/jobs/998877?include=department,role',
      expect.anything(),
    );
  });

  it('throws AtsHttpError with status/statusText on other non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429, statusText: 'Too Many Requests' }));

    await expect(fetchJobsPage(config, 1, 20)).rejects.toMatchObject({
      name: 'AtsHttpError',
      status: 429,
      statusText: 'Too Many Requests',
    });
  });

  it('pings via an authenticated GET (not HEAD, unlike the prior company-watch adapter)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));

    const ok = await pingJobs(config);

    expect(ok).toBe(true);
    expect(fetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'HEAD' }));
  });
});
