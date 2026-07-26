import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHabrCareerProvider } from '../habr-career-provider.js';
import { HabrCareerFetcher } from '../habr-career-fetcher.js';
import { HabrCareerMapper } from '../habr-career-mapper.js';
import { HabrCareerNormalizer } from '../habr-career-normalizer.js';
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

describe('HabrCareerProvider', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  describe('createHabrCareerProvider', () => {
    it('should create a provider with correct info', () => {
      const provider = createHabrCareerProvider({ logger, metrics, tracer });

      expect(provider.info.id).toBe('habr_career');
      expect(provider.info.name).toBe('Habr Career');
      expect(provider.info.auth.requiresApiKey).toBe(false);
      expect(provider.info.baseUrl).toBe('https://career.habr.com/vacancies/rss');
    });

    it('should have all required components', () => {
      const provider = createHabrCareerProvider({ logger, metrics, tracer });

      expect(provider.fetcher).toBeInstanceOf(HabrCareerFetcher);
      expect(provider.mapper).toBeInstanceOf(HabrCareerMapper);
      expect(provider.normalizer).toBeInstanceOf(HabrCareerNormalizer);
    });
  });

  describe('end-to-end fetch -> map -> normalize', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return real, non-zero, correctly-mapped vacancies for a recorded feed', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(textResponse(fixtureXml));

      const provider = createHabrCareerProvider({ logger, metrics, tracer });
      const result = await provider.search({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // 4 feed items in, 3 with a real title normalize; the 4th (empty
      // title/description, no company info at all) correctly fails
      // validation rather than being silently accepted.
      expect(result.data.vacancies).toHaveLength(3);
      expect(result.data.normalization.failed).toHaveLength(1);
      expect(result.data.normalization.failed[0]?.reason).toMatch(/title/i);

      const backend = result.data.vacancies.find((v) => v.sourceId === '1000123456');
      expect(backend?.title).toBe('Senior Backend Developer (Python)');
      expect(backend?.source).toBe('habr_career');
      expect(backend?.companyName).toBe('Skyeng');
    });
  });
});
