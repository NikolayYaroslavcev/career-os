import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AshbyAdapter } from '../ashby-adapter.js';
import fixtureResponse from '../../__fixtures__/ashby-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('AshbyAdapter', () => {
  const adapter = new AshbyAdapter();
  const config = { jobBoardName: 'acme' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType ASHBY', () => {
    expect(adapter.atsType).toBe('ASHBY');
  });

  it('fetchJobs returns all canonical raw jobs from the board in one request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const jobs = await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.externalId).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('fetchJob fetches the full board and finds the matching job by id — no single-job endpoint exists for this ATS', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const job = await adapter.fetchJob(config, '22222222-3333-4444-5555-666666666666');

    expect(job?.title).toBe('Office Manager');
  });

  it('fetchJob returns null when no job matches', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const job = await adapter.fetchJob(config, 'does-not-exist');
    expect(job).toBeNull();
  });

  it('ping reflects the HTTP response ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));
    expect(await adapter.ping(config)).toBe(true);
  });
});
