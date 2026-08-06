import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPositions, pingPositions } from '../comeet-transport.js';
import fixtureResponse from '../../__fixtures__/comeet-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('comeet-transport', () => {
  const config = { token: 'secret-token', companyUid: 'acme-uid' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests all positions with token and details=true, matching providers’ original buildSearchUrl', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchPositions(config);

    expect(fetch).toHaveBeenCalledWith(
      'https://www.comeet.co/careers-api/2.0/company/acme-uid/positions?token=secret-token&details=true',
      expect.anything(),
    );
  });

  it('throws AtsHttpError with status/statusText on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429, statusText: 'Too Many Requests' }));

    await expect(fetchPositions(config)).rejects.toMatchObject({
      name: 'AtsHttpError',
      status: 429,
      statusText: 'Too Many Requests',
    });
  });

  it('pings via a plain GET without details=true — not a HEAD request, matching the original', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));

    const ok = await pingPositions(config);

    expect(ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://www.comeet.co/careers-api/2.0/company/acme-uid/positions?token=secret-token',
      expect.anything(),
    );
    expect(fetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'HEAD' }));
  });
});
