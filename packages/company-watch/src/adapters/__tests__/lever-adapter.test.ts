import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LeverAdapter } from '../lever-adapter.js';
import type { AtsConfig } from '../base-adapter.js';

const FIXTURE_RESPONSE = [
  {
    id: 'a1b2c3d4-1111-2222-3333-444455556666',
    text: 'Senior Backend Engineer',
    categories: {
      commitment: 'Full-time',
      department: 'Engineering',
      location: 'Remote - US',
      team: 'Platform',
      allLocations: ['Remote - US'],
    },
    description: '<div>We are looking for a Senior Backend Engineer to join our platform team using React and Kubernetes.</div>',
    descriptionPlain: 'We are looking for a Senior Backend Engineer to join our platform team using React and Kubernetes.',
    lists: [],
    hostedUrl: 'https://jobs.lever.co/acme/a1b2c3d4-1111-2222-3333-444455556666',
    applyUrl: 'https://jobs.lever.co/acme/a1b2c3d4-1111-2222-3333-444455556666/apply',
    createdAt: 1752105600000,
    workplaceType: 'remote',
    salaryRange: { min: 150000, max: 190000, currency: 'USD', interval: 'per-year-salary' },
    tags: ['go', 'kubernetes'],
  },
];

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('LeverAdapter (company-watch)', () => {
  const adapter = new LeverAdapter();
  const config: AtsConfig = { careerUrl: 'https://jobs.lever.co/acme', metadata: { company: 'acme' } };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType LEVER', () => {
    expect(adapter.atsType).toBe('LEVER');
  });

  it('fetches and maps jobs, combining department + team into departments', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: 'a1b2c3d4-1111-2222-3333-444455556666',
      title: 'Senior Backend Engineer',
      url: 'https://jobs.lever.co/acme/a1b2c3d4-1111-2222-3333-444455556666',
      location: 'Remote - US',
      departments: ['Engineering', 'Platform'],
    });
  });

  it('extracts technologies by regex over the description, not from the raw tags field (differs from providers by design)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    const jobs = await adapter.fetchJobs(config);

    // Description mentions "React" and "Kubernetes" (not the raw tags ["go", "kubernetes"]).
    expect(jobs[0]?.technologies).toEqual(expect.arrayContaining(['react', 'kubernetes']));
  });

  it('never returns salary for Lever — the original code reads a `salary` field that does not exist on real Lever postings (see ADR-033 addendum)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs[0]?.salary).toBeUndefined();
  });

  it('throws when company is missing from metadata', async () => {
    await expect(adapter.fetchJobs({ careerUrl: 'https://x' })).rejects.toThrow(
      'Lever adapter requires company in metadata',
    );
  });

  it('throws the original "Lever API error" message format on non-ok, non-404 responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(null, { ok: false, status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(adapter.fetchJobs(config)).rejects.toThrow('Lever API error: 500 Internal Server Error');
  });

  it('returns null for fetchJob on a 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));

    const job = await adapter.fetchJob(config, 'missing');
    expect(job).toBeNull();
  });

  it('ping returns false on any error, including a missing company', async () => {
    expect(await adapter.ping({ careerUrl: 'https://x' })).toBe(false);
  });

  it('ping returns true when the listing responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));
    expect(await adapter.ping(config)).toBe(true);
  });
});
