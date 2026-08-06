import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoopLogger, InMemoryMetricsCollector } from '@careeros/providers';
import {
  SocialMessage,
  SocialPlatform,
  TransportType,
  MessageProcessingStatus,
  createSocialMessageId,
} from '@careeros/career';
import type { SocialMessageRepository, UpsertRawSocialMessageInput } from '@careeros/career';
import { createMessageExtraction, MessageExtractionStatus, type MessageExtractionEngine, type MessageExtractionOutcome } from '@careeros/ai';
import { SocialMessagePipeline } from '../social-message-pipeline.js';

class FakeSocialMessageRepository implements SocialMessageRepository {
  private readonly rows = new Map<string, SocialMessage>();
  readonly statusUpdates: Array<{ id: string; status: MessageProcessingStatus; error?: string | null }> = [];

  seed(input: UpsertRawSocialMessageInput & { id?: string }): SocialMessage {
    const id = createSocialMessageId(input.id ?? `${input.sourceId}:${input.externalMessageId}`);
    const message = SocialMessage.create({
      id,
      platform: input.platform,
      sourceId: input.sourceId,
      externalMessageId: input.externalMessageId,
      publishedAt: input.publishedAt,
      rawText: input.rawText,
      contentHash: input.contentHash,
      transport: input.transport,
    });
    this.rows.set(id, message);
    return message;
  }

  async upsertRaw(): Promise<SocialMessage> {
    throw new Error('not used in this test');
  }

  async findById(id: ReturnType<typeof createSocialMessageId>): Promise<SocialMessage | null> {
    return this.rows.get(id) ?? null;
  }

  async findBySourceAndExternalId(): Promise<SocialMessage | null> {
    throw new Error('not used in this test');
  }

  async findPendingBySource(): Promise<SocialMessage[]> {
    return [...this.rows.values()].filter((m) => m.processingStatus === MessageProcessingStatus.PENDING);
  }

  async findPending(): Promise<SocialMessage[]> {
    return [...this.rows.values()].filter((m) => m.processingStatus === MessageProcessingStatus.PENDING);
  }

  async findBySourceSince(): Promise<SocialMessage[]> {
    return [];
  }

  async findLatestBySource(): Promise<SocialMessage | null> {
    return null;
  }

  async updateStatus(id: ReturnType<typeof createSocialMessageId>, status: MessageProcessingStatus, error?: string | null): Promise<void> {
    this.statusUpdates.push({ id, status, error });
    const existing = this.rows.get(id);
    if (existing) existing.markStatus(status);
  }

  async countBySource(): Promise<number> {
    return this.rows.size;
  }

  async countBySourceAndStatus(): Promise<number> {
    return 0;
  }
}

function pendingMessage(repo: FakeSocialMessageRepository, overrides: Partial<UpsertRawSocialMessageInput & { id: string }> = {}): SocialMessage {
  return repo.seed({
    id: overrides.id ?? 'msg-1',
    platform: SocialPlatform.TELEGRAM,
    sourceId: overrides.sourceId ?? 'frontend_jobs',
    externalMessageId: overrides.externalMessageId ?? '1',
    publishedAt: overrides.publishedAt ?? new Date('2026-01-01'),
    rawText: overrides.rawText ?? 'We are hiring a Senior TypeScript Developer, remote friendly',
    contentHash: overrides.contentHash ?? 'hash-1',
    transport: overrides.transport ?? TransportType.HTML_PREVIEW,
  });
}

function fakeExtractionEngine(status: MessageExtractionStatus): MessageExtractionEngine {
  const extraction = createMessageExtraction({
    messageId: 'msg-1',
    provider: 'fake',
    model: 'fake-model',
    promptId: 'message-extraction',
    promptVersion: '1',
    promptChecksum: 'checksum',
    extractedFields: { company: null, title: null, technologies: [], skills: [], seniority: null, salaryMin: null, salaryMax: null, currency: null, country: null, city: null, employmentType: null, remoteType: null, contact: null, recruiter: null, links: [], atsKeywords: [], responsibilities: [], requirements: [], category: null, evidence: {} },
    deterministicConfidence: status === MessageExtractionStatus.SUCCESS ? 80 : 0,
    status,
    tokenUsage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    estimatedCostUsd: 0.001,
    latencyMs: 100,
    contentHash: 'hash-1',
    fromCache: false,
  });
  const outcome: MessageExtractionOutcome = { extraction, reused: false };
  return { extract: vi.fn().mockResolvedValue(outcome) } as unknown as MessageExtractionEngine;
}

