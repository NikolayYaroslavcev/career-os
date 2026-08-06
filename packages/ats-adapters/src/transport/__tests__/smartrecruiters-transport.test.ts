import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPostingsPage, fetchSinglePosting, pingPostings } from '../smartrecruiters-transport.js';
import fixtureResponse from '../../__fixtures__/smartrecruiters-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('smartrecruiters-transport', () => {
  const config = { company: 'acme' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the postings listing with offset/limit query params, matching providers’ original buildSearchUrl', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchPostingsPage(config, 0, 100);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.smartrecruiters.com/v1/companies/acme/postings?offset=0&limit=100',
      expect.anything(),
    );
  });

  it('adds a q param when a query is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchPostingsPage(config, 0, 100, 'engineer');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.smartrecruiters.com/v1/companies/acme/postings?offset=0&limit=100&q=engineer',
      expect.anything(),
    );
  });

  it('requests the exact single-posting URL providers’ original getVacancy used', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { status: 404 }));

    await fetchSinglePosting(config, '7f8a9b2c-0001');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.smartrecruiters.com/v1/companies/acme/postings/7f8a9b2c-0001',
      expect.anything(),
    );
  });

  it('returns null on 404 for a single posting instead of throwing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));

    const job = await fetchSinglePosting(config, 'does-not-exist');
    expect(job).toBeNull();
  });

  it('throws AtsHttpError with status/statusText on other non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429, statusText: 'Too Many Requests' }));

    await expect(fetchPostingsPage(config, 0, 100)).rejects.toMatchObject({
      name: 'AtsHttpError',
      status: 429,
      statusText: 'Too Many Requests',
    });
  });

  it('pings via a plain GET against postings?limit=1 — not a HEAD request, unlike Greenhouse/Lever (preserved from the original)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));

    const ok = await pingPostings(config);

    expect(ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.smartrecruiters.com/v1/companies/acme/postings?offset=0&limit=1',
      expect.anything(),
    );
    expect(fetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'HEAD' }));
  });
});
