import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HHFetcher } from '../hh-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import searchFixture from '../__fixtures__/hh-search-response.json' with { type: 'json' };
import detailFixture from '../__fixtures__/hh-vacancy-detail.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.status === 429 ? 'Too Many Requests' : 'OK',
    json: async () => body,
  } as Response;
}

describe('HHFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new HHFetcher({
    baseUrl: 'https://api.hh.ru',
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

  describe('search', () => {
    it('should map the real list-endpoint shape (name, snippet) into RawJob', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      const result = await fetcher.search({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data).toHaveLength(3);
      const frontend = result.data[0]!;
      expect(frontend.sourceId).toBe('98765432');
      expect(frontend.title).toBe('Frontend Developer (React)');
      expect(frontend.companyName).toBe('Tech Company LLC');
      expect(frontend.companySourceId).toBe('111');
      expect(frontend.location).toBe('Москва');
      expect(frontend.url).toBe('https://hh.ru/vacancy/98765432');
      expect(frontend.salary).toEqual({ from: 200000, to: 300000, currency: 'RUR', period: 'monthly' });
    });

    it('should build description from snippet.responsibility + snippet.requirement, not a nonexistent flat description field', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const frontend = result.data[0]!;
      expect(frontend.description).toContain('Разработка и поддержка пользовательских интерфейсов');
      expect(frontend.description).toContain('Опыт работы с');
    });

    it('should handle a null snippet.requirement without crashing', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const qa = result.data[2]!;
      expect(qa.description).toBe('Тестирование веб-приложений, написание тест-кейсов.');
      expect(qa.salary).toEqual({ from: undefined, to: 80000, currency: 'RUR', period: 'monthly' });
    });

    it('should detect remote via schedule.id, not the old (incorrect) ё-containing string match', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data[0]?.remote).toBe(false);
      expect(result.data[1]?.remote).toBe(true);
    });

    it('should extract technologies by keyword from title + description (list endpoint has no key_skills)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data[0]?.technologies).toEqual(expect.arrayContaining(['react', 'typescript']));
      expect(result.data[1]?.technologies).toEqual(expect.arrayContaining(['node', 'postgresql', 'docker']));
    });

    it('should not paginate past the reported page count', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      await fetcher.search({});

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should return a rate-limited error on HTTP 429', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429 }));

      const result = await fetcher.search({});

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('RATE_LIMITED');
      expect(result.retryable).toBe(true);
    });
  });

  describe('getVacancy', () => {
    it('should use the detail endpoint\'s real description and key_skills — never the list snippet', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(detailFixture));

      const result = await fetcher.getVacancy('98765432');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data?.title).toBe('Frontend Developer (React)');
      expect(result.data?.description).toContain('О компании');
      expect(result.data?.technologies).toEqual(expect.arrayContaining(['react', 'typescript', 'redux']));
    });

    it('should return null on a 404', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));

      const result = await fetcher.getVacancy('does-not-exist');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toBeNull();
    });
  });

  describe('ping', () => {
    it('should report healthy when the API responds ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: true, status: 200 }));

      const result = await fetcher.ping();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toBe(true);
    });
  });
});
