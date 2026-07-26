import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createTelegramProvider } from '../telegram-provider.js';
import { TelegramFetcher } from '../telegram-fetcher.js';
import { TelegramMapper } from '../telegram-mapper.js';
import { TelegramNormalizer } from '../telegram-normalizer.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(join(__dirname, '../__fixtures__/telegram-channel-frontend_jobs.html'), 'utf-8');

function htmlResponse(body: string, init?: Partial<{ ok: boolean; status: number; url: string }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    url: init?.url ?? 'https://t.me/s/frontend_jobs',
    text: async () => body,
  } as Response;
}

describe('TelegramProvider', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  describe('createTelegramProvider', () => {
    it('should create a provider with correct info', () => {
      const provider = createTelegramProvider({ channels: ['frontend_jobs'], logger, metrics, tracer });

      expect(provider.info.id).toBe('telegram');
      expect(provider.info.name).toBe('Telegram');
      expect(provider.info.auth.requiresApiKey).toBe(false);
      expect(provider.info.baseUrl).toBe('https://t.me');
    });

    it('should have all required components', () => {
      const provider = createTelegramProvider({ channels: ['frontend_jobs'], logger, metrics, tracer });

      expect(provider.fetcher).toBeInstanceOf(TelegramFetcher);
      expect(provider.mapper).toBeInstanceOf(TelegramMapper);
      expect(provider.normalizer).toBeInstanceOf(TelegramNormalizer);
    });
  });

  describe('end-to-end fetch -> map -> normalize', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return real, non-zero, correctly-mapped vacancies for a recorded channel page', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(fixtureHtml));

      const provider = createTelegramProvider({ channels: ['frontend_jobs'], logger, metrics, tracer });
      const result = await provider.search({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.vacancies).toHaveLength(4);
      expect(result.data.normalization.failed).toHaveLength(0);

      const backend = result.data.vacancies.find((v) => v.sourceId === 'frontend_jobs:103');
      expect(backend?.title).toBe('Backend Developer (Python/Django)');
      expect(backend?.source).toBe('telegram');
      expect(backend?.companyName).toBe('TechCorp');
      expect(backend?.salary?.min).toBe(200000);
    });
  });
});
