import { Prisma } from '@prisma/client';
import { prisma } from '../client.js';
import { AIJobMapper, type AIJobData, type CreateAIJobInput, type UpdateAIJobInput } from '../mappers/ai-job-mapper.js';

// Statuses covered by the AIJob_active_dedup_key partial unique index
// (migration 20260805140000_add_aijob_active_dedup_index). Keep in sync with
// the migration's WHERE clause.
const ACTIVE_JOB_STATUSES = ['PENDING', 'QUEUED', 'PROCESSING'] as const;

// Thrown by create() when the partial unique index rejects a second active
// job for the same (userId, feature, inputHash). Carries the id of the
// job that won the race so the caller can return it instead of retrying.
export class DuplicateAIJobError extends Error {
  constructor(public readonly existingJobId: string) {
    super(`An active AI job already exists for this request (jobId: ${existingJobId})`);
    this.name = 'DuplicateAIJobError';
  }
}

export interface AIJobRepository {
  create(input: CreateAIJobInput): Promise<AIJobData>;
  findById(id: string): Promise<AIJobData | null>;
  findActiveByKey(userId: string, feature: string, inputHash: string): Promise<AIJobData | null>;
  findByUserId(userId: string, options?: { feature?: string; status?: string; vacancyId?: string; applicationId?: string; limit?: number; offset?: number }): Promise<AIJobData[]>;
  update(id: string, input: UpdateAIJobInput): Promise<void>;
  countByUserAndFeature(userId: string, feature: string, since?: Date): Promise<number>;
  countByUser(userId: string, since?: Date): Promise<number>;
}

export class PrismaAIJobRepository implements AIJobRepository {
  async create(input: CreateAIJobInput): Promise<AIJobData> {
    const data = AIJobMapper.toCreateInput(input);
    try {
      const record = await prisma.aIJob.create({
        data: {
          ...data,
          status: 'PENDING',
        },
      });
      return AIJobMapper.toDomain(record);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.findActiveByKey(input.userId, input.feature, input.inputHash);
        if (existing) {
          throw new DuplicateAIJobError(existing.id);
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<AIJobData | null> {
    const record = await prisma.aIJob.findUnique({ where: { id } });
    if (!record) return null;
    return AIJobMapper.toDomain(record);
  }

  async findActiveByKey(userId: string, feature: string, inputHash: string): Promise<AIJobData | null> {
    const record = await prisma.aIJob.findFirst({
      where: { userId, feature, inputHash, status: { in: [...ACTIVE_JOB_STATUSES] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return null;
    return AIJobMapper.toDomain(record);
  }

  async findByUserId(
    userId: string,
    options?: { feature?: string; status?: string; vacancyId?: string; applicationId?: string; limit?: number; offset?: number }
  ): Promise<AIJobData[]> {
    const where: Record<string, unknown> = { userId };
    if (options?.feature) where.feature = options.feature;
    if (options?.status) where.status = options.status;
    if (options?.vacancyId) where.vacancyId = options.vacancyId;
    if (options?.applicationId) where.applicationId = options.applicationId;

    const records = await prisma.aIJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });

    return records.map(AIJobMapper.toDomain);
  }

  async update(id: string, input: UpdateAIJobInput): Promise<void> {
    const data = AIJobMapper.toUpdateInput(input);
    await prisma.aIJob.update({ where: { id }, data });
  }

  async countByUserAndFeature(userId: string, feature: string, since?: Date): Promise<number> {
    const where: Record<string, unknown> = { userId, feature };
    if (since) where.createdAt = { gte: since };
    return prisma.aIJob.count({ where });
  }

  async countByUser(userId: string, since?: Date): Promise<number> {
    const where: Record<string, unknown> = { userId };
    if (since) where.createdAt = { gte: since };
    return prisma.aIJob.count({ where });
  }
}
