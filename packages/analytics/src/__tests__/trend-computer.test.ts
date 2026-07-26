import { describe, it, expect } from 'vitest';
import { computeTrends } from '../trend-computer.js';
import type { DateRange } from '../types.js';

const currentRange: DateRange = { from: new Date('2026-01-01'), to: new Date('2026-01-08'), label: '7d' };

describe('computeTrends', () => {
  it('computes current/previous/delta for the applications metric', () => {
    const currentApps = [
      { status: 'applied', createdAt: new Date('2026-01-02') },
      { status: 'applied', createdAt: new Date('2026-01-03') },
    ];
    const previousApps = [{ status: 'applied', createdAt: new Date('2025-12-26') }];

    const trends = computeTrends(currentApps, previousApps, [], [], currentRange);
    const applicationsMetric = trends.metrics.find((m) => m.name === 'Applications');

    expect(applicationsMetric?.current).toBe(2);
    expect(applicationsMetric?.previous).toBe(1);
    expect(applicationsMetric?.delta).toBe(1);
    expect(applicationsMetric?.direction).toBe('up');
  });

  it('marks direction as stable when there is no change', () => {
    const trends = computeTrends([], [], [], [], currentRange);
    const applicationsMetric = trends.metrics.find((m) => m.name === 'Applications');
    expect(applicationsMetric?.direction).toBe('stable');
    expect(applicationsMetric?.current).toBe(0);
  });

  it('produces daily data points covering the current range', () => {
    const currentApps = [{ status: 'applied', createdAt: new Date('2026-01-02') }];
    const trends = computeTrends(currentApps, [], [], [], currentRange);
    const applicationsMetric = trends.metrics.find((m) => m.name === 'Applications');

    expect(applicationsMetric?.dataPoints.length).toBeGreaterThan(0);
    const total = applicationsMetric?.dataPoints.reduce((s, p) => s + p.value, 0) ?? 0;
    expect(total).toBe(1);
  });

  it('computes the average match score metric from match results', () => {
    const currentMatches = [
      { generatedAt: new Date('2026-01-02'), overallScore: 80 },
      { generatedAt: new Date('2026-01-03'), overallScore: 60 },
    ];
    const trends = computeTrends([], [], currentMatches, [], currentRange);
    const scoreMetric = trends.metrics.find((m) => m.name === 'Avg Match Score');
    expect(scoreMetric?.current).toBe(70);
  });

  it('reports 100% delta when going from zero to a positive previous-less baseline', () => {
    const currentApps = [{ status: 'applied', createdAt: new Date('2026-01-02') }];
    const trends = computeTrends(currentApps, [], [], [], currentRange);
    const applicationsMetric = trends.metrics.find((m) => m.name === 'Applications');
    expect(applicationsMetric?.deltaPercentage).toBe(100);
  });
});
