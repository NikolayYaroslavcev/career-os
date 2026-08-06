import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { HtmlPreviewTransport } from '../html-preview-transport.js';
import { TelegramFetcher } from '../telegram-fetcher.js';
import { NoopLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import type { TelegramRawMessage } from '../telegram-types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(join(__dirname, '../__fixtures__/telegram-channel-frontend_jobs.html'), 'utf-8');

function htmlResponse(body: string): Response {
  return { ok: true, status: 200, statusText: 'OK', url: 'https://t.me/s/frontend_jobs', text: async () => body } as Response;
}

describe('HtmlPreviewTransport', () => {
  const logger = new NoopLogger();
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  describe('reusing TelegramFetcher', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('produces one candidate per non-service message, skipping V1 vacancy classification entirely', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(htmlResponse(fixtureHtml));
      const fetcher = new TelegramFetcher({ channels: [], logger, metrics, tracer });
      const transport = new HtmlPreviewTransport({ logger, metrics, tracer, fetcher });

      const result = await transport.fetch({ sourceId: 'frontend_jobs' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // 6 posts in the fixture, 1 service message excluded — unlike
      // TelegramFetcher.search() (4 results), this transport does not apply
      // isLikelyVacancyPost classification, so the chit-chat post (106) stays.
      expect(result.data.messages.map((m) => m.externalMessageId)).toEqual(['102', '103', '104', '105', '106']);
      expect(result.data.messages.every((m) => m.sourceId === 'frontend_jobs')).toBe(true);
    });

    it('reports transportType HTML_PREVIEW and capability PULL', () => {
      const fetcher = new TelegramFetcher({ channels: [], logger, metrics, tracer });
      const transport = new HtmlPreviewTransport({ logger, metrics, tracer, fetcher });
      expect(transport.transportType).toBe('HTML_PREVIEW');
      expect(transport.capability).toBe('PULL');
    });

    it('surfaces a retryable NETWORK_ERROR when the underlying fetch fails', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('DNS failure'));
      const fetcher = new TelegramFetcher({ channels: [], logger, metrics, tracer });
      const transport = new HtmlPreviewTransport({ logger, metrics, tracer, fetcher });

      const result = await transport.fetch({ sourceId: 'frontend_jobs' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.retryable).toBe(true);
      }
    });
  });

  describe('cursor handling', () => {
    function rawMessage(overrides: Partial<TelegramRawMessage> = {}): TelegramRawMessage {
      return {
        channel: 'frontend_jobs',
        messageId: '1',
        textHtml: 'Hiring a developer',
        text: 'Hiring a developer',
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        links: [],
        isServiceMessage: false,
        ...overrides,
      };
    }

    function stubFetcher(messages: TelegramRawMessage[]): TelegramFetcher {
      return { fetchRawMessages: vi.fn().mockResolvedValue(messages) } as unknown as TelegramFetcher;
    }

    it('filters out messages published at or before cursor.since', async () => {
      const fetcher = stubFetcher([
        rawMessage({ messageId: '1', publishedAt: new Date('2026-01-01T00:00:00Z') }),
        rawMessage({ messageId: '2', publishedAt: new Date('2026-01-02T00:00:00Z') }),
      ]);
      const transport = new HtmlPreviewTransport({ logger, metrics, tracer, fetcher });

      const result = await transport.fetch({ sourceId: 'frontend_jobs' }, { since: new Date('2026-01-01T12:00:00Z') });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.messages).toHaveLength(1);
        expect(result.data.messages[0]?.externalMessageId).toBe('2');
      }
    });

    it('caps results at cursor.maxResults and reports hasMore', async () => {
      const fetcher = stubFetcher([rawMessage({ messageId: '1' }), rawMessage({ messageId: '2' }), rawMessage({ messageId: '3' })]);
      const transport = new HtmlPreviewTransport({ logger, metrics, tracer, fetcher });

      const result = await transport.fetch({ sourceId: 'frontend_jobs' }, { maxResults: 2 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.messages).toHaveLength(2);
        expect(result.data.hasMore).toBe(true);
      }
    });

    it('drops service messages regardless of cursor', async () => {
      const fetcher = stubFetcher([rawMessage({ messageId: '1', isServiceMessage: true }), rawMessage({ messageId: '2' })]);
      const transport = new HtmlPreviewTransport({ logger, metrics, tracer, fetcher });

      const result = await transport.fetch({ sourceId: 'frontend_jobs' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.messages).toHaveLength(1);
        expect(result.data.messages[0]?.externalMessageId).toBe('2');
      }
    });
  });

  describe('validate', () => {
    it('rejects a candidate with empty rawText', () => {
      const fetcher = { fetchRawMessages: vi.fn() } as unknown as TelegramFetcher;
      const transport = new HtmlPreviewTransport({ logger, metrics, tracer, fetcher });

      const error = transport.validate({
        sourceId: 'frontend_jobs',
        externalMessageId: '1',
        publishedAt: new Date(),
        rawText: '   ',
        links: [],
      });

      expect(error).not.toBeNull();
      expect(error?.field).toBe('rawText');
    });

    it('accepts a well-formed candidate', () => {
      const fetcher = { fetchRawMessages: vi.fn() } as unknown as TelegramFetcher;
      const transport = new HtmlPreviewTransport({ logger, metrics, tracer, fetcher });

      const error = transport.validate({
        sourceId: 'frontend_jobs',
        externalMessageId: '1',
        publishedAt: new Date(),
        rawText: 'Hiring a developer',
        links: [],
      });

      expect(error).toBeNull();
    });
  });
});
