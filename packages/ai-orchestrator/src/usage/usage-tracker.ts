import type { AIUsageRepository } from '@careeros/database';
import type { AIFeature, UsageStats } from '../orchestrator-config.js';

export interface TrackUsageInput {
  readonly userId: string;
  readonly jobId?: string;
  readonly provider: string;
  readonly model: string;
  readonly feature: AIFeature;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly totalTokens: number;
  readonly estimatedCost: number;
  readonly latencyMs: number;
  readonly cacheHit: boolean;
  readonly cacheMiss: boolean;
}

export class UsageTracker {
  private readonly repository: AIUsageRepository;

  constructor(repository: AIUsageRepository) {
    this.repository = repository;
  }

  async track(input: TrackUsageInput): Promise<void> {
    await this.repository.create(input);
  }

  async getTodayUsage(userId: string): Promise<UsageStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const summary = await this.repository.getUsageSummary(userId, today);
    return this.mapToUsageStats(summary);
  }

  async getWeekUsage(userId: string): Promise<UsageStats> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const summary = await this.repository.getUsageSummary(userId, weekAgo);
    return this.mapToUsageStats(summary);
  }

  async getMonthUsage(userId: string): Promise<UsageStats> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const summary = await this.repository.getUsageSummary(userId, monthStart);
    return this.mapToUsageStats(summary);
  }

  async getTotalTokensToday(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.repository.getTotalTokensSince(userId, today);
  }

  async getTotalTokensThisMonth(userId: string): Promise<number> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.repository.getTotalTokensSince(userId, monthStart);
  }

  async getTotalCostThisMonth(userId: string): Promise<number> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.repository.getTotalCostSince(userId, monthStart);
  }

  async getTotalTokensSince(userId: string, since: Date): Promise<number> {
    return this.repository.getTotalTokensSince(userId, since);
  }

  async getTotalCostSince(userId: string, since: Date): Promise<number> {
    return this.repository.getTotalCostSince(userId, since);
  }

  async getRequestCountForFeature(
    userId: string,
    feature: AIFeature,
    since: Date
  ): Promise<number> {
    return this.repository.getRequestCountSince(userId, feature, since);
  }

  private mapToUsageStats(summary: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    cacheHits: number;
    cacheMisses: number;
    avgLatencyMs: number;
    byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
    byModel: Record<string, { requests: number; tokens: number; cost: number }>;
    byFeature: Record<string, { requests: number; tokens: number; cost: number }>;
  }): UsageStats {
    const totalCacheRequests = summary.cacheHits + summary.cacheMisses;
    return {
      totalRequests: summary.totalRequests,
      totalTokens: summary.totalTokens,
      totalCost: summary.totalCost,
      cacheHits: summary.cacheHits,
      cacheMisses: summary.cacheMisses,
      cacheHitRate: totalCacheRequests > 0 ? summary.cacheHits / totalCacheRequests : 0,
      avgLatencyMs: summary.avgLatencyMs,
      byProvider: summary.byProvider,
      byModel: summary.byModel,
      byFeature: summary.byFeature,
    };
  }
}
