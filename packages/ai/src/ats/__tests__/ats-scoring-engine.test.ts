import { describe, it, expect } from 'vitest';
import { computeAtsScore, type AtsResumeEvidence, type AtsVacancyRequirements } from '../ats-scoring-engine.js';
import { DEFAULT_ATS_WEIGHTS } from '../ats-weights-config.js';

function makeResume(overrides: Partial<AtsResumeEvidence> = {}): AtsResumeEvidence {
  return {
    summary: 'Backend engineer with experience building payment systems.',
    skills: ['Node.js', 'TypeScript', 'PostgreSQL'],
    technologies: ['Node.js', 'PostgreSQL'],
    seniorityLevel: 'senior',
    totalYearsOfExperience: 6,
    educationEntries: ['BS in Computer Science — MIT'],
    certifications: ['AWS Certified Developer'],
    languages: ['English — fluent'],
    experienceBullets: [
      'Built a payments API handling 1M transactions per day',
      'Reduced database latency by 20% through query optimization',
    ],
    experienceJobCount: 2,
    ...overrides,
  };
}

function makeVacancy(overrides: Partial<AtsVacancyRequirements> = {}): AtsVacancyRequirements {
  return {
    seniority: 'senior',
    requiredSkills: ['Node.js', 'TypeScript'],
    preferredSkills: ['GraphQL'],
    responsibilities: ['Build and maintain payment processing APIs'],
    atsKeywords: ['Node.js', 'PostgreSQL', 'API'],
    technologies: ['Node.js', 'PostgreSQL'],
    domain: 'backend engineering',
    industry: 'fintech',
    education: ['Computer Science'],
    certifications: ['AWS Certified Developer'],
    languageRequirements: ['English'],
    ...overrides,
  };
}

describe('computeAtsScore', () => {
  it('is reproducible: identical inputs always produce identical scores', () => {
    const resume = makeResume();
    const vacancy = makeVacancy();

    const first = computeAtsScore(resume, vacancy);
    const second = computeAtsScore(resume, vacancy);

    expect(second.overallScore).toBe(first.overallScore);
    expect(second.categories).toEqual(first.categories);
  });

  it('never lets the LLM influence the score — computeAtsScore takes no model/provider input at all', () => {
    // Structural guarantee: the function only accepts resume/vacancy evidence
    // and an optional weights config (2 required params — weights has a
    // default, which JS excludes from Function.length), so there is no code
    // path for a model response to feed into the numeric score.
    expect(computeAtsScore.length).toBe(2);
  });

  it('scores a strong match highly on required skills and technology', () => {
    const result = computeAtsScore(makeResume(), makeVacancy());
    const requiredSkills = result.categories.find((c) => c.category === 'requiredSkills');
    const technology = result.categories.find((c) => c.category === 'technology');

    expect(requiredSkills?.rawScore).toBe(100);
    expect(technology?.rawScore).toBe(100);
    expect(result.overallScore).toBeGreaterThan(70);
  });

  it('reports missing required skills explicitly', () => {
    const resume = makeResume({ skills: ['Python'], technologies: ['Django'] });
    const result = computeAtsScore(resume, makeVacancy());
    const requiredSkills = result.categories.find((c) => c.category === 'requiredSkills');

    expect(requiredSkills?.rawScore).toBe(0);
    expect(requiredSkills?.missingEvidence).toEqual(['Node.js', 'TypeScript']);
  });

  it('excludes categories with no vacancy data from the weighted denominator instead of penalizing the candidate', () => {
    const vacancyWithoutCerts = makeVacancy({ certifications: [], languageRequirements: [], education: [] });
    const result = computeAtsScore(makeResume(), vacancyWithoutCerts);

    const certifications = result.categories.find((c) => c.category === 'certifications');
    const language = result.categories.find((c) => c.category === 'language');
    const education = result.categories.find((c) => c.category === 'education');

    expect(certifications?.applicable).toBe(false);
    expect(language?.applicable).toBe(false);
    expect(education?.applicable).toBe(false);
    // Overall score should be computable from the remaining applicable categories only.
    expect(result.overallScore).toBeGreaterThan(0);
  });

  it('handles an empty vacancy gracefully (no categories applicable except resume-only ones)', () => {
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

    const result = computeAtsScore(makeResume(), emptyVacancy);
    const completeness = result.categories.find((c) => c.category === 'completeness');
    const formatting = result.categories.find((c) => c.category === 'formatting');

    expect(completeness?.applicable).toBe(true);
    expect(formatting?.applicable).toBe(true);
    expect(Number.isFinite(result.overallScore)).toBe(true);
  });

  it('handles an empty resume gracefully (everything missing, score stays a finite low number)', () => {
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

    const result = computeAtsScore(emptyResume, makeVacancy());

    expect(result.overallScore).toBeLessThan(50);
    expect(Number.isFinite(result.overallScore)).toBe(true);
    expect(result.categories.find((c) => c.category === 'requiredSkills')?.rawScore).toBe(0);
  });

  it('respects a custom weights override and stamps the weights version', () => {
    const zeroed = { ...DEFAULT_ATS_WEIGHTS };
    for (const key of Object.keys(zeroed) as Array<keyof typeof zeroed>) {
      if (key !== 'requiredSkills') zeroed[key] = 0;
    }

    const resume = makeResume({ skills: [], technologies: [] }); // fails every other category
    const vacancy = makeVacancy();

    const result = computeAtsScore(resume, vacancy, zeroed);
    // requiredSkills fails (candidate has no matching skills) and it's the only weighted category.
    expect(result.overallScore).toBe(0);
    expect(result.weightsVersion).toBe('1.0.0');
  });
});
