import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoopLogger, InMemoryMetricsCollector } from '@careeros/providers';
import type { TransportManager, TransportSource } from '@careeros/providers';
import {
  SocialMessage,
  SocialPlatform,
  createSocialMessageId,
  TransportType,
} from '@careeros/career';
import type { SocialMessageRepository, UpsertRawSocialMessageInput } from '@careeros/career';
import { SocialMessageIngestionService } from '../social-message-ingestion-service.js';

class FakeSocialMessageRepository implements SocialMessageRepository {
  private readonly rows = new Map<string, SocialMessage>();

  private key(platform: string, sourceId: string, externalMessageId: string): string {
    return `${platform}::${sourceId}::${externalMessageId}`;
  }

  async upsertRaw(input: UpsertRawSocialMessageInput): Promise<SocialMessage> {
    const key = this.key(input.platform, input.sourceId, input.externalMessageId);
    const existing = this.rows.get(key);
    if (existing) return existing;

    const message = SocialMessage.create({
      id: createSocialMessageId(key),
      platform: input.platform,
      sourceId: input.sourceId,
      sourceName: input.sourceName,
      externalMessageId: input.externalMessageId,
      authorUsername: input.authorUsername,
      publishedAt: input.publishedAt,
      rawText: input.rawText,
      rawHtml: input.rawHtml,
      media: input.media,
      links: input.links,
      language: input.language,
      contentHash: input.contentHash,
      transport: input.transport,
    });
    this.rows.set(key, message);
    return message;
  }

  async findById(): Promise<SocialMessage | null> {
    throw new Error('not used in this test');
  }

  async findBySourceAndExternalId(platform: SocialPlatform, sourceId: string, externalMessageId: string): Promise<SocialMessage | null> {
    return this.rows.get(this.key(platform, sourceId, externalMessageId)) ?? null;
  }

  async findPendingBySource(): Promise<SocialMessage[]> {
    return [];
  }

  async findPending(): Promise<SocialMessage[]> {
    return [];
  }

  async findBySourceSince(): Promise<SocialMessage[]> {
    return [];
  }

  async findLatestBySource(platform: SocialPlatform, sourceId: string): Promise<SocialMessage | null> {
    const matches = [...this.rows.values()].filter((m) => m.platform === platform && m.sourceId === sourceId);
    if (matches.length === 0) return null;
    return matches.reduce((latest, m) => (m.publishedAt > latest.publishedAt ? m : latest));
  }

  async updateStatus(): Promise<void> {}

  async countBySource(platform: SocialPlatform, sourceId: string): Promise<number> {
    return [...this.rows.values()].filter((m) => m.platform === platform && m.sourceId === sourceId).length;
  }

  async countBySourceAndStatus(): Promise<number> {
    return 0;
  }
}

function candidate(overrides: Partial<{ externalMessageId: string; publishedAt: Date; rawText: string }> = {}) {
  return {
    sourceId: 'frontend_jobs',
    externalMessageId: overrides.externalMessageId ?? '1',
    publishedAt: overrides.publishedAt ?? new Date('2026-01-01T00:00:00Z'),
    rawText: overrides.rawText ?? 'We are hiring a developer',
    rawHtml: '<p>We are hiring a developer</p>',
    links: [] as string[],
  };
}

function fakeTransportManager(messages: ReturnType<typeof candidate>[]) {
  const health = { state: 'healthy' as const, consecutiveFailures: 0, consecutiveSuccesses: 1, avgLatencyMs: 5, providerId: 'telegram', transportType: 'HTML_PREVIEW' };
  return {
    fetch: vi.fn().mockResolvedValue({
      ok: true,
      data: { messages, hasMore: false, meta: {} },
      meta: { durationMs: 10, providerMeta: { transportType: 'HTML_PREVIEW' } },
    }),
    getHealth: vi.fn().mockReturnValue(health),
  } as unknown as TransportManager;
}

