import { describe, it, expect, beforeEach } from 'vitest';
import { estimateCost } from '../cost/cost-tracker.js';
import { InMemoryCostTracker } from '../cost/cost-tracker-impl.js';
import type { ModelPricing } from '../cost/cost-tracker.js';

describe('estimateCost', () => {
  const pricing: ModelPricing = {
    model: 'gpt-4o',
    provider: 'openai',
    inputCostPer1kTokens: 0.0025,
    outputCostPer1kTokens: 0.01,
  };

  it('calculates cost correctly', () => {
    const cost = estimateCost(
      { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
      pricing,
    );
    // 1000/1000 * 0.0025 + 500/1000 * 0.01 = 0.0025 + 0.005 = 0.0075
    expect(cost).toBe(0.0075);
  });

  it('handles zero tokens', () => {
    const cost = estimateCost(
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      pricing,
    );
    expect(cost).toBe(0);
  });
});

describe('InMemoryCostTracker', () => {
  let tracker: InMemoryCostTracker;

  beforeEach(() => {
    tracker = new InMemoryCostTracker();
  });

  it('records cost entries', () => {
    tracker.record({
      requestId: 'req-1',
      provider: 'openai',
      model: 'gpt-4o',
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      estimatedCostUsd: 0.005,
      latencyMs: 150,
      promptId: 'test',
      promptVersion: '1.0',
    });

    const records = tracker.getRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.provider).toBe('openai');
  });

  it('generates summary', () => {
    tracker.record({
      requestId: 'req-1',
      provider: 'openai',
      model: 'gpt-4o',
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      estimatedCostUsd: 0.005,
      latencyMs: 100,
      promptId: 'test',
      promptVersion: '1.0',
    });

    tracker.record({
      requestId: 'req-2',
      provider: 'anthropic',
      model: 'claude-3',
      usage: { promptTokens: 150, completionTokens: 250, totalTokens: 400 },
      estimatedCostUsd: 0.008,
      latencyMs: 200,
      promptId: 'test',
      promptVersion: '1.0',
    });

    const summary = tracker.getSummary();
    expect(summary.totalRequests).toBe(2);
    expect(summary.totalTokens).toBe(700);
    expect(summary.totalCostUsd).toBe(0.013);
    expect(summary.avgLatencyMs).toBe(150);
    expect(summary.byProvider['openai']?.requests).toBe(1);
    expect(summary.byProvider['anthropic']?.requests).toBe(1);
  });

  it('filters by provider', () => {
    tracker.record({
      requestId: 'req-1', provider: 'openai', model: 'gpt-4o',
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      estimatedCostUsd: 0.005, latencyMs: 100, promptId: 'test', promptVersion: '1.0',
    });
    tracker.record({
      requestId: 'req-2', provider: 'anthropic', model: 'claude-3',
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      estimatedCostUsd: 0.005, latencyMs: 100, promptId: 'test', promptVersion: '1.0',
    });

    expect(tracker.getRecordsByProvider('openai')).toHaveLength(1);
    expect(tracker.getRecordsByProvider('anthropic')).toHaveLength(1);
  });

  it('resets tracker', () => {
    tracker.record({
      requestId: 'req-1', provider: 'openai', model: 'gpt-4o',
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      estimatedCostUsd: 0.005, latencyMs: 100, promptId: 'test', promptVersion: '1.0',
    });

    tracker.reset();
    expect(tracker.getRecords()).toHaveLength(0);
  });
});
