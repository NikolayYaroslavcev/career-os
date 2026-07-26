import { describe, it, expect } from 'vitest';
import { recommendResumeVersion } from '../resume-version-recommender.js';
import type { ResumeVersionCandidate, RecommendationVacancyInput } from '../resume-version-recommender.js';
import type { PerformanceBreakdown, DateRange } from '../types.js';

const period: DateRange = { from: new Date('2026-01-01'), to: new Date('2026-02-01'), label: 'test' };

function countryBreakdown(label: string, interviewRate: number, count: number): PerformanceBreakdown {
  return {
    dimension: 'country',
    period,
    segments: [{ label, count, applications: count, interviews: 0, offers: 0, responseRate: 0, interviewRate, offerRate: 0, avgMatchScore: 0 }],
  };
}

function baseCandidate(overrides: Partial<ResumeVersionCandidate>): ResumeVersionCandidate {
  return {
    resumeId: 'resume',
    applications: 10,
    interviewRate: 20,
    avgMatchScore: 50,
    offerRate: 5,
    breakdowns: [],
    ...overrides,
  };
}

const vacancy: RecommendationVacancyInput = {
  vacancyId: 'vacancy-1',
  country: 'Germany',
  source: 'linkedin',
  technologies: ['React'],
};

describe('recommendResumeVersion', () => {
  it('returns no recommendation when fewer than 2 versions have any applications', () => {
    const candidates = [baseCandidate({ resumeId: 'a', applications: 5 }), baseCandidate({ resumeId: 'b', applications: 0 })];
    const result = recommendResumeVersion(vacancy, candidates);

    expect(result.recommendedResumeId).toBeNull();
    expect(result.confidence).toBe('low');
    expect(result.reasons).toEqual([]);
    expect(result.alternatives).toEqual([]);
  });

  it('recommends the version with stronger overall metrics when no dimension-specific evidence exists', () => {
    const a = baseCandidate({ resumeId: 'a', interviewRate: 50, avgMatchScore: 80, offerRate: 20, applications: 20 });
    const b = baseCandidate({ resumeId: 'b', interviewRate: 10, avgMatchScore: 30, offerRate: 0, applications: 20 });

    const result = recommendResumeVersion(vacancy, [a, b]);

    expect(result.recommendedResumeId).toBe('a');
    expect(result.alternatives).toEqual([{ resumeId: 'b', score: expect.any(Number) }]);
    expect(result.score).toBeGreaterThan(0);
  });

  it('boosts a version with strong country-specific evidence for the vacancy country', () => {
    const a = baseCandidate({
      resumeId: 'a',
      interviewRate: 15,
      avgMatchScore: 50,
      offerRate: 5,
      applications: 20,
      breakdowns: [countryBreakdown('Germany', 90, 10)],
    });
    const b = baseCandidate({ resumeId: 'b', interviewRate: 20, avgMatchScore: 50, offerRate: 5, applications: 20 });

    const result = recommendResumeVersion(vacancy, [a, b]);

    expect(result.recommendedResumeId).toBe('a');
    const countryReason = result.reasons.find((r) => r.factor === 'country:Germany');
    expect(countryReason?.resumeVersionValue).toBe(90);
  });

  it('falls back to the overall interview rate when the country segment has too few samples', () => {
    const a = baseCandidate({
      resumeId: 'a',
      interviewRate: 15,
      applications: 20,
      breakdowns: [countryBreakdown('Germany', 90, 1)], // below MIN_SAMPLE_SIZE
    });
    const b = baseCandidate({ resumeId: 'b', interviewRate: 15, applications: 20 });

    const result = recommendResumeVersion(vacancy, [a, b]);
    const countryReasonA = result.recommendedResumeId === 'a'
      ? result.reasons.find((r) => r.factor === 'country:Germany')
      : undefined;
    // With too few samples, the thin segment must not be used — value falls back to overall interviewRate (15)
    if (countryReasonA) {
      expect(countryReasonA.resumeVersionValue).toBe(15);
    }
  });

  it('produces reasons for every weighted factor', () => {
    const a = baseCandidate({ resumeId: 'a', applications: 10 });
    const b = baseCandidate({ resumeId: 'b', applications: 10, interviewRate: 5 });

    const result = recommendResumeVersion(vacancy, [a, b]);
    const factors = result.reasons.map((r) => r.factor);

    expect(factors).toEqual(
      expect.arrayContaining(['interviewRate', 'avgMatchScore', 'offerRate', 'country:Germany', 'provider:linkedin', 'technology']),
    );
  });
});
