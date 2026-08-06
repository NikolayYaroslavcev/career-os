import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJobBoard, pingJobBoard } from '../ashby-transport.js';
import fixtureResponse from '../../__fixtures__/ashby-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('ashby-transport', () => {
  const config = { jobBoardName: 'acme' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the job board listing keyed by jobBoardName, matching providers’ original buildJobsUrl', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchJobBoard(config);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.ashbyhq.com/posting-api/job-board/acme?includeCompensation=true',
      expect.anything(),
    );
  });

  it('throws AtsHttpError with status/statusText on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429, statusText: 'Too Many Requests' }));

    await expect(fetchJobBoard(config)).rejects.toMatchObject({
      name: 'AtsHttpError',
      status: 429,
      statusText: 'Too Many Requests',
    });
  });

  it('pings via a HEAD request against the same job board URL, matching the original', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));

    const ok = await pingJobBoard(config);

    expect(ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.ashbyhq.com/posting-api/job-board/acme?includeCompensation=true',
      expect.objectContaining({ method: 'HEAD' }),
    );
  });
});
