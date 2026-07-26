import { prisma } from '../client.js';
import { AIUsageMapper, type AIUsageData, type CreateAIUsageInput } from '../mappers/ai-usage-mapper.js';

export interface AIUsageRepository {
  create(input: CreateAIUsageInput): Promise<AIUsageData>;
  findByUserId(userId: string, options?: { feature?: string; since?: Date; limit?: number }): Promise<AIUsageData[]>;
  getUsageSummary(userId: string, since: Date): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
    byModel: Record<string, { requests: number; tokens: number; cost: number }>;
    byFeature: Record<string, { requests: number; tokens: number; cost: number }>;
    cacheHits: number;
    cacheMisses: number;
    avgLatencyMs: number;
  }>;
  getDailyUsage(userId: string): Promise<AIUsageData[]>;
  getWeeklyUsage(userId: string): Promise<AIUsageData[]>;
  getMonthlyUsage(userId: string): Promise<AIUsageData[]>;
  getTotalTokensSince(userId: string, since: Date): Promise<number>;
  getTotalCostSince(userId: string, since: Date): Promise<number>;
  getRequestCountSince(userId: string, feature: string, since: Date): Promise<number>;
}

export class PrismaAIUsageRepository implements AIUsageRepository {
  async create(input: CreateAIUsageInput): Promise<AIUsageData> {
    const data = AIUsageMapper.toCreateInput(input);
    const record = await prisma.aIUsage.create({ data });
    return AIUsageMapper.toDomain(record);
  }

  async findByUserId(
    userId: string,
    options?: { feature?: string; since?: Date; limit?: number }
  ): Promise<AIUsageData[]> {
    const where: Record<string, unknown> = { userId };
    if (options?.feature) where.feature = options.feature;
    if (options?.since) where.createdAt = { gte: options.since };

    const records = await prisma.aIUsage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 100,
    });

    return records.map(AIUsageMapper.toDomain);
  }

  async getUsageSummary(userId: string, since: Date): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
    byModel: Record<string, { requests: number; tokens: number; cost: number }>;
    byFeature: Record<string, { requests: number; tokens: number; cost: number }>;
    cacheHits: number;
    cacheMisses: number;
    avgLatencyMs: number;
  }> {
    const records = await prisma.aIUsage.findMany({
      where: { userId, createdAt: { gte: since } },
    });

    const byProvider: Record<string, { requests: number; tokens: number; cost: number }> = {};
    const byModel: Record<string, { requests: number; tokens: number; cost: number }> = {};
    const byFeature: Record<string, { requests: number; tokens: number; cost: number }> = {};

    let totalTokens = 0;
    let totalCost = 0;
    let cacheHits = 0;
    let cacheMisses = 0;
    let totalLatency = 0;

    for (const record of records) {
      totalTokens += record.totalTokens;
      totalCost += record.estimatedCost;
      totalLatency += record.latencyMs;

      if (record.cacheHit) cacheHits++;
      if (record.cacheMiss) cacheMisses++;

      // Aggregate by provider
      const providerEntry = byProvider[record.provider] ?? (byProvider[record.provider] = { requests: 0, tokens: 0, cost: 0 });
      providerEntry.requests++;
      providerEntry.tokens += record.totalTokens;
      providerEntry.cost += record.estimatedCost;

      // Aggregate by model
      const modelEntry = byModel[record.model] ?? (byModel[record.model] = { requests: 0, tokens: 0, cost: 0 });
      modelEntry.requests++;
      modelEntry.tokens += record.totalTokens;
      modelEntry.cost += record.estimatedCost;

      // Aggregate by feature
      const featureEntry = byFeature[record.feature] ?? (byFeature[record.feature] = { requests: 0, tokens: 0, cost: 0 });
      featureEntry.requests++;
      featureEntry.tokens += record.totalTokens;
      featureEntry.cost += record.estimatedCost;
    }

    return {
      totalRequests: records.length,
      totalTokens,
      totalCost,
      byProvider,
      byModel,
      byFeature,
      cacheHits,
      cacheMisses,
      avgLatencyMs: records.length > 0 ? Math.round(totalLatency / records.length) : 0,
    };
  }

  async getDailyUsage(userId: string): Promise<AIUsageData[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const records = await prisma.aIUsage.findMany({
      where: { userId, createdAt: { gte: today } },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(AIUsageMapper.toDomain);
  }

  async getWeeklyUsage(userId: string): Promise<AIUsageData[]> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const records = await prisma.aIUsage.findMany({
      where: { userId, createdAt: { gte: weekAgo } },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(AIUsageMapper.toDomain);
  }

  async getMonthlyUsage(userId: string): Promise<AIUsageData[]> {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const records = await prisma.aIUsage.findMany({
      where: { userId, createdAt: { gte: monthAgo } },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(AIUsageMapper.toDomain);
  }

  async getTotalTokensSince(userId: string, since: Date): Promise<number> {
    const result = await prisma.aIUsage.aggregate({
      where: { userId, createdAt: { gte: since } },
      _sum: { totalTokens: true },
    });
    return result._sum.totalTokens ?? 0;
  }

  async getTotalCostSince(userId: string, since: Date): Promise<number> {
    const result = await prisma.aIUsage.aggregate({
      where: { userId, createdAt: { gte: since } },
      _sum: { estimatedCost: true },
    });
    return result._sum.estimatedCost ?? 0;
  }

  async getRequestCountSince(userId: string, feature: string, since: Date): Promise<number> {
    return prisma.aIUsage.count({
      where: { userId, feature, createdAt: { gte: since } },
    });
  }
}
