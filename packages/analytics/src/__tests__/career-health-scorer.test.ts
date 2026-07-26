import { describe, it, expect } from 'vitest';
import { computeCareerHealthScore } from '../career-health-scorer.js';
import type { DateRange } from '../types.js';

const period: DateRange = { from: new Date('2026-01-01'), to: new Date('2026-02-01'), label: 'test' };

describe('computeCareerHealthScore', () => {
  it('produces a high score for strong, consistent activity', () => {
    const result = computeCareerHealthScore(
      {
        totalApplications: 30,
        applicationsThisWeek: 5,
        totalInterviews: 10,
        totalOffers: 3,
        totalRejected: 5,
        avgMatchScore: 85,
        recentActivityTrend: 0.2,
      },
      period,
    );

    expect(result.overall).toBeGreaterThan(70);
    expect(result.confidence).toBe('high');
    expect(result.trend).toBe('improving');
    expect(result.components).toHaveLength(5);
    const weightSum = result.components.reduce((s, c) => s + c.weight, 0);
    expect(weightSum).toBeCloseTo(1, 5);
  });

  it('produces a low score and low confidence for no activity', () => {
    const result = computeCareerHealthScore(
      {
        totalApplications: 0,
        applicationsThisWeek: 0,
        totalInterviews: 0,
        totalOffers: 0,
        totalRejected: 0,
        avgMatchScore: 0,
        recentActivityTrend: 0,
      },
      period,
    );

    // matchQuality has a 20-point floor even at avgMatchScore=0 (never literally "zero
    // signal"), so overall is a small positive number rather than exactly 0.
    expect(result.overall).toBeLessThan(10);
    expect(result.confidence).toBe('low');
    expect(result.trend).toBe('stable');
  });

  it('marks a declining trend when recent activity dropped', () => {
    const result = computeCareerHealthScore(
      {
        totalApplications: 10,
        applicationsThisWeek: 1,
        totalInterviews: 1,
        totalOffers: 0,
        totalRejected: 3,
        avgMatchScore: 50,
        recentActivityTrend: -0.5,
      },
      period,
    );

    expect(result.trend).toBe('declining');
    expect(result.trendDelta).toBeLessThan(0);
  });
});
