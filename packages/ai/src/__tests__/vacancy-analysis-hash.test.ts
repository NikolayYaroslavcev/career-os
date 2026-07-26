import { describe, it, expect } from 'vitest';
import { computeVacancyAnalysisInputHash } from '../matching/vacancy-analysis-hash.js';

const BASE = {
  vacancyId: 'v1',
  vacancyUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
  searchProfileId: 'sp1',
  searchProfileUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('computeVacancyAnalysisInputHash', () => {
  it('is stable for identical inputs', () => {
    expect(computeVacancyAnalysisInputHash(BASE)).toBe(computeVacancyAnalysisInputHash({ ...BASE }));
  });

  it('changes when the vacancy is updated', () => {
    const changed = computeVacancyAnalysisInputHash({
      ...BASE,
      vacancyUpdatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    expect(changed).not.toBe(computeVacancyAnalysisInputHash(BASE));
  });

  it('changes when the search profile is updated', () => {
    const changed = computeVacancyAnalysisInputHash({
      ...BASE,
      searchProfileUpdatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    expect(changed).not.toBe(computeVacancyAnalysisInputHash(BASE));
  });

  it('changes once a resume becomes available', () => {
    const withResume = computeVacancyAnalysisInputHash({
      ...BASE,
      resumeId: 'r1',
      resumeUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(withResume).not.toBe(computeVacancyAnalysisInputHash(BASE));
  });

  it('changes when the resume itself is updated', () => {
    const first = computeVacancyAnalysisInputHash({
      ...BASE,
      resumeId: 'r1',
      resumeUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const second = computeVacancyAnalysisInputHash({
      ...BASE,
      resumeId: 'r1',
      resumeUpdatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    expect(first).not.toBe(second);
  });
});
