import { describe, it, expect } from 'vitest';
import { generateInsights, generateResumeVersionInsights } from '../insight-generator.js';
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

describe('generateInsights', () => {
  it('surfaces a best-performing segment when one clearly outperforms another', () => {
    const breakdowns: PerformanceBreakdown[] = [
      {
        dimension: 'country',
        segments: [
          segment('Germany', { interviewRate: 60, count: 5 }),
          segment('Poland', { interviewRate: 10, count: 5 }),
        ],
        period,
      },
    ];

    const result = generateInsights(breakdowns, 50, 50, 0, 0, period);
    expect(result.insights.some((i) => i.title.includes('Germany'))).toBe(true);
  });

  it('does not generate a breakdown insight when segments perform similarly', () => {
    const breakdowns: PerformanceBreakdown[] = [
      {
        dimension: 'country',
        segments: [
          segment('Germany', { interviewRate: 20, count: 5 }),
          segment('Poland', { interviewRate: 18, count: 5 }),
        ],
        period,
      },
    ];

    const result = generateInsights(breakdowns, 50, 50, 0, 0, period);
    expect(result.insights.some((i) => i.category === 'performance')).toBe(false);
  });

  it('flags a response rate trend when it moves by more than 5 points', () => {
    const result = generateInsights([], 60, 40, 0, 0, period);
    expect(result.insights.some((i) => i.metric === 'responseRate' && i.type === 'positive')).toBe(true);
  });

  it('flags a match-score correlation insight when the gap is significant', () => {
    const result = generateInsights([], 50, 50, 70, 20, period);
    expect(result.insights.some((i) => i.category === 'correlation')).toBe(true);
  });

  it('sorts insights by priority (high before medium before low)', () => {
    const result = generateInsights([], 80, 40, 70, 10, period);
    const priorities = result.insights.map((i) => i.priority);
    const order = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < priorities.length; i++) {
      expect(order[priorities[i]!]).toBeGreaterThanOrEqual(order[priorities[i - 1]!]);
    }
  });
});

describe('generateResumeVersionInsights', () => {
  it('includes overall best-vs-worst insights and prefixes per-version dimensional insights with the resume label', () => {
    const overallBreakdown: PerformanceBreakdown = {
      dimension: 'resume_version',
      segments: [
        segment('React EN', { interviewRate: 60, count: 5 }),
        segment('Backend RU', { interviewRate: 10, count: 5 }),
      ],
      period,
    };

    const perVersionDimensionalBreakdowns = [
      {
        resumeId: 'resume-a',
        resumeLabel: 'React EN',
        breakdowns: [
          {
            dimension: 'provider',
            segments: [
              segment('Greenhouse', { interviewRate: 70, count: 5 }),
              segment('LinkedIn', { interviewRate: 20, count: 5 }),
            ],
            period,
          } satisfies PerformanceBreakdown,
        ],
      },
    ];

    const result = generateResumeVersionInsights(overallBreakdown, perVersionDimensionalBreakdowns, period);

    expect(result.insights.some((i) => i.title.includes('React EN'))).toBe(true);
    expect(result.insights.some((i) => i.description.startsWith('React EN:') && i.description.includes('Greenhouse'))).toBe(true);
  });

  it('returns only the overall insights when no dimensional breakdowns are given', () => {
    const overallBreakdown: PerformanceBreakdown = {
      dimension: 'resume_version',
      segments: [
        segment('React EN', { interviewRate: 60, count: 5 }),
        segment('Backend RU', { interviewRate: 10, count: 5 }),
      ],
      period,
    };

    const result = generateResumeVersionInsights(overallBreakdown, [], period);
    expect(result.insights.length).toBeGreaterThan(0);
  });
});
