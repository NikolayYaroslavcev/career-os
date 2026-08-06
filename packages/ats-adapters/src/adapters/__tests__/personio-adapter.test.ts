import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PersonioAdapter } from '../personio-adapter.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixtureXml = readFileSync(join(__dirname, '../../__fixtures__/personio-response.xml'), 'utf-8');

function xmlResponse(body: string, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    text: async () => body,
  } as Response;
}

describe('PersonioAdapter', () => {
  const adapter = new PersonioAdapter();
  const config = { company: 'acme' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has atsType PERSONIO', () => {
    expect(adapter.atsType).toBe('PERSONIO');
  });

  it('fetchJobs returns all canonical raw jobs from the XML feed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse(fixtureXml));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.externalId).toBe('2731150');
    expect(jobs[0]?.title).toBe('Senior Backend Engineer (m/f/d)');
    expect(jobs[0]?.url).toBe('https://acme.jobs.personio.de/job/2731150?language=en');
    expect(jobs[0]?.location).toBe('Berlin, Munich, Remote');
    expect(jobs[0]?.description).toContain('Build and scale');
    expect(jobs[0]?.description).toContain('Kotlin & Kafka');
    expect(jobs[0]?.departments).toEqual(['Engineering']);
    expect(jobs[0]?.publishedAt).toEqual(new Date('2026-06-25T17:23:34+00:00'));
  });

  it('handles a position with no jobDescriptions and no additional offices', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse(fixtureXml));

    const jobs = await adapter.fetchJobs(config);

    expect(jobs[1]?.externalId).toBe('2731151');
    expect(jobs[1]?.location).toBe('Remote');
    expect(jobs[1]?.description).toBe('');
  });

  it('fetchJob returns a single canonical raw job filtered from the full feed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse(fixtureXml));

    const job = await adapter.fetchJob(config, '2731151');

    expect(job?.externalId).toBe('2731151');
    expect(job?.title).toBe('Junior Data Engineer');
  });

  it('fetchJob returns null when the id is not present in the feed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse(fixtureXml));

    const job = await adapter.fetchJob(config, 'missing');
    expect(job).toBeNull();
  });

  it('fetchJobs returns an empty array for a company with no open positions', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse('<?xml version="1.0" encoding="UTF-8"?>\n\n<workzag-jobs>\n\n\n</workzag-jobs>'));

    const jobs = await adapter.fetchJobs(config);
    expect(jobs).toEqual([]);
  });

  it('ping reflects the HTTP response ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse('', { ok: true }));
    expect(await adapter.ping(config)).toBe(true);
  });

  it('builds the feed URL from company + language, defaulting language to en', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse(fixtureXml));
    await adapter.fetchJobs(config);

    const fetchCall = vi.mocked(fetch).mock.calls[0] as [string, unknown] | undefined;
    expect(fetchCall?.[0]).toBe('https://acme.jobs.personio.de/xml?language=en');
  });
});
