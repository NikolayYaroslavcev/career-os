import { describe, it, expect } from 'vitest';
import { analyzeSuccessPatterns, confidenceFor, MIN_SAMPLE_SIZE } from '../success-pattern-analyzer.js';
import type { PerformanceBreakdown, DateRange } from '../types.js';

const period: DateRange = { from: new Date('2026-01-01'), to: new Date('2026-02-01'), label: 'test' };

function segment(label: string, overrides: Partial<PerformanceBreakdown['segments'][number]> = {}) {
  return {
    label,
    count: 5,
    applications: 5,
    interviews: 0,
    offers: 0,
    responseRate: 0,
    interviewRate: 0,
    offerRate: 0,
    avgMatchScore: 0,
    ...overrides,
  };
}

describe('analyzeSuccessPatterns', () => {
  it('identifies the best-performing segment by offer rate when offers exist', () => {
    const breakdowns: PerformanceBreakdown[] = [
      {
        dimension: 'country',
        segments: [
          segment('Germany', { offerRate: 40, count: 5 }),
          segment('Poland', { offerRate: 5, count: 5 }),
        ],
        period,
      },
    ];

    const patterns = analyzeSuccessPatterns(breakdowns);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.bestPerforming).toBe('Germany');
    expect(patterns[0]?.metric).toBe('offerRate');
  });

  it('falls back to interview rate when no segment has any offers', () => {
    const breakdowns: PerformanceBreakdown[] = [
      {
        dimension: 'country',
        segments: [
          segment('Germany', { interviewRate: 50, count: 5 }),
          segment('Poland', { interviewRate: 10, count: 5 }),
        ],
        period,
      },
    ];

    const patterns = analyzeSuccessPatterns(breakdowns);
    expect(patterns[0]?.metric).toBe('interviewRate');
  });

  it('skips segments below the minimum sample size', () => {
    const breakdowns: PerformanceBreakdown[] = [
      {
        dimension: 'country',
        segments: [
          segment('Germany', { offerRate: 40, count: 1 }),
          segment('Poland', { offerRate: 5, count: 1 }),
        ],
        period,
      },
    ];

    expect(analyzeSuccessPatterns(breakdowns)).toEqual([]);
  });

  it('skips a dimension when fewer than 2 segments are eligible', () => {
    const breakdowns: PerformanceBreakdown[] = [
      { dimension: 'country', segments: [segment('Germany', { offerRate: 40, count: 5 })], period },
    ];

    expect(analyzeSuccessPatterns(breakdowns)).toEqual([]);
  });

  it('assigns higher confidence to larger sample sizes', () => {
    const breakdowns: PerformanceBreakdown[] = [
      {
        dimension: 'country',
        segments: [
          segment('Germany', { offerRate: 40, count: 20 }),
          segment('Poland', { offerRate: 5, count: 20 }),
        ],
        period,
      },
    ];

    expect(analyzeSuccessPatterns(breakdowns)[0]?.confidence).toBe('high');
  });
});

describe('confidenceFor', () => {
  it('returns low below the minimum sample size', () => {
    expect(confidenceFor(0)).toBe('low');
    expect(confidenceFor(MIN_SAMPLE_SIZE)).toBe('low');
    expect(confidenceFor(5)).toBe('low');
  });

  it('returns medium at and above 6', () => {
    expect(confidenceFor(6)).toBe('medium');
    expect(confidenceFor(14)).toBe('medium');
  });

  it('returns high at and above 15', () => {
    expect(confidenceFor(15)).toBe('high');
    expect(confidenceFor(1000)).toBe('high');
  });
});
