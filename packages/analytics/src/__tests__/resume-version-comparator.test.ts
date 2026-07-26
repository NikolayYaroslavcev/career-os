import { describe, it, expect } from 'vitest';
import { compareResumeVersions } from '../resume-version-comparator.js';
import type { ResumeVersionSummary, DateRange } from '../types.js';

const period: DateRange = { from: new Date('2026-01-01'), to: new Date('2026-02-01'), label: 'test' };

function summary(overrides: Partial<ResumeVersionSummary>): ResumeVersionSummary {
  return {
    resumeId: 'resume',
    applications: 10,
    interviewRate: 20,
    offerRate: 5,
    responseRate: 30,
    avgMatchScore: 60,
    avgSalary: null,
    sampleSize: 10,
    ...overrides,
  };
}

describe('compareResumeVersions', () => {
  it('declares B the winner when it beats A on every metric with a large sample', () => {
    const a = summary({ resumeId: 'a', interviewRate: 10, offerRate: 2, responseRate: 15, avgMatchScore: 50, sampleSize: 20 });
    const b = summary({ resumeId: 'b', interviewRate: 30, offerRate: 10, responseRate: 40, avgMatchScore: 70, sampleSize: 20 });

    const result = compareResumeVersions(a, b, period);

    expect(result.overallWinner).toBe('B');
    expect(result.confidence).toBe('high');
    expect(result.metricDeltas.every((d) => d.winner === 'B')).toBe(true);
  });

  it('computes absolute and percentage deltas per metric', () => {
    const a = summary({ resumeId: 'a', interviewRate: 20 });
    const b = summary({ resumeId: 'b', interviewRate: 30 });

    const result = compareResumeVersions(a, b, period);
    const interviewDelta = result.metricDeltas.find((d) => d.metric === 'interviewRate');

    expect(interviewDelta?.deltaAbsolute).toBe(10);
    expect(interviewDelta?.deltaPercentage).toBe(50);
    expect(interviewDelta?.winner).toBe('B');
  });

  it('declares a tie when metrics split evenly', () => {
    const a = summary({ resumeId: 'a', interviewRate: 30, offerRate: 2, responseRate: 15, avgMatchScore: 70 });
    const b = summary({ resumeId: 'b', interviewRate: 10, offerRate: 10, responseRate: 40, avgMatchScore: 50 });

    const result = compareResumeVersions(a, b, period);
    expect(result.overallWinner).toBe('tie');
  });

  it('gates confidence on the weaker side sample size', () => {
    const a = summary({ resumeId: 'a', interviewRate: 40, sampleSize: 2 });
    const b = summary({ resumeId: 'b', interviewRate: 10, sampleSize: 50 });

    const result = compareResumeVersions(a, b, period);
    expect(result.confidence).toBe('low');
  });
});
