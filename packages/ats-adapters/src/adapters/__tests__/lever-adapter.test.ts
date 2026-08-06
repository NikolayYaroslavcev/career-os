import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LeverAdapter } from '../lever-adapter.js';
import fixtureResponse from '../../__fixtures__/lever-response.json' with { type: 'json' };
import fixtureSingleJob from '../../__fixtures__/lever-single-job.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('LeverAdapter', () => {
  const adapter = new LeverAdapter();
  const config = { company: 'acme' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType LEVER', () => {
    expect(adapter.atsType).toBe('LEVER');
  });

  it('fetchJobs hits the bare (unpaged) listing URL and returns all canonical raw jobs', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const jobs = await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledWith('https://api.lever.co/v0/postings/acme', expect.anything());
    expect(jobs).toHaveLength(3);
    expect(jobs[0]?.externalId).toBe('a1b2c3d4-1111-2222-3333-444455556666');
    expect(jobs[0]?.salary).toEqual({ min: 150000, max: 190000, currency: 'USD' });
  });

  it('fetchJob returns a single canonical raw job', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureSingleJob));

    const job = await adapter.fetchJob(config, 'a1b2c3d4-1111-2222-3333-444455556666');

    expect(job?.externalId).toBe('a1b2c3d4-1111-2222-3333-444455556666');
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
