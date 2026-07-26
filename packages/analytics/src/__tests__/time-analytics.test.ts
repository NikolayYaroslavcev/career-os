import { describe, it, expect } from 'vitest';
import { computeTimeAnalytics } from '../time-analytics.js';
import type { DateRange } from '../types.js';

const period: DateRange = { from: new Date('2026-01-01'), to: new Date('2026-02-01'), label: 'test' };
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

describe('computeTimeAnalytics', () => {
  it('returns zeroed metrics with sampleSize 0 when there are no applications', () => {
    const result = computeTimeAnalytics([], period);
    expect(result.toHR.sampleSize).toBe(0);
    expect(result.toHR.avgDays).toBe(0);
    expect(result.fastestProcess.sampleSize).toBe(0);
  });

  it('computes toHR/toTechnical/toFinal/toOffer only for applications that reached that stage', () => {
    const applications = [
      { status: 'hr_interview', createdAt: daysAgo(10), appliedAt: daysAgo(9), updatedAt: now },
      { status: 'offer', createdAt: daysAgo(20), appliedAt: daysAgo(18), updatedAt: now },
      { status: 'applied', createdAt: daysAgo(2), appliedAt: daysAgo(1), updatedAt: now },
    ];

    const result = computeTimeAnalytics(applications, period);

    // Both the hr_interview and offer applications have reached >= HR
    expect(result.toHR.sampleSize).toBe(2);
    // Only the offer application has reached "final"/"offer"
    expect(result.toFinal.sampleSize).toBe(1);
    expect(result.toOffer.sampleSize).toBe(1);
  });

  it('computes fastest/longest process from offer applications', () => {
    const applications = [
      { status: 'offer', createdAt: now, appliedAt: daysAgo(5), updatedAt: now },
      { status: 'offer', createdAt: now, appliedAt: daysAgo(30), updatedAt: now },
    ];

    const result = computeTimeAnalytics(applications, period);
    expect(result.fastestProcess.avgDays).toBeLessThanOrEqual(result.longestProcess.avgDays);
  });

  it('computes median correctly for an even-sized sample', () => {
    const applications = [
      { status: 'hr_interview', createdAt: now, appliedAt: daysAgo(10), updatedAt: now },
      { status: 'hr_interview', createdAt: now, appliedAt: daysAgo(20), updatedAt: now },
      { status: 'hr_interview', createdAt: now, appliedAt: daysAgo(30), updatedAt: now },
      { status: 'hr_interview', createdAt: now, appliedAt: daysAgo(40), updatedAt: now },
    ];

    const result = computeTimeAnalytics(applications, period);
    expect(result.toHR.medianDays).toBeCloseTo(25, 0);
  });
});
