import { describe, it, expect } from 'vitest';
import {
  Vacancy,
  Location,
  ExperienceLevel,
  Technology,
  createVacancyId,
  createCompanyId,
} from '@careeros/career';
import { TriageMatchingService } from '../triage-matching-service.js';
import { buildFixtureResume } from '../../testing/fixtures.js';

function buildVacancy(id: string, title: string, technologies: string[]): Vacancy {
  return Vacancy.create({
    id: createVacancyId(id),
    title,
    description: `Looking for an engineer to work on ${title}.`,
    companyId: createCompanyId(`company-${id}`),
    location: Location.create({ workMode: 'remote' }),
    experienceLevel: ExperienceLevel.SENIOR,
    technologies: technologies.map((name) => Technology.create(name, 'other')),
  });
}

function buildRelevantVacancies(count: number): Vacancy[] {
  return Array.from({ length: count }, (_, i) =>
    buildVacancy(`relevant-${i}`, `Backend Engineer ${i}`, ['typescript', 'node.js', 'postgresql'])
  );
}

function buildIrrelevantVacancies(count: number): Vacancy[] {
  return Array.from({ length: count }, (_, i) =>
    buildVacancy(`irrelevant-${i}`, `iOS Developer ${i}`, ['swift', 'objective-c'])
  );
}

describe('TriageMatchingService', () => {
  describe('triage', () => {
    it('returns all vacancies when count is within topN', () => {
      const service = new TriageMatchingService({ topN: 10, minScore: 0 });
      const resume = buildFixtureResume();
      const vacancies = buildRelevantVacancies(5);

      const outcome = service.triage({ resume, vacancies });

      expect(outcome.passed).toHaveLength(5);
      expect(outcome.rejected).toHaveLength(0);
      expect(outcome.stats.total).toBe(5);
      expect(outcome.stats.passed).toBe(5);
    });

    it('keeps only topN vacancies by score', () => {
      const service = new TriageMatchingService({ topN: 3, minScore: 0 });
      const resume = buildFixtureResume();
      const relevant = buildRelevantVacancies(5);
      const irrelevant = buildIrrelevantVacancies(5);

      const outcome = service.triage({ resume, vacancies: [...relevant, ...irrelevant] });

      expect(outcome.passed).toHaveLength(3);
      expect(outcome.rejected).toHaveLength(7);
      expect(outcome.stats.passed).toBe(3);
      expect(outcome.stats.rejected).toBe(7);
    });

    it('filters by minScore threshold', () => {
      const service = new TriageMatchingService({ topN: 100, minScore: 1 });
      const resume = buildFixtureResume();
      const relevant = buildRelevantVacancies(3);
      const irrelevant = buildIrrelevantVacancies(3);

      const outcome = service.triage({ resume, vacancies: [...relevant, ...irrelevant] });

      expect(outcome.passed.length).toBeGreaterThan(0);
      expect(outcome.passed.length).toBeLessThan(6);
      for (const result of outcome.results.filter((r) => r.passed)) {
        expect(result.score).toBeGreaterThanOrEqual(1);
      }
    });

    it('prioritizes vacancies with technology overlap', () => {
      const service = new TriageMatchingService({ topN: 5, minScore: 0 });
      const resume = buildFixtureResume();
      const relevant = buildRelevantVacancies(5);
      const irrelevant = buildIrrelevantVacancies(10);

      const outcome = service.triage({ resume, vacancies: [...irrelevant, ...relevant] });

      const passedIds = outcome.passed.map((v) => v.id);
      for (const rel of relevant) {
        expect(passedIds).toContain(rel.id);
      }
    });

    it('filters out non-remote vacancies when isRemoteOnly is true', () => {
      const service = new TriageMatchingService({ topN: 10, minScore: 0 });
      const resume = buildFixtureResume();
      const remote = buildVacancy('remote-1', 'Remote Backend', ['typescript']);
      const onsite = Vacancy.create({
        id: createVacancyId('onsite-1'),
        title: 'Onsite Backend',
        description: 'Onsite role',
        companyId: createCompanyId('company-onsite'),
        location: Location.create({ workMode: 'onsite' }),
        experienceLevel: ExperienceLevel.SENIOR,
        technologies: [Technology.create('typescript', 'language')],
      });

      const outcome = service.triage({ resume, vacancies: [remote, onsite], isRemoteOnly: true });

      expect(outcome.passed).toHaveLength(1);
      expect(outcome.passed[0]?.id).toBe('remote-1');
      expect(outcome.rejected).toHaveLength(1);
      expect(outcome.rejected[0]?.id).toBe('onsite-1');
    });

    it('computes average score across all vacancies', () => {
      const service = new TriageMatchingService({ topN: 10, minScore: 0 });
      const resume = buildFixtureResume();
      const vacancies = [...buildRelevantVacancies(2), ...buildIrrelevantVacancies(2)];

      const outcome = service.triage({ resume, vacancies });

      expect(outcome.stats.avgScore).toBeGreaterThan(0);
      expect(outcome.stats.total).toBe(4);
    });

    it('returns triage results with scores for each vacancy', () => {
      const service = new TriageMatchingService({ topN: 3, minScore: 0 });
      const resume = buildFixtureResume();
      const vacancies = [...buildRelevantVacancies(2), ...buildIrrelevantVacancies(2)];

      const outcome = service.triage({ resume, vacancies });

      expect(outcome.results).toHaveLength(4);
      for (const result of outcome.results) {
        expect(result).toHaveProperty('vacancy');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('passed');
        expect(typeof result.score).toBe('number');
        expect(typeof result.passed).toBe('boolean');
      }
    });

    it('sorts results by score descending', () => {
      const service = new TriageMatchingService({ topN: 10, minScore: 0 });
      const resume = buildFixtureResume();
      const vacancies = [...buildIrrelevantVacancies(3), ...buildRelevantVacancies(3)];

      const outcome = service.triage({ resume, vacancies });

      for (let i = 1; i < outcome.results.length; i++) {
        const current = outcome.results[i];
        const previous = outcome.results[i - 1];
        if (!current || !previous) throw new Error('expected a triage result');
        expect(current.score).toBeLessThanOrEqual(previous.score);
      }
    });
  });
});