const source: TransportSource = { sourceId: 'frontend_jobs' };

describe('SocialMessageIngestionService', () => {
  let repository: FakeSocialMessageRepository;
  let logger: NoopLogger;
  let metrics: InMemoryMetricsCollector;

  beforeEach(() => {
    repository = new FakeSocialMessageRepository();
    logger = new NoopLogger();
    metrics = new InMemoryMetricsCollector();
  });

  it('persists every valid candidate as a SocialMessage with the transport that served it', async () => {
    const transportManager = fakeTransportManager([candidate()]);
    const service = new SocialMessageIngestionService(transportManager, repository, logger, metrics);

    const result = await service.ingestSource('telegram', SocialPlatform.TELEGRAM, source);

    expect(result).toEqual({ fetched: 1, persisted: 1, duplicatesSkipped: 0 });
    const stored = await repository.findBySourceAndExternalId(SocialPlatform.TELEGRAM, 'frontend_jobs', '1');
    expect(stored).not.toBeNull();
    expect(stored?.transport).toBe(TransportType.HTML_PREVIEW);
    expect(stored?.rawText).toBe('We are hiring a developer');
    expect(stored?.contentHash).toHaveLength(64); // sha256 hex
  });

  it('is idempotent across repeated ingestion of the same message', async () => {
    const transportManager = fakeTransportManager([candidate()]);
    const service = new SocialMessageIngestionService(transportManager, repository, logger, metrics);

    await service.ingestSource('telegram', SocialPlatform.TELEGRAM, source);
    const second = await service.ingestSource('telegram', SocialPlatform.TELEGRAM, source);

    expect(second).toEqual({ fetched: 1, persisted: 0, duplicatesSkipped: 1 });
    expect(await repository.countBySource(SocialPlatform.TELEGRAM, 'frontend_jobs')).toBe(1);
  });

  it('derives the next fetch cursor from the latest persisted message for that source', async () => {
    const first = candidate({ externalMessageId: '1', publishedAt: new Date('2026-01-01T00:00:00Z') });
    const transportManager = fakeTransportManager([first]);
    const service = new SocialMessageIngestionService(transportManager, repository, logger, metrics);

    await service.ingestSource('telegram', SocialPlatform.TELEGRAM, source);
    expect(transportManager.fetch).toHaveBeenNthCalledWith(1, 'telegram', source, { cursor: undefined });

    await service.ingestSource('telegram', SocialPlatform.TELEGRAM, source);
    expect(transportManager.fetch).toHaveBeenNthCalledWith(2, 'telegram', source, { cursor: { since: first.publishedAt } });
  });

  it('handles a failed fetch without throwing and reports zero counts', async () => {
    const transportManager = {
      fetch: vi.fn().mockResolvedValue({ ok: false, error: 'NETWORK_ERROR', message: 'down', retryable: true, meta: { durationMs: 1 } }),
      getHealth: vi.fn(),
    } as unknown as TransportManager;
    const service = new SocialMessageIngestionService(transportManager, repository, logger, metrics);

    const result = await service.ingestSource('telegram', SocialPlatform.TELEGRAM, source);

    expect(result).toEqual({ fetched: 0, persisted: 0, duplicatesSkipped: 0 });
  });

  it('emits observability counters for persisted and duplicate messages', async () => {
    const transportManager = fakeTransportManager([candidate({ externalMessageId: '1' }), candidate({ externalMessageId: '2' })]);
    const service = new SocialMessageIngestionService(transportManager, repository, logger, metrics);

    await service.ingestSource('telegram', SocialPlatform.TELEGRAM, source);

    expect(metrics.getCounter('social_message.ingestion.persisted')).toBe(2);
    expect(metrics.getCounter('social_message.ingestion.duplicate_skipped')).toBe(0);
    expect(metrics.getHistogram('social_message.ingestion.duration_ms')).toHaveLength(1);
  });
});
