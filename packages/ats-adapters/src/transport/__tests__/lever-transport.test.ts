import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPostingsPage, fetchAllPostings, fetchSinglePosting, pingPostingsPage, pingAllPostings } from '../lever-transport.js';
import fixtureResponse from '../../__fixtures__/lever-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('lever-transport', () => {
  const config = { company: 'acme' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the exact same paginated URL providers original implementation used', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchPostingsPage(config, 0, 100);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.lever.co/v0/postings/acme?mode=json&skip=0&limit=100',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('requests the exact same bare URL company-watch original implementation used (no pagination, no mode=json)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchAllPostings(config);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.lever.co/v0/postings/acme',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('requests the exact same single-posting URL company-watch original implementation used', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { status: 404 }));

    await fetchSinglePosting(config, 'a1b2c3d4-1111-2222-3333-444455556666');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.lever.co/v0/postings/acme/a1b2c3d4-1111-2222-3333-444455556666',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
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

  it('pings the paginated URL via HEAD (providers shape)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));

    const ok = await pingPostingsPage(config, 0, 100);

    expect(ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.lever.co/v0/postings/acme?mode=json&skip=0&limit=100',
      expect.objectContaining({ method: 'HEAD' }),
    );
  });

  it('pings the bare URL via HEAD (company-watch shape)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));

    const ok = await pingAllPostings(config);

    expect(ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.lever.co/v0/postings/acme',
      expect.objectContaining({ method: 'HEAD' }),
    );
  });
});
