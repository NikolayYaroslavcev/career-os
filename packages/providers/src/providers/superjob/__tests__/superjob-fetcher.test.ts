import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SJFetcher } from '../superjob-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import searchFixture from '../__fixtures__/superjob-search-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.status === 429 ? 'Too Many Requests' : 'OK',
    json: async () => body,
  } as Response;
}

describe('SJFetcher', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new SJFetcher({
    baseUrl: 'https://api.superjob.ru/2.33',
    apiKey: 'test-app-id',
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
    it('should send the X-Api-App-Id header on every request', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      await fetcher.search({});

      const [, init] = vi.mocked(fetch).mock.calls[0]!;
      expect((init?.headers as Record<string, string>)['X-Api-App-Id']).toBe('test-app-id');
    });

    it('should map the real objects[] shape (profession, candidat/work) into RawJob', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      const result = await fetcher.search({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data).toHaveLength(3);
      const frontend = result.data[0]!;
      expect(frontend.sourceId).toBe('45678901');
      expect(frontend.title).toBe('Frontend-разработчик (React)');
      expect(frontend.companyName).toBe('ООО Технологии Будущего');
      expect(frontend.companySourceId).toBe('222111');
      expect(frontend.location).toBe('Москва');
      expect(frontend.url).toBe('https://www.superjob.ru/vakansii/frontend-razrabotchik-45678901.html');
      expect(frontend.salary).toEqual({ from: 180000, to: 280000, currency: 'RUB', period: 'monthly' });
    });

    it('should prefer vacancyRichText over work+candidat when present', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const backend = result.data[1]!;
      expect(backend.description).toBe('<p>Ищем <b>Node.js</b> разработчика. Стек: PostgreSQL, Docker.</p>');
    });

    it('should fall back to work + candidat when vacancyRichText is absent', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const frontend = result.data[0]!;
      expect(frontend.description).toContain('Разработка и поддержка пользовательских интерфейсов');
      expect(frontend.description).toContain('Опыт работы с React');
    });

    it('should treat payment_from/payment_to of 0 as "no salary", not free', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const qa = result.data[2]!;
      expect(qa.salary).toBeUndefined();

      const backend = result.data[1]!;
      expect(backend.salary).toEqual({ from: undefined, to: 220000, currency: 'RUB', period: 'monthly' });
    });

    it('should infer remote from place_of_work / profession text (no dedicated remote field)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data[0]?.remote).toBe(false);
      expect(result.data[1]?.remote).toBe(true);
    });

    it('should not paginate past total (single page when objects.length * page >= total)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      await fetcher.search({});

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should return AUTHENTICATION_ERROR with SuperJob\'s message on HTTP 403', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse(
          { error: { code: 403, message: 'Приложение с переданным ключом не найдено', error: null } },
          { ok: false, status: 403 },
        ),
      );

      const result = await fetcher.search({});

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('AUTHENTICATION_ERROR');
      expect(result.retryable).toBe(false);
      expect(result.message).toContain('Приложение с переданным ключом не найдено');
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
    it('should map a single unwrapped vacancy object into RawJob', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture.objects[0]));

      const result = await fetcher.getVacancy('45678901');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data?.sourceId).toBe('45678901');
      expect(result.data?.title).toBe('Frontend-разработчик (React)');
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
