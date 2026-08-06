import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TeamtailorAdapter } from '../teamtailor-adapter.js';
import type { AtsConfig } from '../base-adapter.js';

const FIXTURE_RESPONSE = {
  data: [
    {
      id: '998877',
      type: 'jobs',
      attributes: {
        title: 'Backend Engineer',
        body: '<p>Join our backend team building the core platform using React and Kubernetes.</p>',
        'created-at': '2026-07-02T08:00:00.000Z',
        locationName: 'Remote - Sweden',
        'remote-status': 'fully-remote',
        'employment-type': 'full_time',
        'employment-level': 'senior',
        status: 'published',
      },
      relationships: {
        department: { data: { id: 'dep-1' } },
      },
      links: { 'careersite-job-url': 'https://careers.acme.com/jobs/998877-backend-engineer' },
    },
  ],
  included: [{ id: 'dep-1', type: 'departments', attributes: { name: 'Engineering' } }],
  meta: { 'record-count': 1 },
  links: {},
};

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number; statusText: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('TeamtailorAdapter (company-watch)', () => {
  const adapter = new TeamtailorAdapter();
  const config: AtsConfig = { careerUrl: 'https://careers.acme.com', metadata: { apiKey: 'tt-secret' } };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType TEAMTAILOR', () => {
    expect(adapter.atsType).toBe('TEAMTAILOR');
  });

  it('sends the real Authorization/X-Api-Version headers — the prior X-Api-Key header never matched Teamtailor’s real API (ADR-033 finding)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    await adapter.fetchJobs(config);

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Token token=tt-secret');
    expect(headers['X-Api-Key']).toBeUndefined();
  });

  it('fetches and maps jobs, resolving departments from included relationships and deriving technologies by regex', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(FIXTURE_RESPONSE));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: '998877',
      title: 'Backend Engineer',
      url: 'https://careers.acme.com/jobs/998877-backend-engineer',
      location: 'Remote - Sweden',
      departments: ['Engineering'],
    });
    expect(jobs[0]?.technologies).toEqual(expect.arrayContaining(['react', 'kubernetes']));
  });

  it('throws when apiKey is missing from metadata', async () => {
    await expect(adapter.fetchJobs({ careerUrl: 'https://x' })).rejects.toThrow(
      'Teamtailor adapter requires apiKey in metadata',
    );
  });

  it('throws the "Teamtailor API error" message format on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(null, { ok: false, status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(adapter.fetchJobs(config)).rejects.toThrow('Teamtailor API error: 500 Internal Server Error');
  });

  it('returns null for fetchJob on a 404 — the real single-job endpoint, unlike Ashby/Workday', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));

    const job = await adapter.fetchJob(config, 'missing');
    expect(job).toBeNull();
  });

  it('ping returns false on any error, including a missing apiKey', async () => {
    expect(await adapter.ping({ careerUrl: 'https://x' })).toBe(false);
  });

  it('ping returns true when the jobs listing responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true }));
    expect(await adapter.ping(config)).toBe(true);
  });
});
