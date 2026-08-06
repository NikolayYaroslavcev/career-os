import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { createMockPrismaClient, type MockPrismaClient } from '@careeros/test-utils';

const mockPrisma = createMockPrismaClient();

vi.mock('../../client.js', () => ({
  get prisma(): MockPrismaClient {
    return mockPrisma;
  },
}));

const { PrismaAIJobRepository, DuplicateAIJobError } = await import('../prisma-ai-job-repository.js');

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`userId`,`feature`,`inputHash`)', {
    code: 'P2002',
    clientVersion: '6.19.3',
  });
}

describe('PrismaAIJobRepository', () => {
  let prisma: MockPrismaClient;
  let repository: InstanceType<typeof PrismaAIJobRepository>;

  const createInput = {
    userId: 'user-1',
    feature: 'analyze_vacancy',
    inputHash: 'hash-1',
  };

  beforeEach(() => {
    prisma = mockPrisma;
    vi.clearAllMocks();
    repository = new PrismaAIJobRepository();
  });

  describe('create', () => {
    it('creates a new AIJob row on a normal (non-racing) request', async () => {
      (prisma.aIJob.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'job-1',
        userId: 'user-1',
        feature: 'analyze_vacancy',
        status: 'PENDING',
        priority: 0,
        inputHash: 'hash-1',
        cacheKey: null,
        provider: null,
        model: null,
        input: null,
        result: null,
        error: null,
        tokensIn: 0,
        tokensOut: 0,
        totalTokens: 0,
        estimatedCost: 0,
        latencyMs: null,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        vacancyId: null,
        applicationId: null,
      });

      const job = await repository.create(createInput);

      expect(job.id).toBe('job-1');
      expect(prisma.aIJob.findFirst).not.toHaveBeenCalled();
    });

    it('throws DuplicateAIJobError with the winning job id when the partial unique index rejects a concurrent insert', async () => {
      (prisma.aIJob.create as ReturnType<typeof vi.fn>).mockRejectedValue(uniqueConstraintError());
      (prisma.aIJob.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'winner-job',
        userId: 'user-1',
        feature: 'analyze_vacancy',
        status: 'PROCESSING',
        priority: 0,
        inputHash: 'hash-1',
        cacheKey: null,
        provider: null,
        model: null,
        input: null,
        result: null,
        error: null,
        tokensIn: 0,
        tokensOut: 0,
        totalTokens: 0,
        estimatedCost: 0,
        latencyMs: null,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        vacancyId: null,
        applicationId: null,
      });

      const error = await repository.create(createInput).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(DuplicateAIJobError);
      expect((error as InstanceType<typeof DuplicateAIJobError>).existingJobId).toBe('winner-job');
      expect(prisma.aIJob.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', feature: 'analyze_vacancy', inputHash: 'hash-1', status: { in: ['PENDING', 'QUEUED', 'PROCESSING'] } },
        })
      );
    });

    it('rethrows the original error when a unique-constraint violation fires but no active job is found (defensive: something changed between the violation and the lookup)', async () => {
      (prisma.aIJob.create as ReturnType<typeof vi.fn>).mockRejectedValue(uniqueConstraintError());
      (prisma.aIJob.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(repository.create(createInput)).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    });

    it('propagates non-unique-constraint errors unchanged', async () => {
      const dbError = new Error('connection lost');
      (prisma.aIJob.create as ReturnType<typeof vi.fn>).mockRejectedValue(dbError);

      await expect(repository.create(createInput)).rejects.toThrow('connection lost');
      expect(prisma.aIJob.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('findActiveByKey', () => {
    it('scopes the lookup to PENDING/QUEUED/PROCESSING jobs for the given user, feature, and inputHash', async () => {
      (prisma.aIJob.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await repository.findActiveByKey('user-1', 'analyze_vacancy', 'hash-1');

      expect(result).toBeNull();
      expect(prisma.aIJob.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', feature: 'analyze_vacancy', inputHash: 'hash-1', status: { in: ['PENDING', 'QUEUED', 'PROCESSING'] } },
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });
});
