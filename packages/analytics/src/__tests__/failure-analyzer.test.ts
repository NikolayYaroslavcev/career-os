import { describe, it, expect } from 'vitest';
import { analyzeFailures, computeRejectionBreakdown } from '../failure-analyzer.js';
import type { DateRange } from '../types.js';

const period: DateRange = { from: new Date('2026-01-01'), to: new Date('2026-02-01'), label: 'test' };

describe('analyzeFailures', () => {
  it('attributes rejections to the correct prior stage when history is available', () => {
    const applications = [
      {
        status: 'rejected',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-10'),
        appliedAt: new Date('2026-01-02'),
        priorStatus: 'applied',
        daysInPriorStage: 8,
      },
      {
        status: 'rejected',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-20'),
        appliedAt: new Date('2026-01-02'),
        priorStatus: 'hr_interview',
        daysInPriorStage: 5,
      },
    ];

    const result = analyzeFailures(applications, period);

    expect(result.totalRejected).toBe(2);
    const beforeHr = result.stages.find((s) => s.stage === 'Before HR');
    const afterHr = result.stages.find((s) => s.stage === 'After HR');
    expect(beforeHr?.count).toBe(1);
    expect(beforeHr?.avgDaysInStage).toBe(8);
    expect(afterHr?.count).toBe(1);
    expect(afterHr?.avgDaysInStage).toBe(5);
    expect(result.primaryFailurePoint).toBeDefined();
  });

  it('buckets rejections with no history under "Unknown stage"', () => {
    const applications = [
      { status: 'rejected', createdAt: new Date(), updatedAt: new Date(), appliedAt: null },
    ];

    const result = analyzeFailures(applications, period);
    expect(result.stages.find((s) => s.stage === 'Unknown stage')?.count).toBe(1);
  });

  it('counts withdrawn (archived) applications separately from rejections', () => {
    const applications = [
      { status: 'rejected', createdAt: new Date(), updatedAt: new Date(), appliedAt: null },
      { status: 'archived', createdAt: new Date(), updatedAt: new Date(), appliedAt: null },
    ];

    const result = analyzeFailures(applications, period);
    expect(result.totalRejected).toBe(1);
    expect(result.totalWithdrawn).toBe(1);
  });

  it('returns "No data" as the primary failure point when there are no rejections', () => {
    const result = analyzeFailures([], period);
    expect(result.primaryFailurePoint).toBe('No data');
  });
});

describe('computeRejectionBreakdown', () => {
  it('returns an empty array when there are no rejections', () => {
    expect(computeRejectionBreakdown([])).toEqual([]);
  });

  it('buckets rejections by days-since-applied', () => {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    const applications = [
      { status: 'rejected', createdAt: now, updatedAt: now, appliedAt: daysAgo(2) },
      { status: 'rejected', createdAt: now, updatedAt: now, appliedAt: daysAgo(45) },
    ];

    const breakdown = computeRejectionBreakdown(applications);
    const total = breakdown.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(2);
    expect(breakdown.every((b) => b.count > 0)).toBe(true);
  });
});
