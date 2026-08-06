import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmartRecruitersAdapter } from '../smartrecruiters-adapter.js';
import fixtureResponse from '../../__fixtures__/smartrecruiters-response.json' with { type: 'json' };
import fixtureSingleJob from '../../__fixtures__/smartrecruiters-single-job.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('SmartRecruitersAdapter', () => {
  const adapter = new SmartRecruitersAdapter();
  const config = { company: 'acme' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType SMARTRECRUITERS', () => {
    expect(adapter.atsType).toBe('SMARTRECRUITERS');
  });

  it('fetchJobs returns all canonical raw jobs from a single page when totalFound fits in one page', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const jobs = await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(jobs).toHaveLength(3);
    expect(jobs[0]?.externalId).toBe('7f8a9b2c-0001');
  });

  it('fetchJobs crawls subsequent pages until totalFound is reached (fixed 100-page-size stepping, matching providers’ original offset += limit)', async () => {
    const fullPage = {
      offset: 0,
      limit: 100,
      totalFound: 103,
      content: Array.from({ length: 100 }, (_, i) => ({
        ...fixtureResponse.content[0]!,
        id: `page1-${i}`,
      })),
    };
    const lastPage = { offset: 100, limit: 100, totalFound: 103, content: fixtureResponse.content.slice(0, 3) };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fullPage)).mockResolvedValueOnce(jsonResponse(lastPage));

    const jobs = await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(jobs).toHaveLength(103);
  });

  it('fetchJobs stops when a page returns no jobs, even below totalFound', async () => {
    const emptyPage = { offset: 0, limit: 100, totalFound: 3, content: [] };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(emptyPage));

    const jobs = await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(jobs).toEqual([]);
  });

  it('fetchJob returns a single canonical raw job', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureSingleJob));

    const job = await adapter.fetchJob(config, '7f8a9b2c-0001');

    expect(job?.externalId).toBe('7f8a9b2c-0001');
    expect(job?.title).toBe('Senior Backend Engineer');
  });

  it('fetchJob returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));

    const job = await adapter.fetchJob(config, 'missing');
    expect(job).toBeNull();
  });

  it('ping reflects the HTTP response ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));
    expect(await adapter.ping(config)).toBe(true);
  });
});
