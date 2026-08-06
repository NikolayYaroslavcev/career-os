import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkdayAdapter } from '../workday-adapter.js';
import fixtureResponse from '../../__fixtures__/workday-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('WorkdayAdapter', () => {
  const adapter = new WorkdayAdapter();
  const config = { tenant: 'acme', site: 'External', host: 'wd1.myworkdayjobs.com' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType WORKDAY', () => {
    expect(adapter.atsType).toBe('WORKDAY');
  });

  it('fetchJobs returns all canonical raw jobs when the first page covers the total', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const jobs = await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(jobs).toHaveLength(3);
  });

  it('fetchJobs crawls subsequent pages until offset reaches total', async () => {
    const page1 = { total: 23, jobPostings: fixtureResponse.jobPostings.map((j, i) => ({ ...j, jobReqId: `page1-${i}` })) };
    const page2 = { total: 23, jobPostings: fixtureResponse.jobPostings.slice(0, 1).map((j) => ({ ...j, jobReqId: 'page2-0' })) };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ ...page1, jobPostings: Array.from({ length: 20 }, (_, i) => ({ ...fixtureResponse.jobPostings[0]!, jobReqId: `p1-${i}` })) }))
      .mockResolvedValueOnce(jsonResponse(page2));

    const jobs = await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(jobs).toHaveLength(21);
  });

  it('fetchJobs de-duplicates by externalId across pages', async () => {
    const fullPage = { total: 40, jobPostings: Array.from({ length: 20 }, () => fixtureResponse.jobPostings[0]!) };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(fullPage))
      .mockResolvedValueOnce(jsonResponse({ total: 40, jobPostings: [] }));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs).toHaveLength(1);
  });

  it('fetchJob crawls the listing and finds the matching job by id — no single-job endpoint exists for Workday', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const job = await adapter.fetchJob(config, 'R-12346');
    expect(job?.title).toBe('Staff Accountant');
  });

  it('fetchJob returns null when no posting matches', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const job = await adapter.fetchJob(config, 'does-not-exist');
    expect(job).toBeNull();
  });

  it('ping reflects the HTTP response ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));
    expect(await adapter.ping(config)).toBe(true);
  });
});
