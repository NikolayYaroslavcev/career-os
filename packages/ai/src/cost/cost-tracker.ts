import type { TokenUsage } from '../domain/ai-types.js';

export interface CostRecord {
  readonly requestId: string;
  readonly provider: string;
  readonly model: string;
  readonly usage: TokenUsage;
  readonly estimatedCostUsd: number;
  readonly latencyMs: number;
  readonly promptId: string;
  readonly promptVersion: string;
  readonly timestamp: Date;
}

export interface CostSummary {
  readonly totalRequests: number;
  readonly totalTokens: number;
  readonly totalCostUsd: number;
  readonly avgLatencyMs: number;
  readonly byProvider: Readonly<Record<string, ProviderCostSummary>>;
  readonly byModel: Readonly<Record<string, ModelCostSummary>>;
}

export interface ProviderCostSummary {
  readonly requests: number;
  readonly tokens: number;
  readonly costUsd: number;
}

export interface ModelCostSummary {
  readonly requests: number;
  readonly tokens: number;
  readonly costUsd: number;
}

export interface ModelPricing {
  readonly model: string;
  readonly provider: string;
  readonly inputCostPer1kTokens: number;
  readonly outputCostPer1kTokens: number;
}

export interface CostTracker {
  record(entry: Omit<CostRecord, 'timestamp'>): void;
  getSummary(): CostSummary;
  getRecords(): readonly CostRecord[];
  getRecordsByProvider(provider: string): readonly CostRecord[];
  getRecordsByModel(model: string): readonly CostRecord[];
  reset(): void;
}

export function estimateCost(usage: TokenUsage, pricing: ModelPricing): number {
  const inputCost = (usage.promptTokens / 1000) * pricing.inputCostPer1kTokens;
  const outputCost = (usage.completionTokens / 1000) * pricing.outputCostPer1kTokens;
  return Math.round((inputCost + outputCost) * 10000) / 10000;
}
