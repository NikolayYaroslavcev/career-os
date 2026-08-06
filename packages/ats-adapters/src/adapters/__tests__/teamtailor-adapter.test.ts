import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TeamtailorAdapter } from '../teamtailor-adapter.js';
import fixtureResponse from '../../__fixtures__/teamtailor-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('TeamtailorAdapter', () => {
  const adapter = new TeamtailorAdapter();
  const config = { apiKey: 'tt-secret' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType TEAMTAILOR', () => {
    expect(adapter.atsType).toBe('TEAMTAILOR');
  });

  it('fetchJobs returns all canonical raw jobs when there is no next link', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const jobs = await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.departments).toEqual(['Engineering', 'Backend']);
  });

  it('fetchJobs follows the `next` link across pages', async () => {
    const page1 = { ...fixtureResponse, links: { next: 'https://api.teamtailor.com/v1/jobs?page=2' } };
    const page2 = { data: [fixtureResponse.data[0]], links: {} };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2));

    const jobs = await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(jobs).toHaveLength(3);
  });

  it('fetchJob uses the real single-job endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: fixtureResponse.data[0], included: fixtureResponse.included }));

    const job = await adapter.fetchJob(config, '998877');

    expect(job?.title).toBe('Backend Engineer');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.teamtailor.com/v1/jobs/998877?include=department,role',
      expect.anything(),
    );
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
