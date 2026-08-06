import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmartRecruitersAdapter } from '../smartrecruiters-adapter.js';
import type { AtsConfig } from '../base-adapter.js';

const FIXTURE_RESPONSE = {
  offset: 0,
  limit: 100,
  totalFound: 1,
  content: [
    {
      id: '7f8a9b2c-0001',
      name: 'Senior Backend Engineer',
      ref: 'posting-0001',
      department: { id: 'd1', name: 'Engineering' },
      occupationArea: { id: 'o1', name: 'Software Engineering' },
      industry: null,
      city: 'Berlin',
      country: 'Germany',
      location: { city: 'Berlin', region: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.405 },
      experienceLevel: { id: 'e1', name: 'Senior' },
      employmentType: { id: 't1', name: 'Full-time' },
      salary: { min: 70000, max: 95000, currency: 'EUR', unit: 'Annual' },
      description: 'We are looking for a Senior Backend Engineer to join our platform team using React and Kubernetes.',
      releasedDate: '2026-07-10T12:00:00.000Z',
      applyUrl: 'https://jobs.smartrecruiters.com/acme/7f8a9b2c-0001',
      language: 'en',
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

describe('SmartRecruitersAdapter (company-watch)', () => {
  const adapter = new SmartRecruitersAdapter();
  const config: AtsConfig = { careerUrl: 'https://jobs.smartrecruiters.com/acme', metadata: { company: 'acme' } };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType SMARTRECRUITERS', () => {
    expect(adapter.atsType).toBe('SMARTRECRUITERS');
  });

  it('fetches and maps jobs, deriving technologies by regex over the description (no metadata array to extract from, unlike Greenhouse)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: '7f8a9b2c-0001',
      title: 'Senior Backend Engineer',
      url: 'https://jobs.smartrecruiters.com/acme/7f8a9b2c-0001',
      location: 'Berlin, Germany',
      salary: { min: 70000, max: 95000, currency: 'EUR' },
      departments: ['Engineering'],
    });
    expect(jobs[0]?.technologies).toEqual(expect.arrayContaining(['react', 'kubernetes']));
  });

  it('throws when company is missing from metadata', async () => {
    await expect(adapter.fetchJobs({ careerUrl: 'https://x' })).rejects.toThrow(
      'SmartRecruiters adapter requires company in metadata',
    );
  });

  it('throws the "SmartRecruiters API error" message format on non-ok, non-404 responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(null, { ok: false, status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(adapter.fetchJobs(config)).rejects.toThrow('SmartRecruiters API error: 500 Internal Server Error');
  });

  it('returns null for fetchJob on a 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));

    const job = await adapter.fetchJob(config, 'missing');
    expect(job).toBeNull();
  });

  it('ping returns false on any error, including a missing company', async () => {
    expect(await adapter.ping({ careerUrl: 'https://x' })).toBe(false);
  });

  it('ping returns true when the postings listing responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));
    expect(await adapter.ping(config)).toBe(true);
  });
});
