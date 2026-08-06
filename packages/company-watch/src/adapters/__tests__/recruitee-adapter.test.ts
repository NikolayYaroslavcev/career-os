import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecruiteeAdapter } from '../recruitee-adapter.js';
import type { AtsConfig } from '../base-adapter.js';

const FIXTURE_RESPONSE = {
  offers: [
    {
      id: 1001,
      title: 'Senior Backend Engineer',
      description: 'Building APIs with Node.js and PostgreSQL on a React-based platform.',
      location: 'Berlin, Germany',
      remote: false,
      salary_from: 50000,
      salary_to: 70000,
      employment_type: 'full_time',
      created_at: '2026-07-01T10:00:00.000Z',
      updated_at: '2026-07-05T10:00:00.000Z',
      apply_url: 'https://acme.recruitee.com/o/senior-backend-engineer',
      department: 'Engineering',
      team: 'Platform',
    },
  ],
  meta: { total: 1, per_page: 50, current_page: 1, total_pages: 1 },
};

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('RecruiteeAdapter (company-watch)', () => {
  const adapter = new RecruiteeAdapter();
  const config: AtsConfig = { careerUrl: 'https://acme.recruitee.com', metadata: { company: 'acme' } };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType RECRUITEE', () => {
    expect(adapter.atsType).toBe('RECRUITEE');
  });

  it('fetches and maps jobs, combining department + team into departments and deriving technologies by regex over the description', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: '1001',
      title: 'Senior Backend Engineer',
      url: 'https://acme.recruitee.com/o/senior-backend-engineer',
      location: 'Berlin, Germany',
      salary: { min: 50000, max: 70000, currency: 'EUR' },
      departments: ['Engineering', 'Platform'],
    });
    expect(jobs[0]?.technologies).toEqual(expect.arrayContaining(['react']));
  });

  it('throws when company is missing from metadata', async () => {
    await expect(adapter.fetchJobs({ careerUrl: 'https://x' })).rejects.toThrow(
      'Recruitee adapter requires company in metadata',
    );
  });

  it('throws the "Recruitee API error" message format on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(null, { ok: false, status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(adapter.fetchJobs(config)).rejects.toThrow('Recruitee API error: 500 Internal Server Error');
  });

  it('returns null for fetchJob when no offer matches', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    const job = await adapter.fetchJob(config, 'missing');
    expect(job).toBeNull();
  });

  it('ping returns false on any error, including a missing company', async () => {
    expect(await adapter.ping({ careerUrl: 'https://x' })).toBe(false);
  });

  it('ping returns true when the offers listing responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));
    expect(await adapter.ping(config)).toBe(true);
  });
});
