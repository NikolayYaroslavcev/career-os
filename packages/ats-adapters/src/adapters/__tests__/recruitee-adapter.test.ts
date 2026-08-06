import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecruiteeAdapter } from '../recruitee-adapter.js';
import fixtureResponse from '../../__fixtures__/recruitee-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('RecruiteeAdapter', () => {
  const adapter = new RecruiteeAdapter();
  const config = { company: 'acme' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType RECRUITEE', () => {
    expect(adapter.atsType).toBe('RECRUITEE');
  });

  it('fetchJobs returns all canonical raw jobs from a single page when it is the last page', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const jobs = await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(jobs).toHaveLength(3);
    expect(jobs[0]?.externalId).toBe('1001');
  });

  it('fetchJobs crawls subsequent pages until total_pages is reached', async () => {
    const page1 = {
      offers: Array.from({ length: 50 }, (_, i) => ({ ...fixtureResponse.offers[0]!, id: 2000 + i })),
      meta: { total: 53, per_page: 50, current_page: 1, total_pages: 2 },
    };
    const page2 = { offers: fixtureResponse.offers.slice(0, 3), meta: { total: 53, per_page: 50, current_page: 2, total_pages: 2 } };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2));

    const jobs = await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(jobs).toHaveLength(53);
  });

  it('fetchJobs stops when a page returns no offers, even below total_pages', async () => {
    const emptyPage = { offers: [], meta: { total: 3, per_page: 50, current_page: 1, total_pages: 3 } };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(emptyPage));

    const jobs = await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(jobs).toEqual([]);
  });

  it('fetchJobs stops after MAX_PAGES (10) even if total_pages claims more, mirroring providers’ original cap', async () => {
    const page = (n: number) => ({
      offers: [{ ...fixtureResponse.offers[0]!, id: n }],
      meta: { total: 999, per_page: 50, current_page: n, total_pages: 999 },
    });
    for (let i = 1; i <= 10; i++) {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(page(i)));
    }

    const jobs = await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledTimes(10);
    expect(jobs).toHaveLength(10);
  });

  it('fetchJob crawls the listing and finds the matching job by id — no real single-offer endpoint exists for this ATS', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const job = await adapter.fetchJob(config, '1001');

    expect(job?.externalId).toBe('1001');
    expect(job?.title).toBe('Senior Backend Engineer');
  });

  it('fetchJob returns null when no offer matches', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const job = await adapter.fetchJob(config, 'does-not-exist');
    expect(job).toBeNull();
  });

  it('ping reflects the HTTP response ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));
    expect(await adapter.ping(config)).toBe(true);
  });
});
