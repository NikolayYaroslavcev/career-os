import { prisma } from '../client.js';
import { AICacheMapper, type AICacheData, type CreateAICacheInput } from '../mappers/ai-cache-mapper.js';

export interface AICacheRepository {
  create(input: CreateAICacheInput): Promise<AICacheData>;
  findByKey(cacheKey: string): Promise<AICacheData | null>;
  incrementHitCount(id: string): Promise<void>;
  deleteByKey(cacheKey: string): Promise<void>;
  deleteExpired(): Promise<number>;
  deleteByFeature(feature: string): Promise<number>;
  deleteAll(): Promise<number>;
  getStats(): Promise<{ totalEntries: number; totalHits: number; totalSavedTokens: number }>;
}

export class PrismaAICacheRepository implements AICacheRepository {
  async create(input: CreateAICacheInput): Promise<AICacheData> {
    const data = AICacheMapper.toCreateInput(input);
    const record = await prisma.aICache.upsert({
      where: { cacheKey: input.cacheKey },
      create: data,
      update: {
        response: data.response,
        tokensIn: data.tokensIn,
        tokensOut: data.tokensOut,
        estimatedCost: data.estimatedCost,
        lastAccessedAt: new Date(),
        expiresAt: data.expiresAt,
      },
    });
    return AICacheMapper.toDomain(record);
  }

  async findByKey(cacheKey: string): Promise<AICacheData | null> {
    const record = await prisma.aICache.findUnique({ where: { cacheKey } });
    if (!record) return null;

    // Check expiration
    if (record.expiresAt < new Date()) {
      await prisma.aICache.delete({ where: { cacheKey } });
      return null;
    }

    return AICacheMapper.toDomain(record);
  }

  async incrementHitCount(id: string): Promise<void> {
    await prisma.aICache.update({
      where: { id },
      data: { hitCount: { increment: 1 }, lastAccessedAt: new Date() },
    });
  }

  async deleteByKey(cacheKey: string): Promise<void> {
    await prisma.aICache.deleteMany({ where: { cacheKey } });
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.aICache.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  async deleteByFeature(feature: string): Promise<number> {
    const result = await prisma.aICache.deleteMany({ where: { feature } });
    return result.count;
  }

  async deleteAll(): Promise<number> {
    const result = await prisma.aICache.deleteMany();
    return result.count;
  }

  async getStats(): Promise<{ totalEntries: number; totalHits: number; totalSavedTokens: number }> {
    const [totalEntries, aggregate] = await Promise.all([
      prisma.aICache.count(),
      prisma.aICache.aggregate({
        _sum: { hitCount: true, tokensIn: true, tokensOut: true },
      }),
    ]);

    return {
      totalEntries,
      totalHits: aggregate._sum.hitCount ?? 0,
      totalSavedTokens: (aggregate._sum.tokensIn ?? 0) + (aggregate._sum.tokensOut ?? 0),
    };
  }
}
