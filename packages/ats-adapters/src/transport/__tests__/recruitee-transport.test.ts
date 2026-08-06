import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchOffersPage, pingOffers } from '../recruitee-transport.js';
import fixtureResponse from '../../__fixtures__/recruitee-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('recruitee-transport', () => {
  const config = { company: 'acme' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the offers listing with page/per_page query params, matching providers’ original buildSearchUrl', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchOffersPage(config, 1, 50);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.recruitee.com/v3/companies/acme/offers?page=1&per_page=50',
      expect.anything(),
    );
  });

  it('adds a q param when a query is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchOffersPage(config, 1, 50, 'engineer');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.recruitee.com/v3/companies/acme/offers?page=1&per_page=50&q=engineer',
      expect.anything(),
    );
  });

  it('adds a remote=true param when remoteOnly is set', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchOffersPage(config, 1, 50, undefined, true);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.recruitee.com/v3/companies/acme/offers?page=1&per_page=50&remote=true',
      expect.anything(),
    );
  });

  it('throws AtsHttpError with status/statusText on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429, statusText: 'Too Many Requests' }));

    await expect(fetchOffersPage(config, 1, 50)).rejects.toMatchObject({
      name: 'AtsHttpError',
      status: 429,
      statusText: 'Too Many Requests',
    });
  });

  it('pings via a plain GET against page=1&per_page=1 — not a HEAD request, matching the original', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));

    const ok = await pingOffers(config);

    expect(ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.recruitee.com/v3/companies/acme/offers?page=1&per_page=1',
      expect.anything(),
    );
    expect(fetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'HEAD' }));
  });
});
