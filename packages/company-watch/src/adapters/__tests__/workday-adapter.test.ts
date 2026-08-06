import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkdayAdapter } from '../workday-adapter.js';
import type { AtsConfig } from '../base-adapter.js';

const FIXTURE_RESPONSE = {
  total: 1,
  jobPostings: [
    {
      title: 'Software Engineer II',
      externalPath: '/job/Remote---USA/Software-Engineer-II_R-12345',
      locationsText: 'Remote - USA',
      postedOn: 'Posted Today',
      bulletFields: ['Node.js', 'React', 'Kubernetes'],
      jobReqId: 'R-12345',
    },
  ],
};

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('WorkdayAdapter (company-watch)', () => {
  const adapter = new WorkdayAdapter();
  const config: AtsConfig = {
    careerUrl: 'https://acme.wd1.myworkdayjobs.com',
    metadata: { tenant: 'acme', site: 'External' },
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType WORKDAY', () => {
    expect(adapter.atsType).toBe('WORKDAY');
  });

  it('requests the correct tenant/pod URL — the prior implementation conflated site with the pod number (ADR-033 finding)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    await adapter.fetchJobs(config);

    expect(fetch).toHaveBeenCalledWith(
      'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/External/jobs',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fetches and maps jobs, building description from bulletFields and deriving technologies by regex', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: 'R-12345',
      title: 'Software Engineer II',
      url: 'https://acme.wd1.myworkdayjobs.com/job/Remote---USA/Software-Engineer-II_R-12345',
      location: 'Remote - USA',
      description: 'Node.js\nReact\nKubernetes',
    });
    expect(jobs[0]?.technologies).toEqual(expect.arrayContaining(['react', 'kubernetes']));
  });

  it('parses "Posted Today" into a valid Date, unlike the prior new Date(postedOn) which always produced Invalid Date', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs[0]?.publishedAt).toBeInstanceOf(Date);
    expect(jobs[0]?.publishedAt?.getTime()).not.toBeNaN();
  });

  it('supports an optional host override in metadata, defaulting to wd1.myworkdayjobs.com', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    await adapter.fetchJobs({
      careerUrl: 'https://acme.wd3.myworkdayjobs.com',
      metadata: { tenant: 'acme', site: 'External', host: 'wd3.myworkdayjobs.com' },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://acme.wd3.myworkdayjobs.com/wday/cxs/acme/External/jobs',
      expect.anything(),
    );
  });

  it('throws when tenant or site is missing from metadata', async () => {
    await expect(adapter.fetchJobs({ careerUrl: 'https://x' })).rejects.toThrow(
      'Workday adapter requires tenant and site in metadata',
    );
  });

  it('throws the "Workday API error" message format on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(null, { ok: false, status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(adapter.fetchJobs(config)).rejects.toThrow('Workday API error: 500 Internal Server Error');
  });

  it('returns null for fetchJob when no posting matches', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    const job = await adapter.fetchJob(config, 'missing');
    expect(job).toBeNull();
  });

  it('ping returns false on any error, including missing tenant/site', async () => {
    expect(await adapter.ping({ careerUrl: 'https://x' })).toBe(false);
  });

  it('ping returns true when the jobs endpoint responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));
    expect(await adapter.ping(config)).toBe(true);
  });
});
