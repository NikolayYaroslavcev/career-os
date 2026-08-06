import { describe, it, expect } from 'vitest';
import { BotApiTransport } from '../bot-api-transport.js';
import { NoopLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import type { ChannelPostInput } from '../bot-api-transport.js';

function post(overrides: Partial<ChannelPostInput> = {}): ChannelPostInput {
  return {
    sourceId: 'remoteit',
    externalMessageId: '42',
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    rawText: 'We are hiring a backend developer',
    ...overrides,
  };
}

function makeTransport(maxBufferPerSource?: number): BotApiTransport {
  return new BotApiTransport({
    logger: new NoopLogger(),
    metrics: new InMemoryMetricsCollector(),
    tracer: new InMemoryTracer(),
    maxBufferPerSource,
  });
}

describe('BotApiTransport', () => {
  it('reports transportType BOT_API and capability API', () => {
    const transport = makeTransport();
    expect(transport.transportType).toBe('BOT_API');
    expect(transport.capability).toBe('API');
  });

  describe('ingest + fetch', () => {
    it('buffers an ingested channel_post and returns it on the next fetch', async () => {
      const transport = makeTransport();
      const error = transport.ingest(post());
      expect(error).toBeNull();

      const result = await transport.fetch({ sourceId: 'remoteit' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.messages).toHaveLength(1);
        expect(result.data.messages[0]?.externalMessageId).toBe('42');
      }
    });

    it('drains the buffer — a second fetch with nothing new ingested returns nothing', async () => {
      const transport = makeTransport();
      transport.ingest(post());
      await transport.fetch({ sourceId: 'remoteit' });

      const second = await transport.fetch({ sourceId: 'remoteit' });

      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.data.messages).toHaveLength(0);
      }
    });

    it('only returns candidates for the requested sourceId', async () => {
      const transport = makeTransport();
      transport.ingest(post({ sourceId: 'remoteit', externalMessageId: '1' }));
      transport.ingest(post({ sourceId: 'other_channel', externalMessageId: '2' }));

      const result = await transport.fetch({ sourceId: 'remoteit' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.messages).toHaveLength(1);
        expect(result.data.messages[0]?.externalMessageId).toBe('1');
      }
    });

    it('caps the ring buffer at maxBufferPerSource, dropping the oldest entries', async () => {
      const transport = makeTransport(2);
      transport.ingest(post({ externalMessageId: '1' }));
      transport.ingest(post({ externalMessageId: '2' }));
      transport.ingest(post({ externalMessageId: '3' }));

      const result = await transport.fetch({ sourceId: 'remoteit' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.messages.map((m) => m.externalMessageId)).toEqual(['2', '3']);
      }
    });
  });

  describe('cursor handling', () => {
    it('filters buffered candidates by cursor.since', async () => {
      const transport = makeTransport();
      transport.ingest(post({ externalMessageId: '1', publishedAt: new Date('2026-01-01T00:00:00Z') }));
      transport.ingest(post({ externalMessageId: '2', publishedAt: new Date('2026-01-02T00:00:00Z') }));

      const result = await transport.fetch({ sourceId: 'remoteit' }, { since: new Date('2026-01-01T12:00:00Z') });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.messages.map((m) => m.externalMessageId)).toEqual(['2']);
      }
    });

    it('caps results at cursor.maxResults, reports hasMore, and keeps the remainder buffered', async () => {
      const transport = makeTransport();
      transport.ingest(post({ externalMessageId: '1' }));
      transport.ingest(post({ externalMessageId: '2' }));
      transport.ingest(post({ externalMessageId: '3' }));

      const first = await transport.fetch({ sourceId: 'remoteit' }, { maxResults: 2 });
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.data.messages).toHaveLength(2);
        expect(first.data.hasMore).toBe(true);
      }

      const second = await transport.fetch({ sourceId: 'remoteit' });
      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.data.messages.map((m) => m.externalMessageId)).toEqual(['3']);
      }
    });
  });

  describe('invalid message rejection', () => {
    it('rejects and never buffers a channel_post with empty text', () => {
      const transport = makeTransport();
      const error = transport.ingest(post({ rawText: '   ' }));

      expect(error).not.toBeNull();
      expect(error?.field).toBe('rawText');
    });

    it('rejects a channel_post missing externalMessageId', () => {
      const transport = makeTransport();
      const error = transport.ingest(post({ externalMessageId: '' }));

      expect(error).not.toBeNull();
      expect(error?.field).toBe('externalMessageId');
    });

    it('an invalid ingest never surfaces through a later fetch', async () => {
      const transport = makeTransport();
      transport.ingest(post({ rawText: '' }));

      const result = await transport.fetch({ sourceId: 'remoteit' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.messages).toHaveLength(0);
      }
    });
  });

  describe('validate', () => {
    it('exposes the same validation independently of ingest', () => {
      const transport = makeTransport();
      expect(transport.validate({ sourceId: 'x', externalMessageId: '1', publishedAt: new Date(), rawText: 'hi', links: [] })).toBeNull();
      expect(transport.validate({ sourceId: '', externalMessageId: '1', publishedAt: new Date(), rawText: 'hi', links: [] })).not.toBeNull();
    });
  });
});
