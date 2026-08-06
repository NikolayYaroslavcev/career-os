import { describe, it, expect, vi } from 'vitest';
import { computeChannelQualityScore, TelegramChannelStatsService } from '../telegram-channel-stats-service.js';
import type { UpsertTelegramChannelStatsInput } from '@careeros/database';

function baseStats(overrides: Partial<UpsertTelegramChannelStatsInput> = {}): UpsertTelegramChannelStatsInput {
  return {
    totalMessages: 0,
    vacanciesExtracted: 0,
    extractionRate: 0,
    avgConfidence: 0,
    spamRate: 0,
    duplicateRate: 0,
    avgSalaryMin: null,
    avgSalaryMax: null,
    avgSeniorityRank: null,
    avgTechnologiesCount: 0,
    brokenMessages: 0,
    processingErrors: 0,
    successRate: 0,
    topTechnologies: [],
    ...overrides,
  };
}

describe('computeChannelQualityScore', () => {
  it('scores a zero-message channel as 0 (retirement candidate)', () => {
    expect(computeChannelQualityScore(baseStats())).toBe(0);
  });

  it('scores a healthy, active, low-spam channel highly', () => {
    const score = computeChannelQualityScore(
      baseStats({ totalMessages: 20, vacanciesExtracted: 18, successRate: 0.9, duplicateRate: 0.1, spamRate: 0.05 })
    );
    expect(score).toBeGreaterThan(80);
  });

  it('scores a mostly-duplicate, high-spam channel poorly despite activity', () => {
    const score = computeChannelQualityScore(
      baseStats({ totalMessages: 20, vacanciesExtracted: 2, successRate: 0.1, duplicateRate: 0.9, spamRate: 0.6 })
    );
    expect(score).toBeLessThan(40);
  });

  it('never exceeds 100 or drops below 0', () => {
    const perfect = computeChannelQualityScore(baseStats({ totalMessages: 100, successRate: 1, duplicateRate: 0, spamRate: 0 }));
    const worst = computeChannelQualityScore(baseStats({ totalMessages: 100, successRate: 0, duplicateRate: 1, spamRate: 1 }));
    expect(perfect).toBeLessThanOrEqual(100);
    expect(worst).toBeGreaterThanOrEqual(0);
  });
});

describe('TelegramChannelStatsService', () => {
  it('computes metrics then persists them under the channel id', async () => {
    const metrics = baseStats({ totalMessages: 5, vacanciesExtracted: 3 });
    const repo = {
      computeChannelMetrics: vi.fn().mockResolvedValue(metrics),
      upsert: vi.fn().mockImplementation((channelId, data) => Promise.resolve({ channelId, ...data, lastComputedAt: new Date() })),
    };
    const service = new TelegramChannelStatsService(repo);

    const result = await service.computeAndPersist('somechannel', 'channel-id-1');

    expect(repo.computeChannelMetrics).toHaveBeenCalledWith('somechannel');
    expect(repo.upsert).toHaveBeenCalledWith('channel-id-1', metrics);
    expect(result.channelId).toBe('channel-id-1');
  });
});
