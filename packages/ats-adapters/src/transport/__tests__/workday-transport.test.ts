import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJobsPage, pingJobs, buildJobUrl } from '../workday-transport.js';
import fixtureResponse from '../../__fixtures__/workday-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('workday-transport', () => {
  const config = { tenant: 'acme', site: 'External', host: 'wd1.myworkdayjobs.com' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the CXS jobs endpoint keyed by tenant/host/site, matching providers’ original buildApiUrl', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchJobsPage(config, 0, 20, 'engineer');

    expect(fetch).toHaveBeenCalledWith(
      'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/External/jobs',
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ appliedFacets: {}, limit: 20, offset: 0, searchText: 'engineer' });
  });

  it('defaults host to wd1.myworkdayjobs.com when not provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    await fetchJobsPage({ tenant: 'acme', site: 'External' }, 0, 20);

    expect(fetch).toHaveBeenCalledWith(
      'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/External/jobs',
      expect.anything(),
    );
  });

  it('builds the public job URL from tenant/host + externalPath, matching providers’ original buildPublicUrl', () => {
    expect(buildJobUrl(config, '/job/Remote---USA/Software-Engineer-II_R-12345')).toBe(
      'https://acme.wd1.myworkdayjobs.com/job/Remote---USA/Software-Engineer-II_R-12345',
    );
  });

  it('throws AtsHttpError with status/statusText on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429, statusText: 'Too Many Requests' }));

    await expect(fetchJobsPage(config, 0, 20)).rejects.toMatchObject({
      name: 'AtsHttpError',
      status: 429,
      statusText: 'Too Many Requests',
    });
  });

  it('pings via a minimal POST request, matching the original', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));

    const ok = await pingJobs(config);

    expect(ok).toBe(true);
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init).toMatchObject({ method: 'POST' });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ appliedFacets: {}, limit: 1, offset: 0, searchText: '' });
  });
});
