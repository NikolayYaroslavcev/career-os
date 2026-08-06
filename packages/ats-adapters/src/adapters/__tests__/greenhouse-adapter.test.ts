import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GreenhouseAdapter } from '../greenhouse-adapter.js';
import fixtureResponse from '../../__fixtures__/greenhouse-response.json' with { type: 'json' };
import fixtureSingleJob from '../../__fixtures__/greenhouse-single-job.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('GreenhouseAdapter', () => {
  const adapter = new GreenhouseAdapter();
  const config = { boardToken: 'acme' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType GREENHOUSE', () => {
    expect(adapter.atsType).toBe('GREENHOUSE');
  });

  it('fetchJobs returns all canonical raw jobs from the board listing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs).toHaveLength(3);
    expect(jobs[0]?.externalId).toBe('4028547');
    expect(jobs[0]?.salary).toEqual({ min: 150000, max: 190000, currency: 'USD' });
  });

  it('fetchJob returns a single canonical raw job', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureSingleJob));

    const job = await adapter.fetchJob(config, '4028547');

    expect(job?.externalId).toBe('4028547');
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
