import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HHFetcher } from '../hh-fetcher.js';
import { HHMapper } from '../hh-mapper.js';
import { HHNormalizer } from '../hh-normalizer.js';
import { HH_CIS_AREA_IDS } from '../hh-provider.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import type { HHVacancyListResponse } from '../hh-types.js';

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

function vacancy(overrides: Partial<{
  id: string;
  name: string;
  areaId: string;
  areaName: string;
  employerId: string;
  employerName: string;
}>): HHVacancyListResponse['items'][number] {
  const id = overrides.id ?? '1';
  const employerId = overrides.employerId ?? '100';
  return {
    id,
    premium: false,
    name: overrides.name ?? 'Backend Developer',
    area: { id: overrides.areaId ?? '113', name: overrides.areaName ?? 'Россия', url: '' },
    salary: null,
    address: null,
    response_letter_required: false,
    published_at: '2026-07-15T10:00:00+0300',
    created_at: '2026-07-15T10:00:00+0300',
    archived: false,
    url: '',
    alternate_url: `https://hh.ru/vacancy/${id}`,
    employer: {
      id: employerId,
      name: overrides.employerName ?? 'Some Company',
      url: '',
      alternate_url: '',
      vacancies_url: '',
      trusted: true,
    },
    snippet: { requirement: 'Опыт от 2 лет.', responsibility: 'Разработка сервисов.' },
    schedule: { id: 'fullDay', name: 'Полный день' },
    accept_temporary: false,
    professional_roles: [],
    experience: { id: 'between1And3', name: 'От 1 года до 3 лет' },
    employment: { id: 'full', name: 'Полная занятость' },
  };
}

