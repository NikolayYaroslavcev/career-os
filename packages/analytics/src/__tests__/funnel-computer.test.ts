import { describe, it, expect } from 'vitest';
import { computeFunnel } from '../funnel-computer.js';
import type { DateRange } from '../types.js';

const period: DateRange = { from: new Date('2026-01-01'), to: new Date('2026-02-01'), label: 'test' };

function app(status: string) {
  return { status, createdAt: new Date('2026-01-15'), appliedAt: null };
}

describe('computeFunnel', () => {
  it('computes stage counts and percentages relative to vacanciesFound', () => {
    const applications = [
      app('saved'),
      app('applied'),
      app('applied'),
      app('hr_interview'),
      app('offer'),
    ];

    const funnel = computeFunnel(applications, 10, period);

    expect(funnel.totalFound).toBe(10);
    expect(funnel.totalApplied).toBe(4); // applied + hr_interview + offer
    expect(funnel.totalOffers).toBe(1);
    expect(funnel.overallConversion).toBe(10); // 1/10 * 100

    const savedStage = funnel.stages.find((s) => s.status === 'saved');
    expect(savedStage?.count).toBe(1);
    expect(savedStage?.percentage).toBe(10);
  });

  it('computes drop-off between consecutive stages', () => {
    const applications = [app('saved'), app('saved'), app('applied')];
    const funnel = computeFunnel(applications, 4, period);

    const foundStage = funnel.stages.find((s) => s.status === 'all');
    const savedStage = funnel.stages.find((s) => s.status === 'saved');
    const appliedStage = funnel.stages.find((s) => s.status === 'applied');

    expect(foundStage?.count).toBe(4);
    expect(savedStage?.count).toBe(2);
    expect(savedStage?.dropOff).toBe(2); // 4 found -> 2 saved
    expect(appliedStage?.count).toBe(1);
    expect(appliedStage?.dropOff).toBe(1); // 2 saved -> 1 applied
  });

  it('handles zero vacanciesFound without dividing by zero', () => {
    const funnel = computeFunnel([], 0, period);
    expect(funnel.overallConversion).toBe(0);
    for (const stage of funnel.stages) {
      expect(stage.percentage).toBe(0);
      expect(Number.isFinite(stage.dropOffPercentage)).toBe(true);
    }
  });

  it('returns all 8 stages in order', () => {
    const funnel = computeFunnel([], 5, period);
    expect(funnel.stages.map((s) => s.status)).toEqual([
      'all', 'saved', 'applied', 'waiting', 'hr_interview', 'technical_interview', 'final_interview', 'offer',
    ]);
  });
});
