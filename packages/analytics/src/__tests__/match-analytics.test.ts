import { describe, it, expect } from 'vitest';
import { computeMatchAnalytics } from '../match-analytics.js';
import type { DateRange } from '../types.js';

const period: DateRange = { from: new Date('2026-01-01'), to: new Date('2026-02-01'), label: 'test' };

describe('computeMatchAnalytics', () => {
  it('returns zeroed analytics for an empty input', () => {
    const result = computeMatchAnalytics([], period);
    expect(result.avgOverallScore).toBe(0);
    expect(result.categoryAverages).toEqual([]);
    expect(result.correlationWithInterviewRate).toBe(0);
  });

  it('computes avg/median overall score and category averages', () => {
    const matches = [
      {
        overallScore: 80,
        categoryScores: [{ category: 'technical_skills', label: 'Technical Skills', value: 90 }],
      },
      {
        overallScore: 60,
        categoryScores: [{ category: 'technical_skills', label: 'Technical Skills', value: 50 }],
      },
    ];

    const result = computeMatchAnalytics(matches, period);
    expect(result.avgOverallScore).toBe(70);
    expect(result.categoryAverages).toHaveLength(1);
    expect(result.categoryAverages[0]?.avgScore).toBe(70);
    expect(result.categoryAverages[0]?.minScore).toBe(50);
    expect(result.categoryAverages[0]?.maxScore).toBe(90);
  });

  it('computes a positive correlation when high scores reach interviews and low scores do not', () => {
    const matches = [
      { overallScore: 90, categoryScores: [], reachedInterview: true },
      { overallScore: 85, categoryScores: [], reachedInterview: true },
      { overallScore: 20, categoryScores: [], reachedInterview: false },
      { overallScore: 15, categoryScores: [], reachedInterview: false },
    ];

    const result = computeMatchAnalytics(matches, period);
    expect(result.correlationWithInterviewRate).toBeGreaterThan(0.5);
  });

  it('excludes match results with an unknown outcome from the correlation', () => {
    const matches = [
      { overallScore: 90, categoryScores: [] },
      { overallScore: 20, categoryScores: [] },
    ];

    const result = computeMatchAnalytics(matches, period);
    expect(result.correlationWithInterviewRate).toBe(0);
  });

  it('ignores malformed category score entries', () => {
    const matches = [
      { overallScore: 50, categoryScores: 'not-an-array' },
      { overallScore: 60, categoryScores: [{ notCategory: true }] },
    ];

    const result = computeMatchAnalytics(matches, period);
    expect(result.categoryAverages).toEqual([]);
  });
});
