import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkableAdapter } from '../workable-adapter.js';
import fixtureResponse from '../../__fixtures__/workable-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('WorkableAdapter', () => {
  const adapter = new WorkableAdapter();
  const config = { accountSlug: 'acme-ai' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType WORKABLE', () => {
    expect(adapter.atsType).toBe('WORKABLE');
  });

  it('fetchJobs returns all canonical raw jobs, using application_url (not url) as the canonical URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.externalId).toBe('F4C096B22E');
    expect(jobs[0]?.title).toBe('Senior Backend Engineer, Platform');
    expect(jobs[0]?.url).toBe('https://apply.workable.com/j/F4C096B22E/apply');
    expect(jobs[0]?.location).toBe('Paris, Île-de-France, France');
    expect(jobs[0]?.departments).toEqual(['Engineering']);
  });

  it('fetchJob returns a single canonical raw job filtered from the full widget list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const job = await adapter.fetchJob(config, 'A1B2C3D4E5');

    expect(job?.externalId).toBe('A1B2C3D4E5');
    expect(job?.title).toBe('Junior Frontend Engineer');
  });

  it('fetchJob returns null when the shortcode is not present', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const job = await adapter.fetchJob(config, 'missing');
    expect(job).toBeNull();
  });

  it('fetchJobs returns an empty array for an account with no open jobs', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ name: 'Empty Co', jobs: [] }));

    const jobs = await adapter.fetchJobs(config);
    expect(jobs).toEqual([]);
  });

  it('ping reflects the HTTP response ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse, { ok: true }));
    expect(await adapter.ping(config)).toBe(true);
  });

  it('builds the widget URL from accountSlug with details=true', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));
    await adapter.fetchJobs(config);

    const fetchCall = vi.mocked(fetch).mock.calls[0] as [string, unknown] | undefined;
    expect(fetchCall?.[0]).toBe('https://apply.workable.com/api/v1/widget/accounts/acme-ai?details=true');
  });
});
