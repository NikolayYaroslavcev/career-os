import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PersonioFetcher } from '../personio-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixtureXml = readFileSync(
  join(__dirname, '../../../../../ats-adapters/src/__fixtures__/personio-response.xml'),
  'utf-8',
);

function xmlResponse(body: string, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    text: async () => body,
  } as Response;
}

describe('PersonioFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new PersonioFetcher({
    company: 'acme',
    companyName: 'Acme Corp',
    logger,
    metrics,
    tracer,
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should fetch and parse jobs from the XML feed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse(fixtureXml));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.sourceId).toBe('2731150');
    expect(result.data[0]?.companyName).toBe('Acme Corp');
    expect(result.data[0]?.technologies).toEqual(['Kotlin', 'Kafka', 'Backend', 'Distributed Systems']);
    expect(result.data[0]?.experienceLevel).toBe('senior');
    expect(result.data[0]?.employmentType).toBe('full_time');
    expect(result.data[0]?.remote).toBe(true); // office list includes "Remote"
    expect(result.data[1]?.experienceLevel).toBe('junior'); // entry_level -> junior
  });

  it('should apply client-side filtering by technology, but pass through jobs with no keywords (matches Greenhouse fetcher precedent)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse(fixtureXml));

    // Job 1 has keywords (Kotlin/Kafka/...) and matches; job 2 has no
    // <keywords> field at all, so `jobTechs.size === 0` and it passes
    // through any technology filter unfiltered — same semantic as
    // GreenhouseFetcher's matchesCriteria for jobs with no metadata.
    const result = await fetcher.search({ technologies: ['kafka'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.map((j) => j.sourceId)).toEqual(['2731150', '2731151']);
  });

  it('should exclude a job whose keywords do not match the requested technology', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse(fixtureXml));

    const result = await fetcher.search({ technologies: ['rust'] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.map((j) => j.sourceId)).toEqual(['2731151']);
  });

  it('should return a network error on HTTP 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse('', { ok: false, status: 500 }));

    const result = await fetcher.search({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NETWORK_ERROR');
    expect(result.retryable).toBe(true);
  });

  it('should report an exhausted none-cursor for fetchWithCursor since Personio has no pagination', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse(fixtureXml));

    const result = await fetcher.fetchWithCursor({}, { type: 'none', message: '' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hasMore).toBe(false);
    expect(result.data.cursor.exhausted).toBe(true);
  });

  it('should return null from getVacancy when the id is not present in the feed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse(fixtureXml));

    const result = await fetcher.getVacancy('does-not-exist');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('should ping successfully when the feed responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(xmlResponse(fixtureXml, { ok: true, status: 200 }));

    const result = await fetcher.ping();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(true);
  });
});
