import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GreenhouseAdapter } from '../greenhouse-adapter.js';
import type { AtsConfig } from '../base-adapter.js';

const FIXTURE_RESPONSE = {
  jobs: [
    {
      id: 4028547,
      title: 'Senior Backend Engineer',
      updated_at: '2026-07-10T12:00:00-04:00',
      absolute_url: 'https://boards.greenhouse.io/acme/jobs/4028547',
      location: { name: 'Remote - US' },
      content: '<p>We are looking for a Senior Backend Engineer.</p>',
      departments: [{ id: 1, name: 'Engineering' }],
      metadata: [{ id: 1, name: 'Technologies', value: 'Go, Kubernetes, PostgreSQL' }],
      pay_input_ranges: [{ min_cents: 15000000, max_cents: 19000000, currency_type: 'USD' }],
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

describe('GreenhouseAdapter (company-watch)', () => {
  const adapter = new GreenhouseAdapter();
  const config: AtsConfig = { careerUrl: 'https://boards.greenhouse.io/acme', metadata: { boardToken: 'acme' } };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType GREENHOUSE', () => {
    expect(adapter.atsType).toBe('GREENHOUSE');
  });

  it('fetches and maps jobs, including technology extraction', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: '4028547',
      title: 'Senior Backend Engineer',
      url: 'https://boards.greenhouse.io/acme/jobs/4028547',
      location: 'Remote - US',
      salary: { min: 150000, max: 190000, currency: 'USD' },
      technologies: ['Go', 'Kubernetes', 'PostgreSQL'],
      departments: ['Engineering'],
    });
  });

  it('throws when boardToken is missing from metadata', async () => {
    await expect(adapter.fetchJobs({ careerUrl: 'https://x' })).rejects.toThrow(
      'Greenhouse adapter requires boardToken in metadata',
    );
  });

  it('throws the original "Greenhouse API error" message format on non-ok, non-404 responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(null, { ok: false, status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(adapter.fetchJobs(config)).rejects.toThrow('Greenhouse API error: 500 Internal Server Error');
  });

  it('returns null for fetchJob on a 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));

    const job = await adapter.fetchJob(config, 'missing');
    expect(job).toBeNull();
  });

  it('ping returns false on any error, including a missing boardToken', async () => {
    expect(await adapter.ping({ careerUrl: 'https://x' })).toBe(false);
  });

  it('ping returns true when the board listing responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));
    expect(await adapter.ping(config)).toBe(true);
  });
});
