import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AshbyAdapter } from '../ashby-adapter.js';
import type { AtsConfig } from '../base-adapter.js';

const FIXTURE_RESPONSE = {
  jobs: [
    {
      id: '11111111-2222-3333-4444-555555555555',
      title: 'Staff Software Engineer',
      departmentName: 'Engineering',
      teamName: 'Infrastructure',
      locationName: 'Remote - North America',
      isRemote: true,
      descriptionHtml: '<p>Lead our infrastructure team using React and Kubernetes.</p>',
      publishedAt: '2026-07-05T00:00:00.000Z',
      employmentType: 'FullTime',
      jobUrl: 'https://jobs.ashbyhq.com/acme/11111111-2222-3333-4444-555555555555',
      applyUrl: 'https://jobs.ashbyhq.com/acme/11111111-2222-3333-4444-555555555555/apply',
    },
  ],
  apiVersion: '1',
};

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('AshbyAdapter (company-watch)', () => {
  const adapter = new AshbyAdapter();
  const config: AtsConfig = { careerUrl: 'https://jobs.ashbyhq.com/acme', metadata: { jobBoardName: 'acme' } };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType ASHBY', () => {
    expect(adapter.atsType).toBe('ASHBY');
  });

  it('embeds jobBoardName in the request URL — the prior GraphQL implementation never did this (ADR-033 finding)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.ashbyhq.com/posting-api/job-board/acme?includeCompensation=true',
      expect.anything(),
    );
  });

  it('fetches and maps jobs, combining departmentName + teamName into departments and deriving technologies by regex over the description', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: '11111111-2222-3333-4444-555555555555',
      title: 'Staff Software Engineer',
      url: 'https://jobs.ashbyhq.com/acme/11111111-2222-3333-4444-555555555555',
      location: 'Remote - North America',
      departments: ['Engineering', 'Infrastructure'],
    });
    expect(jobs[0]?.technologies).toEqual(expect.arrayContaining(['react', 'kubernetes']));
  });

  it('throws when jobBoardName is missing from metadata', async () => {
    await expect(adapter.fetchJobs({ careerUrl: 'https://x' })).rejects.toThrow(
      'Ashby adapter requires jobBoardName in metadata',
    );
  });

  it('throws the "Ashby API error" message format on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(null, { ok: false, status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(adapter.fetchJobs(config)).rejects.toThrow('Ashby API error: 500 Internal Server Error');
  });

  it('returns null for fetchJob when no job matches', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    const job = await adapter.fetchJob(config, 'missing');
    expect(job).toBeNull();
  });

  it('ping returns false on any error, including a missing jobBoardName', async () => {
    expect(await adapter.ping({ careerUrl: 'https://x' })).toBe(false);
  });

  it('ping returns true when the job board listing responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));
    expect(await adapter.ping(config)).toBe(true);
  });
});