describe('HH CIS multi-country coverage', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();
  const defaultAreas = Object.values(HH_CIS_AREA_IDS);

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('HH_CIS_AREA_IDS', () => {
    it('should list the ten CIS/diaspora countries the sync defaults to', () => {
      expect(HH_CIS_AREA_IDS).toEqual({
        RU: '113',
        BY: '16',
        KZ: '40',
        UZ: '97',
        KG: '48',
        AZ: '9',
        GE: '28',
        AM: '13',
        TJ: '86',
        MD: '62',
      });
    });
  });

  describe('multi-area requests', () => {
    it('should send one repeated `area` param per configured default area when no location is given', async () => {
      const fetcher = new HHFetcher({ baseUrl: 'https://api.hh.ru', areas: defaultAreas, logger, metrics, tracer });
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ items: [], found: 0, pages: 0, per_page: 100, page: 0 }),
      );

      await fetcher.search({});

      const fetchCall = vi.mocked(fetch).mock.calls[0] as [string, unknown] | undefined;
      expect(fetchCall).toBeDefined();
      if (!fetchCall) return;
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.getAll('area')).toEqual(defaultAreas);
    });

    it('should override the configured default areas with an explicit criteria.location', async () => {
      const fetcher = new HHFetcher({ baseUrl: 'https://api.hh.ru', areas: defaultAreas, logger, metrics, tracer });
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ items: [], found: 0, pages: 0, per_page: 100, page: 0 }),
      );

      await fetcher.search({ location: '40' });

      const fetchCall = vi.mocked(fetch).mock.calls[0] as [string, unknown] | undefined;
      expect(fetchCall).toBeDefined();
      if (!fetchCall) return;
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.getAll('area')).toEqual(['40']);
    });

    it('should send no `area` param at all when no areas are configured and no location given (unchanged default behavior)', async () => {
      const fetcher = new HHFetcher({ baseUrl: 'https://api.hh.ru', logger, metrics, tracer });
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ items: [], found: 0, pages: 0, per_page: 100, page: 0 }),
      );

      await fetcher.search({});

      const fetchCall = vi.mocked(fetch).mock.calls[0] as [string, unknown] | undefined;
      expect(fetchCall).toBeDefined();
      if (!fetchCall) return;
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.getAll('area')).toEqual([]);
    });
  });

  describe('cross-region normalization', () => {
    it('should map and normalize vacancies from every configured CIS region correctly', async () => {
      const items = [
        vacancy({ id: 'ru-1', areaId: HH_CIS_AREA_IDS.RU, areaName: 'Москва', employerName: 'Russian Co' }),
        vacancy({ id: 'by-1', areaId: HH_CIS_AREA_IDS.BY, areaName: 'Минск', employerName: 'Belarus Co' }),
        vacancy({ id: 'kz-1', areaId: HH_CIS_AREA_IDS.KZ, areaName: 'Алматы', employerName: 'Kazakh Co' }),
        vacancy({ id: 'uz-1', areaId: HH_CIS_AREA_IDS.UZ, areaName: 'Ташкент', employerName: 'Uzbek Co' }),
        vacancy({ id: 'kg-1', areaId: HH_CIS_AREA_IDS.KG, areaName: 'Бишкек', employerName: 'Kyrgyz Co' }),
        vacancy({ id: 'az-1', areaId: HH_CIS_AREA_IDS.AZ, areaName: 'Баку', employerName: 'Azeri Co' }),
        vacancy({ id: 'ge-1', areaId: HH_CIS_AREA_IDS.GE, areaName: 'Тбилиси', employerName: 'Georgian Co' }),
        vacancy({ id: 'am-1', areaId: HH_CIS_AREA_IDS.AM, areaName: 'Ереван', employerName: 'Armenian Co' }),
        vacancy({ id: 'tj-1', areaId: HH_CIS_AREA_IDS.TJ, areaName: 'Душанбе', employerName: 'Tajik Co' }),
        vacancy({ id: 'md-1', areaId: HH_CIS_AREA_IDS.MD, areaName: 'Кишинёв', employerName: 'Moldovan Co' }),
      ];

      const fetcher = new HHFetcher({ baseUrl: 'https://api.hh.ru', areas: defaultAreas, logger, metrics, tracer });
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ items, found: items.length, pages: 1, per_page: 100, page: 0 }),
      );

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(10);

      const mapper = new HHMapper();
      const normalizer = new HHNormalizer();

      const byCity = new Map(
        result.data.map((raw) => {
          const mapped = mapper.map(raw);
          const normalized = normalizer.normalize(mapped);
          return [raw.sourceId, normalized];
        }),
      );

      expect(byCity.get('ru-1')?.location.city).toBe('Москва');
      expect(byCity.get('by-1')?.location.city).toBe('Минск');
      expect(byCity.get('kz-1')?.location.city).toBe('Алматы');
      expect(byCity.get('uz-1')?.location.city).toBe('Ташкент');
      expect(byCity.get('kg-1')?.location.city).toBe('Бишкек');
      expect(byCity.get('az-1')?.location.city).toBe('Баку');
      expect(byCity.get('ge-1')?.location.city).toBe('Тбилиси');
      expect(byCity.get('am-1')?.location.city).toBe('Ереван');
      expect(byCity.get('tj-1')?.location.city).toBe('Душанбе');
      expect(byCity.get('md-1')?.location.city).toBe('Кишинёв');

      for (const [, normalized] of byCity) {
        expect(normalized.source).toBe('hh');
      }
    });
  });

  describe('deduplication', () => {
    it('should collapse duplicate vacancy IDs returned within the same response into a single RawJob', async () => {
      const duplicateId = 'dup-1';
      const items = [
        vacancy({ id: duplicateId, areaName: 'Москва' }),
        vacancy({ id: duplicateId, areaName: 'Москва' }),
        vacancy({ id: 'unique-1', areaName: 'Минск', areaId: HH_CIS_AREA_IDS.BY }),
      ];

      const fetcher = new HHFetcher({ baseUrl: 'https://api.hh.ru', areas: defaultAreas, logger, metrics, tracer });
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ items, found: items.length, pages: 1, per_page: 100, page: 0 }),
      );

      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const ids = result.data.map((job) => job.sourceId);
      expect(ids).toEqual([duplicateId, 'unique-1']);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
