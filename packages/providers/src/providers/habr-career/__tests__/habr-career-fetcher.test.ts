import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { HabrCareerFetcher } from '../habr-career-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureXml = readFileSync(join(__dirname, '../__fixtures__/habr-career-response.xml'), 'utf-8');

function textResponse(body: string, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    text: async () => body,
  } as Response;
}

describe('HabrCareerFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new HabrCareerFetcher({
    baseUrl: 'https://career.habr.com/vacancies/rss',
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

  it('parses a recorded RSS feed into RawJobs with real field extraction', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(textResponse(fixtureXml));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(4);

    const [backend, frontend, qa, empty] = result.data;

    expect(backend?.sourceId).toBe('1000123456');
    expect(backend?.title).toBe('Senior Backend Developer (Python)');
    expect(backend?.companyName).toBe('Skyeng');
    expect(backend?.url).toBe('https://career.habr.com/vacancies/1000123456');
    expect(backend?.location).toBe('Москва');
    expect(backend?.remote).toBe(true);
    expect(backend?.salary).toEqual({ from: 250000, to: 350000, currency: 'RUB', period: 'monthly' });
    expect(backend?.technologies).toEqual(expect.arrayContaining(['python', 'django', 'postgresql', 'docker', 'backend']));

    expect(frontend?.sourceId).toBe('1000123457');
    expect(frontend?.title).toBe('Frontend Developer (React/TypeScript)');
    expect(frontend?.companyName).toBe('ИнновейтТех');
    expect(frontend?.location).toBe('Минск');
    expect(frontend?.remote).toBe(false);
    expect(frontend?.technologies).toEqual(expect.arrayContaining(['react', 'typescript']));

    // No trailing "(Company)" in the title and no company field in RSS —
    // falls back to 'Unknown' rather than guessing.
    expect(qa?.title).toBe('QA Engineer');
    expect(qa?.companyName).toBe('Unknown');
    expect(qa?.remote).toBe(true);
    expect(qa?.location).toBe('Удалённо');

    // Empty title/description doesn't crash parsing — falls back to a
    // link-derived sourceId, same defensive pattern as NoDeskFetcher.
    expect(empty?.title).toBe('');
    expect(empty?.sourceId).toBe('1000123459');
    expect(empty?.location).toBe('Не указано');
  });

  it('produces a unique sourceId per item so downstream dedup has something to key on', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(textResponse(fixtureXml));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.data.map((job) => job.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not throw and returns an empty list for a feed with no items', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      textResponse('<?xml version="1.0"?><rss><channel><title>Empty</title></channel></rss>')
    );

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('does not throw on completely malformed (non-XML) payloads', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(textResponse('this is not xml at all {{{'));

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('returns a network error instead of throwing on a non-ok HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(textResponse('', { ok: false, status: 404 }));
    const result = await fetcher.search({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NETWORK_ERROR');
  });

  describe('getVacancy', () => {
    it('finds a single vacancy by sourceId out of the full feed', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(textResponse(fixtureXml));

      const result = await fetcher.getVacancy('1000123457');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data?.title).toBe('Frontend Developer (React/TypeScript)');
    });
  });

  describe('ping', () => {
    it('reports healthy when the feed responds ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(textResponse(fixtureXml, { ok: true, status: 200 }));

      const result = await fetcher.ping();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toBe(true);
    });
  });
});
