import { describe, it, expect } from 'vitest';
import { computeSkillMatrix } from '../skill-matrix-engine.js';
import type { AtsResumeEvidence, AtsVacancyRequirements } from '../../ats/ats-scoring-engine.js';

function makeResume(overrides: Partial<AtsResumeEvidence> = {}): AtsResumeEvidence {
  return {
    summary: 'Backend engineer.',
    skills: ['Node.js', 'Docker', 'Kubernetes'],
    technologies: ['Node.js', 'PostgreSQL'],
    totalYearsOfExperience: 5,
    educationEntries: [],
    certifications: [],
    languages: [],
    experienceBullets: ['Built services with Node.js and PostgreSQL to process payments'],
    experienceJobCount: 1,
    ...overrides,
  };
}

function makeVacancy(overrides: Partial<AtsVacancyRequirements> = {}): AtsVacancyRequirements {
  return {
    seniority: 'senior',
    requiredSkills: ['Node.js'],
    preferredSkills: ['Docker'],
    responsibilities: ['Build payment processing services'],
    atsKeywords: ['Node.js', 'PostgreSQL'],
    technologies: ['Node.js', 'PostgreSQL'],
    domain: 'backend',
    industry: 'fintech',
    education: [],
    certifications: [],
    languageRequirements: [],
    ...overrides,
  };
}

describe('computeSkillMatrix', () => {
  it('matches required and preferred skills present in the resume', () => {
    const matrix = computeSkillMatrix(makeResume(), makeVacancy());
    expect(matrix.matchedSkills).toContain('Node.js');
    expect(matrix.matchedSkills).toContain('Docker');
  });

  it('reports missing skills required by the vacancy but absent from the resume', () => {
    const matrix = computeSkillMatrix(makeResume(), makeVacancy({ requiredSkills: ['Node.js', 'Rust'] }));
    expect(matrix.missingSkills).toContain('Rust');
  });

  it('classifies a skill as strong when it is also evidenced in an experience bullet', () => {
    const matrix = computeSkillMatrix(makeResume(), makeVacancy());
    expect(matrix.strongSkills).toContain('Node.js');
  });

  it('classifies a skill as weak when it is only listed, not evidenced in any bullet', () => {
    const matrix = computeSkillMatrix(makeResume(), makeVacancy());
    // "Kubernetes" appears in the skills list but not in the experience bullet text.
    expect(matrix.weakSkills).toContain('Kubernetes');
    expect(matrix.strongSkills).not.toContain('Kubernetes');
  });

  it('returns full coverage ratios when the vacancy has no requirements in a category', () => {
    const emptyVacancy: AtsVacancyRequirements = {
      seniority: '',
      requiredSkills: [],
      preferredSkills: [],
      responsibilities: [],
      atsKeywords: [],
      technologies: [],
      domain: '',
      industry: '',
      education: [],
      certifications: [],
      languageRequirements: [],
    };
    const matrix = computeSkillMatrix(makeResume(), emptyVacancy);

    expect(matrix.atsKeywordCoverageRatio).toBe(1);
    expect(matrix.technologyCoverageRatio).toBe(1);
    expect(matrix.responsibilityCoverageRatio).toBe(1);
  });

  it('handles an empty resume without throwing and reports zero coverage', () => {
    const emptyResume: AtsResumeEvidence = {
      summary: '',
      skills: [],
      technologies: [],
      totalYearsOfExperience: 0,
      educationEntries: [],
      certifications: [],
      languages: [],
      experienceBullets: [],
      experienceJobCount: 0,
    };

    const matrix = computeSkillMatrix(emptyResume, makeVacancy());
    expect(matrix.matchedSkills).toHaveLength(0);
    expect(matrix.technologyCoverageRatio).toBe(0);
  });
});