describe('SocialMessagePipeline', () => {
  let repository: FakeSocialMessageRepository;
  let logger: NoopLogger;
  let metrics: InMemoryMetricsCollector;

  beforeEach(() => {
    repository = new FakeSocialMessageRepository();
    logger = new NoopLogger();
    metrics = new InMemoryMetricsCollector();
  });

  it('skips a message that fails the precheck without ever calling the extraction engine', async () => {
    pendingMessage(repository, { rawText: 'Happy Friday to everyone in the chat, enjoy your weekend plans!' });
    const engine = fakeExtractionEngine(MessageExtractionStatus.SUCCESS);
    const pipeline = new SocialMessagePipeline(repository, engine, logger, metrics);

    const result = await pipeline.processPendingBySource(SocialPlatform.TELEGRAM, 'frontend_jobs');

    expect(result).toEqual({ processed: 1, skippedPrecheck: 1, extracted: 0, lowConfidence: 0, spam: 0, failed: 0 });
    expect(engine.extract).not.toHaveBeenCalled();
    expect(repository.statusUpdates).toHaveLength(1);
    expect(repository.statusUpdates[0]?.id).toBe('msg-1');
    expect(repository.statusUpdates[0]?.status).toBe(MessageProcessingStatus.SKIPPED_PRECHECK);
    expect(repository.statusUpdates[0]?.error).toContain('not_it_relevant');
  });

  it('skips a course/webinar ad even though it mentions a tech keyword, and records the matched category+rule', async () => {
    pendingMessage(repository, { rawText: 'Онлайн-курс по React и TypeScript, старт потока уже в понедельник, запись на курс открыта' });
    const engine = fakeExtractionEngine(MessageExtractionStatus.SUCCESS);
    const pipeline = new SocialMessagePipeline(repository, engine, logger, metrics);

    const result = await pipeline.processPendingBySource(SocialPlatform.TELEGRAM, 'frontend_jobs');

    expect(result).toEqual({ processed: 1, skippedPrecheck: 1, extracted: 0, lowConfidence: 0, spam: 0, failed: 0 });
    expect(engine.extract).not.toHaveBeenCalled();
    expect(repository.statusUpdates[0]?.error).toContain('course_bootcamp');
  });

  it('does not skip a real vacancy that asks candidates to send a resume', async () => {
    pendingMessage(repository, { rawText: 'Ищем Frontend разработчика, React/TypeScript. Пришлите резюме на hr@company.com' });
    const engine = fakeExtractionEngine(MessageExtractionStatus.SUCCESS);
    const pipeline = new SocialMessagePipeline(repository, engine, logger, metrics);

    const result = await pipeline.processPendingBySource(SocialPlatform.TELEGRAM, 'frontend_jobs');

    expect(result.skippedPrecheck).toBe(0);
    expect(engine.extract).toHaveBeenCalledTimes(1);
  });

  it('runs extraction for a message that passes the precheck and marks it EXTRACTED on success', async () => {
    pendingMessage(repository);
    const engine = fakeExtractionEngine(MessageExtractionStatus.SUCCESS);
    const pipeline = new SocialMessagePipeline(repository, engine, logger, metrics);

    const result = await pipeline.processPendingBySource(SocialPlatform.TELEGRAM, 'frontend_jobs');

    expect(result).toEqual({ processed: 1, skippedPrecheck: 0, extracted: 1, lowConfidence: 0, spam: 0, failed: 0 });
    expect(engine.extract).toHaveBeenCalledTimes(1);
    expect(repository.statusUpdates.map((u) => u.status)).toEqual([
      MessageProcessingStatus.EXTRACTING,
      MessageProcessingStatus.EXTRACTED,
    ]);
  });

  it('maps LOW_CONFIDENCE and SPAM extraction outcomes onto the matching SocialMessage status', async () => {
    pendingMessage(repository, { id: 'msg-low' });
    const lowConfidenceEngine = fakeExtractionEngine(MessageExtractionStatus.LOW_CONFIDENCE);
    const pipeline = new SocialMessagePipeline(repository, lowConfidenceEngine, logger, metrics);

    const result = await pipeline.processPendingBySource(SocialPlatform.TELEGRAM, 'frontend_jobs');
    expect(result.lowConfidence).toBe(1);
  });

  it('marks a thrown extraction error as FAILED rather than propagating', async () => {
    pendingMessage(repository);
    const engine = { extract: vi.fn().mockRejectedValue(new Error('provider down')) } as unknown as MessageExtractionEngine;
    const pipeline = new SocialMessagePipeline(repository, engine, logger, metrics);

    const result = await pipeline.processPendingBySource(SocialPlatform.TELEGRAM, 'frontend_jobs');

    expect(result.failed).toBe(1);
    expect(repository.statusUpdates.at(-1)).toEqual({ id: 'msg-1', status: MessageProcessingStatus.FAILED, error: 'provider down' });
  });

  it('is a no-op when there are no pending messages', async () => {
    const engine = fakeExtractionEngine(MessageExtractionStatus.SUCCESS);
    const pipeline = new SocialMessagePipeline(repository, engine, logger, metrics);

    const result = await pipeline.processPending();

    expect(result).toEqual({ processed: 0, skippedPrecheck: 0, extracted: 0, lowConfidence: 0, spam: 0, failed: 0 });
    expect(engine.extract).not.toHaveBeenCalled();
  });
});
