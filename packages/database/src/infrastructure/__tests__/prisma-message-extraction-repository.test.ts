import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrismaClient, type MockPrismaClient } from '@careeros/test-utils';
import { createMessageExtraction, MessageExtractionStatus, extractedVacancyFieldsSchema } from '@careeros/ai';

const mockPrisma = createMockPrismaClient();

vi.mock('../../client.js', () => ({
  get prisma(): MockPrismaClient {
    return mockPrisma;
  },
}));

const { PrismaMessageExtractionRepository } = await import('../prisma-message-extraction-repository.js');
const { MessageExtractionMapper } = await import('../../mappers/message-extraction-mapper.js');

describe('PrismaMessageExtractionRepository', () => {
  let prisma: MockPrismaClient;
  let repository: InstanceType<typeof PrismaMessageExtractionRepository>;

  beforeEach(() => {
    prisma = mockPrisma;
    vi.clearAllMocks();
    repository = new PrismaMessageExtractionRepository();
  });

  function makeExtraction(overrides?: { id?: string }) {
    return createMessageExtraction({
      id: overrides?.id ?? 'me-1',
      messageId: 'msg-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      promptId: 'message-extraction',
      promptVersion: '1.0.0',
      promptChecksum: 'abc123',
      extractedFields: extractedVacancyFieldsSchema.parse({
        company: 'Acme Corp',
        title: 'Senior Backend Engineer',
      }),
      deterministicConfidence: 82,
      status: MessageExtractionStatus.SUCCESS,
      tokenUsage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      estimatedCostUsd: 0.0015,
      latencyMs: 850,
      contentHash: 'hash-1',
      fromCache: false,
    });
  }

  describe('save', () => {
    it('always inserts via create — never upserts or updates an existing row', async () => {
      const extraction = makeExtraction();
      const persisted = MessageExtractionMapper.toPersistence(extraction);
      (prisma.messageExtraction.create as ReturnType<typeof vi.fn>).mockResolvedValue(persisted);

      const result = await repository.save(extraction);

      expect(prisma.messageExtraction.create).toHaveBeenCalledWith({ data: persisted });
      expect(prisma.messageExtraction.update).not.toHaveBeenCalled();
      expect(result.id).toBe(extraction.id);
    });

    it('appends a second row for the same messageId instead of overwriting the first', async () => {
      const first = makeExtraction({ id: 'me-1' });
      const second = makeExtraction({ id: 'me-2' });
      (prisma.messageExtraction.create as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(MessageExtractionMapper.toPersistence(first))
        .mockResolvedValueOnce(MessageExtractionMapper.toPersistence(second));

      await repository.save(first);
      await repository.save(second);

      expect(prisma.messageExtraction.create).toHaveBeenCalledTimes(2);
      expect(prisma.messageExtraction.update).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns null when no record exists', async () => {
      (prisma.messageExtraction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await repository.findById('missing');

      expect(result).toBeNull();
      expect(prisma.messageExtraction.findUnique).toHaveBeenCalledWith({ where: { id: 'missing' } });
    });

    it('maps a Prisma record to a domain entity', async () => {
      const extraction = makeExtraction();
      (prisma.messageExtraction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        MessageExtractionMapper.toPersistence(extraction),
      );

      const result = await repository.findById('me-1');

      expect(result?.id).toBe('me-1');
      expect(result?.extractedFields.company).toBe('Acme Corp');
      expect(result?.status).toBe(MessageExtractionStatus.SUCCESS);
    });
  });

  describe('findByMessageId', () => {
    it('returns the full extraction history for a message, newest first', async () => {
      const first = makeExtraction({ id: 'me-1' });
      const second = makeExtraction({ id: 'me-2' });
      (prisma.messageExtraction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        MessageExtractionMapper.toPersistence(second),
        MessageExtractionMapper.toPersistence(first),
      ]);

      const result = await repository.findByMessageId('msg-1');

      expect(prisma.messageExtraction.findMany).toHaveBeenCalledWith({
        where: { messageId: 'msg-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('me-2');
      expect(result[1]?.id).toBe('me-1');
    });
  });

  describe('findLatestByMessageId', () => {
    it('returns null when the message has never been extracted', async () => {
      (prisma.messageExtraction.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await repository.findLatestByMessageId('msg-unknown');

      expect(result).toBeNull();
    });

    it('returns the newest extraction row for a message', async () => {
      const extraction = makeExtraction();
      (prisma.messageExtraction.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        MessageExtractionMapper.toPersistence(extraction),
      );

      const result = await repository.findLatestByMessageId('msg-1');

      expect(prisma.messageExtraction.findFirst).toHaveBeenCalledWith({
        where: { messageId: 'msg-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result?.id).toBe('me-1');
    });
  });

  describe('findByContentHashAndPrompt', () => {
    it('returns null when no matching row exists — the engine treats this as a cache/idempotency miss', async () => {
      (prisma.messageExtraction.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await repository.findByContentHashAndPrompt('hash-1', 'openai', 'gpt-4o-mini', 'abc123');

      expect(result).toBeNull();
    });

    it('looks up by the full (contentHash, provider, model, promptChecksum) reproducibility tuple', async () => {
      const extraction = makeExtraction();
      (prisma.messageExtraction.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        MessageExtractionMapper.toPersistence(extraction),
      );

      const result = await repository.findByContentHashAndPrompt('hash-1', 'openai', 'gpt-4o-mini', 'abc123');

      expect(prisma.messageExtraction.findFirst).toHaveBeenCalledWith({
        where: { contentHash: 'hash-1', provider: 'openai', model: 'gpt-4o-mini', promptChecksum: 'abc123' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result?.id).toBe('me-1');
    });
  });
});
