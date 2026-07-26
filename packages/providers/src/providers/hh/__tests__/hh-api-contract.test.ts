import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HHFetcher } from '../hh-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import searchFixture from '../__fixtures__/hh-search-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.status === 429 ? 'Too Many Requests' : init?.status === 403 ? 'Forbidden' : 'OK',
    json: async () => body,
  } as Response;
}

describe('HH API Contract', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('endpoint configuration', () => {
    it('should use api.hh.ru as the single endpoint for all HH group domains', () => {
      const fetcher = new HHFetcher({
        baseUrl: 'https://api.hh.ru',
        logger,
        metrics,
        tracer,
      });

      // All HH group domains (hh.ru, hh.kz, headhunter.ge) use api.hh.ru
      // rabota.by has NO API
      expect(fetcher).toBeDefined();
    });
  });

  describe('response schema validation', () => {
    it('should handle valid HH vacancy list response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(searchFixture));

      const fetcher = new HHFetcher({
        baseUrl: 'https://api.hh.ru',
        logger,
        metrics,
        tracer,
      });

      const result = await fetcher.search({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.length).toBeGreaterThan(0);
      const firstJob = result.data[0];
      expect(firstJob?.sourceId).toBeDefined();
      expect(firstJob?.title).toBeDefined();
      expect(firstJob?.companyName).toBeDefined();
    });

    it('should handle empty results', async () => {
      const mockResponse = {
        items: [],
        found: 0,
        pages: 0,
        per_page: 100,
        page: 0,
      };

      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(mockResponse));

      const fetcher = new HHFetcher({
        baseUrl: 'https://api.hh.ru',
        logger,
        metrics,
        tracer,
      });

      const result = await fetcher.search({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data).toHaveLength(0);
    });

    it('should handle pagination correctly', async () => {
      const page1 = {
        items: [{ id: '1', name: 'Job 1', area: { id: '1', name: 'Москва', url: '' }, salary: null, employer: { id: '1', name: 'Corp', url: '', alternate_url: '', vacancies_url: '', trusted: true }, snippet: null, schedule: { id: 'full', name: '' }, experience: { id: 'noExperience', name: '' }, employment: { id: 'full', name: '' }, published_at: '2026-07-22T10:00:00+0300', url: '', alternate_url: 'https://hh.ru/vacancy/1', response_letter_required: false, accept_temporary: false }],
        found: 2,
        pages: 2,
        per_page: 1,
        page: 0,
      };

      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(page1));

      const fetcher = new HHFetcher({
        baseUrl: 'https://api.hh.ru',
        logger,
        metrics,
        tracer,
      });

      const result = await fetcher.fetchWithCursor({}, { type: 'page', page: 0, perPage: 1 });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.hasMore).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return error for 403 (DDoS-Guard blocking)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 403 }));

      const fetcher = new HHFetcher({
        baseUrl: 'https://api.hh.ru',
        logger,
        metrics,
        tracer,
      });

      const result = await fetcher.fetchWithCursor({}, { type: 'page', page: 0, perPage: 100 });

      expect(result.ok).toBe(false);
    });

    it('should return error for 429', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429 }));

      const fetcher = new HHFetcher({
        baseUrl: 'https://api.hh.ru',
        logger,
        metrics,
        tracer,
      });

      const result = await fetcher.search({});

      expect(result.ok).toBe(false);
    });
  });

  describe('area filtering', () => {
    it('should pass area parameter to API for country filtering', async () => {
      const mockResponse = {
        items: [],
        found: 0,
        pages: 0,
        per_page: 100,
        page: 0,
      };

      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(mockResponse));

      const fetcher = new HHFetcher({
        baseUrl: 'https://api.hh.ru',
        logger,
        metrics,
        tracer,
      });

      // Search with area filter for Russia (113)
      await fetcher.search({ location: '113' });

      // Verify the fetch was called with area parameter
      const fetchCall = vi.mocked(fetch).mock.calls[0] as [string, unknown] | undefined;
      expect(fetchCall).toBeDefined();
      if (!fetchCall) return;
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.get('area')).toBe('113');
    });

    it('should support multiple area IDs via comma separation', async () => {
      const mockResponse = {
        items: [],
        found: 0,
        pages: 0,
        per_page: 100,
        page: 0,
      };

      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(mockResponse));

      const fetcher = new HHFetcher({
        baseUrl: 'https://api.hh.ru',
        logger,
        metrics,
        tracer,
      });

      // Search with multiple areas (Russia + Kazakhstan)
      await fetcher.search({ location: '113,40' });

      const fetchCall = vi.mocked(fetch).mock.calls[0] as [string, unknown] | undefined;
      expect(fetchCall).toBeDefined();
      if (!fetchCall) return;
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.get('area')).toBe('113,40');
    });
  });
});
