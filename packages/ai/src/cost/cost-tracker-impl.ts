import type {
  CostTracker,
  CostRecord,
  CostSummary,
  ProviderCostSummary,
  ModelCostSummary,
} from './cost-tracker.js';

export class InMemoryCostTracker implements CostTracker {
  private records: CostRecord[] = [];

  record(entry: Omit<CostRecord, 'timestamp'>): void {
    this.records.push({
      ...entry,
      timestamp: new Date(),
    });
  }

  getSummary(): CostSummary {
    const byProvider = new Map<string, ProviderCostSummary>();
    const byModel = new Map<string, ModelCostSummary>();
    let totalTokens = 0;
    let totalCostUsd = 0;
    let totalLatencyMs = 0;

    for (const record of this.records) {
      totalTokens += record.usage.totalTokens;
      totalCostUsd += record.estimatedCostUsd;
      totalLatencyMs += record.latencyMs;

      const providerSummary = byProvider.get(record.provider) ?? {
        requests: 0,
        tokens: 0,
        costUsd: 0,
      };
      byProvider.set(record.provider, {
        requests: providerSummary.requests + 1,
        tokens: providerSummary.tokens + record.usage.totalTokens,
        costUsd: providerSummary.costUsd + record.estimatedCostUsd,
      });

      const modelSummary = byModel.get(record.model) ?? {
        requests: 0,
        tokens: 0,
        costUsd: 0,
      };
      byModel.set(record.model, {
        requests: modelSummary.requests + 1,
        tokens: modelSummary.tokens + record.usage.totalTokens,
        costUsd: modelSummary.costUsd + record.estimatedCostUsd,
      });
    }

    return {
      totalRequests: this.records.length,
      totalTokens,
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      avgLatencyMs: this.records.length > 0
        ? Math.round(totalLatencyMs / this.records.length)
        : 0,
      byProvider: Object.fromEntries(byProvider),
      byModel: Object.fromEntries(byModel),
    };
  }

  getRecords(): readonly CostRecord[] {
    return [...this.records];
  }

  getRecordsByProvider(provider: string): readonly CostRecord[] {
    return this.records.filter((r) => r.provider === provider);
  }

  getRecordsByModel(model: string): readonly CostRecord[] {
    return this.records.filter((r) => r.model === model);
  }

  reset(): void {
    this.records = [];
  }
}
