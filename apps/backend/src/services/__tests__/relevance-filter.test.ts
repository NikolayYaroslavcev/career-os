import { describe, it, expect } from 'vitest';
import {
  Vacancy,
  Location,
  ExperienceLevel,
  Technology,
  createVacancyId,
  createCompanyId,
} from '@careeros/career';
import { calculateRelevanceScore, selectTopCandidates } from '../relevance-filter.js';
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

describe('calculateRelevanceScore', () => {
  it('scores a vacancy higher when its technologies overlap with resume technologies', () => {
    const resume = buildFixtureResume();
    const strongMatch = buildVacancy('v1', 'Backend Engineer', ['typescript', 'node.js', 'postgresql']);
    const noMatch = buildVacancy('v2', 'iOS Developer', ['swift', 'objective-c']);

    const strongScore = calculateRelevanceScore({
      vacancy: strongMatch,
      resumeTechnologies: resume.technologies.map((t) => t.name),
      resumeSkills: resume.skills.map((s) => s.name),
    });
    const noMatchScore = calculateRelevanceScore({
      vacancy: noMatch,
      resumeTechnologies: resume.technologies.map((t) => t.name),
      resumeSkills: resume.skills.map((s) => s.name),
    });

    expect(strongScore).toBeGreaterThan(noMatchScore);
    expect(noMatchScore).toBe(0);
  });

  it('gives partial credit for resume skills (not just technologies)', () => {
    const vacancy = buildVacancy('v1', 'API Design Role', ['api design']);

    const score = calculateRelevanceScore({
      vacancy,
      resumeTechnologies: [],
      resumeSkills: ['API Design'],
    });

    expect(score).toBeGreaterThan(0);
  });

  it('gives a smaller boost for a resume raw-text mention than a structured technology match', () => {
    const vacancy = buildVacancy('v1', 'Rust Engineer', ['rust']);

    const textOnlyScore = calculateRelevanceScore({
      vacancy,
      resumeTechnologies: [],
      resumeSkills: [],
      resumeText: 'I have contributed to several open-source Rust projects.',
    });
    const structuredScore = calculateRelevanceScore({
      vacancy,
      resumeTechnologies: ['rust'],
      resumeSkills: [],
    });

    expect(textOnlyScore).toBeGreaterThan(0);
    expect(textOnlyScore).toBeLessThan(structuredScore);
  });

  it('is case-insensitive when comparing technologies', () => {
    const vacancy = buildVacancy('v1', 'TypeScript role', ['TypeScript']);

    const score = calculateRelevanceScore({
      vacancy,
      resumeTechnologies: ['typescript'],
      resumeSkills: [],
    });

    expect(score).toBeGreaterThan(0);
  });

  it('does not treat generic role words as a meaningful desired-position match', () => {
    const score = calculateRelevanceScore({
      vacancy: buildVacancy('v1', 'iOS Developer', ['swift']),
      resumeTechnologies: [],
      resumeSkills: [],
      desiredPositions: ['Frontend Developer'],
    });

    expect(score).toBe(0);
  });

  it('does not match short technologies as substrings inside unrelated words', () => {
    const score = calculateRelevanceScore({
      vacancy: buildVacancy('v1', 'Python Engineer', ['python']),
      resumeTechnologies: [],
      resumeSkills: [],
      resumeText: 'Built internal tools with Django and PostgreSQL.',
      searchProfileTechnologies: ['go'],
    });

    expect(score).toBe(0);
  });
});

describe('selectTopCandidates', () => {
  it('returns everything unfiltered when the vacancy count is already within the limit', () => {
    const resume = buildFixtureResume();
    const vacancies = [buildVacancy('v1', 'Backend Engineer', ['typescript']), buildVacancy('v2', 'iOS Developer', ['swift'])];

    const result = selectTopCandidates({ resume, vacancies, limit: 5 });

    expect(result.selected).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
  });

  it('keeps only the top N most relevant vacancies and reports the rest as skipped', () => {
    const resume = buildFixtureResume();

    const relevant = [
      buildVacancy('r1', 'Backend Engineer', ['typescript', 'node.js', 'postgresql']),
      buildVacancy('r2', 'Platform Engineer', ['typescript', 'docker', 'aws']),
      buildVacancy('r3', 'Node.js Developer', ['node.js', 'postgresql']),
    ];
    const irrelevant = [
      buildVacancy('i1', 'iOS Developer', ['swift', 'objective-c']),
      buildVacancy('i2', 'Data Scientist', ['python', 'pandas']),
      buildVacancy('i3', 'Frontend Designer', ['figma', 'sketch']),
    ];

    const result = selectTopCandidates({ resume, vacancies: [...relevant, ...irrelevant], limit: 3 });

    expect(result.selected).toHaveLength(3);
    expect(result.skipped).toHaveLength(3);
    expect(result.selected.map((v) => v.id).sort()).toEqual(relevant.map((v) => v.id).sort());
    expect(result.skipped.map((v) => v.id).sort()).toEqual(irrelevant.map((v) => v.id).sort());
  });

  it('factors search profile technologies in as a weaker signal than resume technologies', () => {
    const resume = buildFixtureResume();

    const vacancies = [
      buildVacancy('resume-match', 'Backend Engineer', ['typescript']),
      buildVacancy('profile-only', 'Go Engineer', ['go']),
      buildVacancy('no-match', 'Marketing Manager', ['seo']),
    ];

    const result = selectTopCandidates({
      resume,
      vacancies,
      searchProfileTechnologies: ['go'],
      limit: 2,
    });

    expect(result.selected.map((v) => v.id)).toEqual(['resume-match', 'profile-only']);
    expect(result.skipped.map((v) => v.id)).toEqual(['no-match']);
  });
});
