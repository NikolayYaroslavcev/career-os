import { describe, it, expect } from 'vitest';
import { calculateRankingScore, VacancyRankingService } from './vacancy-ranking-service.js';
import { getPreferenceDecayFactor } from './preference-boost.js';
import { computeTechnologyMatchLevel } from './technology-normalization.js';
import { Vacancy } from '@careeros/career';
import { SearchProfile } from '@careeros/career';
import { Technology } from '@careeros/career';
import { Location } from '@careeros/career';
import { Salary } from '@careeros/career';
import { ExperienceLevel } from '@careeros/career';
import { createVacancyId, createCompanyId, createSearchProfileId, createUserId } from '@careeros/career';

function createTestVacancy(overrides: {
  title?: string;
  technologies?: string[];
  experienceLevel?: ExperienceLevel;
  salaryMin?: number;
  salaryMax?: number;
  salaryPeriod?: 'monthly' | 'yearly' | 'hourly';
  remote?: 'remote' | 'hybrid' | 'onsite';
  location?: string;
} = {}): Vacancy {
  return Vacancy.create({
    id: createVacancyId('vacancy-1'),
    title: overrides.title ?? 'Senior React Developer',
    description: 'A great frontend role',
    companyId: createCompanyId('company-1'),
    location: Location.create({
      city: overrides.location ?? 'New York',
      country: 'USA',
      workMode: overrides.remote ?? 'remote',
    }),
    experienceLevel: overrides.experienceLevel ?? ExperienceLevel.SENIOR,
    salary: overrides.salaryMin !== undefined || overrides.salaryMax !== undefined
      ? Salary.create(
          overrides.salaryMin ?? 80000,
          overrides.salaryMax ?? 120000,
          'USD',
          overrides.salaryPeriod ?? 'yearly',
        )
      : undefined,
    technologies: (overrides.technologies ?? ['React', 'TypeScript', 'Next.js']).map(
      (t) => Technology.create(t, 'framework'),
    ),
  });
}

function createTestSearchProfile(overrides: {
  desiredPositions?: string[];
  desiredTechnologies?: string[];
  experienceLevel?: ExperienceLevel;
  salaryMin?: number;
  salaryMax?: number;
  salaryPeriod?: 'monthly' | 'yearly' | 'hourly';
  isRemoteOnly?: boolean;
} = {}): SearchProfile {
  return SearchProfile.create({
    id: createSearchProfileId('profile-1'),
    userId: createUserId('user-1'),
    name: 'Frontend Developer',
    desiredPositions: overrides.desiredPositions ?? ['Frontend Developer', 'React Engineer'],
    desiredTechnologies: (overrides.desiredTechnologies ?? ['React', 'TypeScript', 'Next.js']).map(
      (t) => Technology.create(t, 'framework'),
    ),
    experienceLevel: overrides.experienceLevel ?? ExperienceLevel.SENIOR,
    desiredSalary: overrides.salaryMin !== undefined || overrides.salaryMax !== undefined
      ? Salary.create(
          overrides.salaryMin ?? 90000,
          overrides.salaryMax ?? 130000,
          'USD',
          overrides.salaryPeriod ?? 'yearly',
        )
      : undefined,
    isRemoteOnly: overrides.isRemoteOnly ?? false,
  });
}

describe('VacancyRankingService', () => {
  describe('calculateRankingScore', () => {
    it('should give high score for matching technologies', () => {
      const vacancy = createTestVacancy({
        technologies: ['React', 'TypeScript', 'Next.js'],
      });
      const profile = createTestSearchProfile({
        desiredTechnologies: ['React', 'TypeScript', 'Next.js'],
      });

      const result = calculateRankingScore({
        vacancy,
        searchProfile: profile,
      });

      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.matchedSkills).toContain('react');
      expect(result.matchedSkills).toContain('typescript');
      expect(result.matchedSkills).toContain('next.js');
      expect(result.missingSkills).toHaveLength(0);
    });

    it('should decrease score for unrelated technologies', () => {
      const vacancy = createTestVacancy({
        technologies: ['Java', 'Spring', 'Hibernate'],
      });
      const profile = createTestSearchProfile({
        desiredTechnologies: ['React', 'TypeScript', 'Next.js'],
      });

      const result = calculateRankingScore({
        vacancy,
        searchProfile: profile,
      });

      expect(result.matchedSkills).toHaveLength(0);
      expect(result.missingSkills).toHaveLength(3);

      const fullMatchVacancy = createTestVacancy({
        technologies: ['React', 'TypeScript', 'Next.js'],
      });
      const fullMatchResult = calculateRankingScore({
        vacancy: fullMatchVacancy,
        searchProfile: profile,
      });

      expect(result.score).toBeLessThan(fullMatchResult.score);
    });

    it('should give full points for remote preference when vacancy is remote', () => {
      const vacancy = createTestVacancy({ remote: 'remote' });
      const profile = createTestSearchProfile({ isRemoteOnly: true });

      const result = calculateRankingScore({
        vacancy,
        searchProfile: profile,
      });

      expect(result.score).toBeGreaterThanOrEqual(10);
      expect(result.reasons).toContain('Remote position as requested');
    });

    it('should give zero points for non-remote when remote-only', () => {
      const vacancy = createTestVacancy({ remote: 'onsite' });
      const profile = createTestSearchProfile({ isRemoteOnly: true });

      const result = calculateRankingScore({
        vacancy,
        searchProfile: profile,
      });

      expect(result.reasons).toContain('Not a remote position');
    });

    it('should give full points when salary is within range', () => {
      const vacancy = createTestVacancy({
        salaryMin: 100000,
        salaryMax: 140000,
      });
      const profile = createTestSearchProfile({
        salaryMin: 90000,
        salaryMax: 150000,
      });

      const result = calculateRankingScore({
        vacancy,
        searchProfile: profile,
      });

      expect(result.reasons).toContain('Salary within expected range');
    });

    it('should reduce points when salary is below expectation', () => {
      const vacancy = createTestVacancy({
        salaryMin: 60000,
        salaryMax: 80000,
      });
      const profile = createTestSearchProfile({
        salaryMin: 90000,
        salaryMax: 130000,
      });

      const result = calculateRankingScore({
        vacancy,
        searchProfile: profile,
      });

      expect(result.reasons).toContain('Salary below expectation');
    });

    it('should give neutral score when salary is missing', () => {
      const vacancy = createTestVacancy({
        salaryMin: undefined,
        salaryMax: undefined,
      });
      const profile = createTestSearchProfile({
        salaryMin: 90000,
        salaryMax: 130000,
      });

      const result = calculateRankingScore({
        vacancy,
        searchProfile: profile,
      });

      expect(result.reasons).toContain('Salary not listed');
    });

    it('should give bonus points for high provider quality', () => {
      const vacancy = createTestVacancy();
      const profile = createTestSearchProfile();

      const result = calculateRankingScore({
        vacancy,
        searchProfile: profile,
        providerQualityScore: 95,
      });

      expect(result.reasons).toContain('High-quality job source');
    });

    it('should give lower points for low provider quality', () => {
      const vacancy = createTestVacancy();
      const profile = createTestSearchProfile();

      const result = calculateRankingScore({
        vacancy,
        searchProfile: profile,
        providerQualityScore: 30,
      });

      expect(result.reasons).toContain('Lower-quality job source');
    });

    it('should sort vacancies by score correctly', () => {
      const profile = createTestSearchProfile({
        desiredTechnologies: ['React', 'TypeScript'],
        isRemoteOnly: true,
      });

      const vacancy1 = createTestVacancy({
        title: 'React Developer',
        technologies: ['React', 'TypeScript'],
        remote: 'remote',
      });
      const vacancy2 = createTestVacancy({
        title: 'Java Developer',
        technologies: ['Java', 'Spring'],
        remote: 'onsite',
      });

      const result1 = calculateRankingScore({ vacancy: vacancy1, searchProfile: profile });
      const result2 = calculateRankingScore({ vacancy: vacancy2, searchProfile: profile });

      expect(result1.score).toBeGreaterThan(result2.score);
    });

    it('should rank frontend above DevOps for frontend profile', () => {
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
        desiredTechnologies: ['React', 'TypeScript', 'Next.js'],
      });

      const frontendVacancy = createTestVacancy({
        title: 'Senior Frontend Developer',
        technologies: ['React', 'TypeScript', 'Next.js'],
      });

      const devopsVacancy = createTestVacancy({
        title: 'Senior DevOps Engineer',
        technologies: ['React', 'TypeScript', 'Next.js'],
      });

      const frontendResult = calculateRankingScore({ vacancy: frontendVacancy, searchProfile: profile });
      const devopsResult = calculateRankingScore({ vacancy: devopsVacancy, searchProfile: profile });

      expect(frontendResult.score).toBeGreaterThan(devopsResult.score);
      expect(devopsResult.reasons).toContain('Role mismatch: vacancy is devops, user wants frontend');
    });

    it('should penalize AI Engineer for frontend profile', () => {
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
        desiredTechnologies: ['React', 'TypeScript'],
      });

      const aiVacancy = createTestVacancy({
        title: 'Senior AI Engineer',
        technologies: ['React', 'TypeScript'],
      });

      const result = calculateRankingScore({ vacancy: aiVacancy, searchProfile: profile });

      expect(result.reasons).toContain('Role mismatch: vacancy is data, user wants frontend');
    });

    it('should give zero points to onsite for remote-only user', () => {
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
        isRemoteOnly: true,
      });

      const onsiteVacancy = createTestVacancy({
        title: 'Frontend Developer',
        remote: 'onsite',
      });

      const result = calculateRankingScore({ vacancy: onsiteVacancy, searchProfile: profile });

      expect(result.reasons).toContain('Not a remote position');
      const locationReason = result.reasons.find(r => r.includes('remote') || r.includes('Remote'));
      expect(locationReason).toBeDefined();
    });

    it('should give 3 points to hybrid for remote-only user', () => {
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
        isRemoteOnly: true,
      });

      const hybridVacancy = createTestVacancy({
        title: 'Frontend Developer',
        remote: 'hybrid',
      });

      const result = calculateRankingScore({ vacancy: hybridVacancy, searchProfile: profile });

      expect(result.reasons).toContain('Hybrid position (not fully remote)');
    });

    it('should normalize monthly salary to yearly for comparison', () => {
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
        salaryMin: 30000,
        salaryMax: 50000,
        salaryPeriod: 'yearly',
      });

      const vacancyYearly = createTestVacancy({
        title: 'Frontend Developer',
        salaryMin: 36000,
        salaryMax: 48000,
        salaryPeriod: 'yearly',
      });

      const vacancyMonthly = createTestVacancy({
        title: 'Frontend Developer',
        salaryMin: 3000,
        salaryMax: 4000,
        salaryPeriod: 'monthly',
      });

      const resultYearly = calculateRankingScore({ vacancy: vacancyYearly, searchProfile: profile });
      const resultMonthly = calculateRankingScore({ vacancy: vacancyMonthly, searchProfile: profile });

      expect(resultYearly.reasons).toContain('Salary within expected range');
      expect(resultMonthly.reasons).toContain('Salary within expected range');
    });

    it('should affect ranking with provider quality score', () => {
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
      });

      const vacancy = createTestVacancy({
        title: 'Frontend Developer',
      });

      const resultHigh = calculateRankingScore({
        vacancy,
        searchProfile: profile,
        providerQualityScore: 95,
      });

      const resultLow = calculateRankingScore({
        vacancy,
        searchProfile: profile,
        providerQualityScore: 20,
      });

      expect(resultHigh.score).toBeGreaterThan(resultLow.score);
      expect(resultHigh.reasons).toContain('High-quality job source');
      expect(resultLow.reasons).toContain('Lower-quality job source');
    });

    it('should match fullstack role as compatible with frontend', () => {
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
      });

      const fullstackVacancy = createTestVacancy({
        title: 'Fullstack Developer',
        technologies: ['React', 'TypeScript'],
      });

      const result = calculateRankingScore({ vacancy: fullstackVacancy, searchProfile: profile });

      expect(result.reasons).toContain('Fullstack role compatible with frontend');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should increase score with high provider quality', () => {
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
      });

      const vacancy = createTestVacancy({ title: 'Frontend Developer' });

      const resultHigh = calculateRankingScore({
        vacancy,
        searchProfile: profile,
        providerQualityScore: 90,
      });

      const resultLow = calculateRankingScore({
        vacancy,
        searchProfile: profile,
        providerQualityScore: 20,
      });

      expect(resultHigh.score).toBeGreaterThan(resultLow.score);
      expect(resultHigh.reasons).toContain('High-quality job source');
      expect(resultLow.reasons).toContain('Lower-quality job source');
    });

    it('should decrease score with low provider quality', () => {
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
      });

      const vacancy = createTestVacancy({ title: 'Frontend Developer' });

      const resultLow = calculateRankingScore({
        vacancy,
        searchProfile: profile,
        providerQualityScore: 10,
      });

      const resultUnknown = calculateRankingScore({
        vacancy,
        searchProfile: profile,
      });

      expect(resultLow.score).toBeLessThanOrEqual(resultUnknown.score);
    });

    it('should extract technologies from description when vacancy has none', () => {
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
        desiredTechnologies: ['React', 'TypeScript'],
      });

      const vacancyNoTech = Vacancy.create({
        id: createVacancyId('vacancy-no-tech'),
        title: 'Frontend Developer',
        description: 'We need a React developer with TypeScript experience',
        companyId: createCompanyId('company-1'),
        location: Location.create({ city: 'Remote', country: 'USA', workMode: 'remote' }),
        experienceLevel: ExperienceLevel.SENIOR,
        technologies: [],
      });

      const result = calculateRankingScore({ vacancy: vacancyNoTech, searchProfile: profile });

      expect(result.matchedSkills).toContain('react');
      expect(result.matchedSkills).toContain('typescript');
      expect(result.score).toBeGreaterThan(50);
    });

    it('should give reduced but not zero score for senior user and junior vacancy', () => {
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
        experienceLevel: ExperienceLevel.SENIOR,
      });

      const juniorVacancy = createTestVacancy({
        title: 'Frontend Developer',
        experienceLevel: ExperienceLevel.JUNIOR,
      });

      const result = calculateRankingScore({ vacancy: juniorVacancy, searchProfile: profile });

      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons).toContain('Experience level somewhat different');
    });

    it('should give 5 points for experience mismatch instead of zero', () => {
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
        experienceLevel: ExperienceLevel.PRINCIPAL,
      });

      const internVacancy = createTestVacancy({
        title: 'Frontend Developer',
        experienceLevel: ExperienceLevel.INTERN,
      });

      const result = calculateRankingScore({ vacancy: internVacancy, searchProfile: profile });

      expect(result.score).toBeGreaterThan(0);
      const expFactor = result.positiveFactors.find(f => f.name === 'Experience match') ||
                        result.negativeFactors.find(f => f.name === 'Experience mismatch');
      expect(expFactor).toBeDefined();
      expect(expFactor?.score).toBe(5);
    });

    describe('Technology Fallback', () => {
      it('should extract technologies from description when vacancy has none', () => {
        const profile = createTestSearchProfile({
          desiredPositions: ['Frontend Developer'],
          desiredTechnologies: ['React', 'TypeScript'],
        });

        const vacancyNoTech = Vacancy.create({
          id: createVacancyId('vacancy-no-tech-1'),
          title: 'Frontend Developer',
          description: 'We need a React developer with TypeScript experience',
          companyId: createCompanyId('company-1'),
          location: Location.create({ city: 'Remote', country: 'USA', workMode: 'remote' }),
          experienceLevel: ExperienceLevel.SENIOR,
          technologies: [],
        });

        const result = calculateRankingScore({ vacancy: vacancyNoTech, searchProfile: profile });

        expect(result.matchedSkills).toContain('react');
        expect(result.matchedSkills).toContain('typescript');
        expect(result.score).toBeGreaterThan(50);
      });

      it('should extract technologies from title when vacancy has none', () => {
        const profile = createTestSearchProfile({
          desiredPositions: ['Frontend Developer'],
          desiredTechnologies: ['React', 'TypeScript'],
        });

        const vacancyNoTech = Vacancy.create({
          id: createVacancyId('vacancy-no-tech-2'),
          title: 'Senior React Developer',
          description: 'A great role',
          companyId: createCompanyId('company-1'),
          location: Location.create({ city: 'Remote', country: 'USA', workMode: 'remote' }),
          experienceLevel: ExperienceLevel.SENIOR,
          technologies: [],
        });

        const result = calculateRankingScore({ vacancy: vacancyNoTech, searchProfile: profile });

        expect(result.matchedSkills).toContain('react');
        expect(result.score).toBeGreaterThan(30);
      });

      it('should extract technologies from requirements when vacancy has none', () => {
        const profile = createTestSearchProfile({
          desiredPositions: ['Frontend Developer'],
          desiredTechnologies: ['React', 'TypeScript'],
        });

        const vacancyNoTech = Vacancy.create({
          id: createVacancyId('vacancy-no-tech-3'),
          title: 'Frontend Developer',
          description: 'A great role',
          companyId: createCompanyId('company-1'),
          location: Location.create({ city: 'Remote', country: 'USA', workMode: 'remote' }),
          experienceLevel: ExperienceLevel.SENIOR,
          technologies: [],
          requirements: ['Experience with React and TypeScript required'],
        });

        const result = calculateRankingScore({ vacancy: vacancyNoTech, searchProfile: profile });

        expect(result.matchedSkills).toContain('react');
        expect(result.matchedSkills).toContain('typescript');
        expect(result.score).toBeGreaterThan(50);
      });

      it('should prioritize existing technologies over fallback', () => {
        const profile = createTestSearchProfile({
          desiredPositions: ['Frontend Developer'],
          desiredTechnologies: ['React', 'TypeScript', 'Vue'],
        });

        const vacancyWithTech = Vacancy.create({
          id: createVacancyId('vacancy-with-tech'),
          title: 'Vue Developer',
          description: 'We need a Vue developer with React experience',
          companyId: createCompanyId('company-1'),
          location: Location.create({ city: 'Remote', country: 'USA', workMode: 'remote' }),
          experienceLevel: ExperienceLevel.SENIOR,
          technologies: [Technology.create('Vue', 'framework')],
        });

        const result = calculateRankingScore({ vacancy: vacancyWithTech, searchProfile: profile });

        // Vue should be matched from technologies, not from title fallback
        expect(result.matchedSkills).toContain('vue');
        // React should NOT be matched since it's not in technologies array
        expect(result.matchedSkills).not.toContain('react');
      });

      it('should not crash when no technologies are found anywhere', () => {
        const profile = createTestSearchProfile({
          desiredPositions: ['Frontend Developer'],
          desiredTechnologies: ['React', 'TypeScript'],
        });

        const vacancyEmpty = Vacancy.create({
          id: createVacancyId('vacancy-empty'),
          title: 'Software Engineer',
          description: 'A general engineering role with no specific tech mentioned',
          companyId: createCompanyId('company-1'),
          location: Location.create({ city: 'Remote', country: 'USA', workMode: 'remote' }),
          experienceLevel: ExperienceLevel.SENIOR,
          technologies: [],
          requirements: ['General programming skills'],
        });

        const result = calculateRankingScore({ vacancy: vacancyEmpty, searchProfile: profile });

        expect(result.matchedSkills).toHaveLength(0);
        expect(result.missingSkills).toHaveLength(2);
        expect(result.score).toBeGreaterThanOrEqual(0);
      });

      it('should combine technologies from title, description, and requirements', () => {
        const profile = createTestSearchProfile({
          desiredPositions: ['Frontend Developer'],
          desiredTechnologies: ['React', 'TypeScript', 'Next.js', 'Redux'],
        });

        const vacancyNoTech = Vacancy.create({
          id: createVacancyId('vacancy-combined'),
          title: 'React Developer',
          description: 'We need a developer with TypeScript experience',
          companyId: createCompanyId('company-1'),
          location: Location.create({ city: 'Remote', country: 'USA', workMode: 'remote' }),
          experienceLevel: ExperienceLevel.SENIOR,
          technologies: [],
          requirements: ['Experience with Next.js and Redux required'],
        });

        const result = calculateRankingScore({ vacancy: vacancyNoTech, searchProfile: profile });

        expect(result.matchedSkills).toContain('react');
        expect(result.matchedSkills).toContain('typescript');
        expect(result.matchedSkills).toContain('next.js');
        expect(result.matchedSkills).toContain('redux');
        expect(result.score).toBeGreaterThanOrEqual(70);
      });
    });

    describe('Provider Quality Integration', () => {
      it('should rank vacancy from high-quality provider higher than low-quality provider', () => {
        const service = new VacancyRankingService();

        const profile = createTestSearchProfile({
          desiredPositions: ['Frontend Developer'],
          desiredTechnologies: ['React', 'TypeScript'],
        });

        const vacancyA = Vacancy.create({
          id: createVacancyId('vacancy-high-quality'),
          title: 'Frontend Developer',
          description: 'A great frontend role',
          companyId: createCompanyId('company-1'),
          location: Location.create({ city: 'Remote', country: 'USA', workMode: 'remote' }),
          experienceLevel: ExperienceLevel.SENIOR,
          technologies: [Technology.create('React', 'framework'), Technology.create('TypeScript', 'framework')],
        });

        const vacancyB = Vacancy.create({
          id: createVacancyId('vacancy-low-quality'),
          title: 'Frontend Developer',
          description: 'A great frontend role',
          companyId: createCompanyId('company-2'),
          location: Location.create({ city: 'Remote', country: 'USA', workMode: 'remote' }),
          experienceLevel: ExperienceLevel.SENIOR,
          technologies: [Technology.create('React', 'framework'), Technology.create('TypeScript', 'framework')],
        });

        const providerQualityScores = new Map<string, number>();
        providerQualityScores.set('linkedin', 95);
        providerQualityScores.set('hh', 30);

        const vacancyProviderTypes = new Map<string, string>();
        vacancyProviderTypes.set('vacancy-high-quality', 'linkedin');
        vacancyProviderTypes.set('vacancy-low-quality', 'hh');

        const ranked = service.rankVacancies(
          [vacancyA, vacancyB],
          profile,
          providerQualityScores,
          vacancyProviderTypes,
        );

        expect(ranked.length).toBe(2);
        expect(ranked[0]?.vacancy.id.toString()).toBe('vacancy-high-quality');
        expect(ranked[0]?.result.score).toBeGreaterThan(ranked[1]?.result.score ?? Infinity);
      });

      it('should use fallback when provider quality is missing', () => {
        const service = new VacancyRankingService();

        const profile = createTestSearchProfile({
          desiredPositions: ['Frontend Developer'],
          desiredTechnologies: ['React', 'TypeScript'],
        });

        const vacancy = createTestVacancy({
          title: 'Frontend Developer',
          technologies: ['React', 'TypeScript'],
          remote: 'remote',
        });

        const ranked = service.rankVacancies(
          [vacancy],
          profile,
          new Map(),
          new Map(),
        );

        expect(ranked.length).toBe(1);
        expect(ranked[0]?.result.reasons).toContain('Provider quality unknown');
      });

      it('should use fallback when vacancy has no provider type mapping', () => {
        const service = new VacancyRankingService();

        const profile = createTestSearchProfile({
          desiredPositions: ['Frontend Developer'],
          desiredTechnologies: ['React', 'TypeScript'],
        });

        const vacancy = createTestVacancy({
          title: 'Frontend Developer',
          technologies: ['React', 'TypeScript'],
          remote: 'remote',
        });

        const providerQualityScores = new Map<string, number>();
        providerQualityScores.set('linkedin', 95);

        const ranked = service.rankVacancies(
          [vacancy],
          profile,
          providerQualityScores,
          new Map(),
        );

        expect(ranked.length).toBe(1);
        expect(ranked[0]?.result.reasons).toContain('Provider quality unknown');
      });
    });
  });

  describe('Preference Decay', () => {
    it('should return 1.0 for interactions within 7 days', () => {
      const now = new Date('2026-07-23T12:00:00Z');
      const recent = new Date('2026-07-20T12:00:00Z');
      expect(getPreferenceDecayFactor(recent, now)).toBe(1.0);
    });

    it('should return 0.7 for interactions 8-30 days old', () => {
      const now = new Date('2026-07-23T12:00:00Z');
      const twoWeeksAgo = new Date('2026-07-09T12:00:00Z');
      expect(getPreferenceDecayFactor(twoWeeksAgo, now)).toBe(0.7);
    });

    it('should return 0.4 for interactions 31-90 days old', () => {
      const now = new Date('2026-07-23T12:00:00Z');
      const twoMonthsAgo = new Date('2026-05-23T12:00:00Z');
      expect(getPreferenceDecayFactor(twoMonthsAgo, now)).toBe(0.4);
    });

    it('should return 0.2 for interactions older than 90 days', () => {
      const now = new Date('2026-07-23T12:00:00Z');
      const fourMonthsAgo = new Date('2026-03-23T12:00:00Z');
      expect(getPreferenceDecayFactor(fourMonthsAgo, now)).toBe(0.2);
    });

    it('old interactions should have less impact than recent ones', () => {
      const recentDecay = getPreferenceDecayFactor(new Date('2026-07-20T12:00:00Z'));
      const oldDecay = getPreferenceDecayFactor(new Date('2026-01-01T12:00:00Z'));
      expect(recentDecay).toBeGreaterThan(oldDecay);
    });
  });

  describe('Technology Matching Levels', () => {
    it('ReactJS should match React as alias with 90% score', () => {
      const result = computeTechnologyMatchLevel('ReactJS', 'React');
      expect(result.level).toBe('alias');
      expect(result.score).toBe(0.9);
    });

    it('React should match React as exact with 100% score', () => {
      const result = computeTechnologyMatchLevel('React', 'react');
      expect(result.level).toBe('exact');
      expect(result.score).toBe(1.0);
    });

    it('React Native should have partial match with React (70%)', () => {
      const result = computeTechnologyMatchLevel('React Native', 'React');
      expect(result.level).toBe('related');
      expect(result.score).toBe(0.7);
    });

    it('React should have partial match with React Native (70%)', () => {
      const result = computeTechnologyMatchLevel('React', 'React Native');
      expect(result.level).toBe('related');
      expect(result.score).toBe(0.7);
    });

    it('NodeJS should match Node.js as alias', () => {
      const result = computeTechnologyMatchLevel('NodeJS', 'Node.js');
      expect(result.level).toBe('alias');
      expect(result.score).toBe(0.9);
    });

    it('JS should match JavaScript as alias', () => {
      const result = computeTechnologyMatchLevel('JS', 'JavaScript');
      expect(result.level).toBe('alias');
      expect(result.score).toBe(0.9);
    });

    it('TypeScript should have related match with JavaScript (70%)', () => {
      const result = computeTechnologyMatchLevel('TypeScript', 'JavaScript');
      expect(result.level).toBe('related');
      expect(result.score).toBe(0.7);
    });

    it('should return none for completely different technologies', () => {
      const result = computeTechnologyMatchLevel('React', 'Docker');
      expect(result.level).toBe('none');
      expect(result.score).toBe(0.0);
    });

    it('Python should have related match with Django (70%)', () => {
      const result = computeTechnologyMatchLevel('Python', 'Django');
      expect(result.level).toBe('related');
      expect(result.score).toBe(0.7);
    });

    it('Docker should have related match with Kubernetes (70%)', () => {
      const result = computeTechnologyMatchLevel('Docker', 'Kubernetes');
      expect(result.level).toBe('related');
      expect(result.score).toBe(0.7);
    });
  });

  describe('Interest vs Career Fit Separation', () => {
    it('should return interestScore and careerFitScore in result', () => {
      const vacancy = createTestVacancy({
        technologies: ['React', 'TypeScript'],
      });
      const profile = createTestSearchProfile({
        desiredTechnologies: ['React', 'TypeScript'],
      });

      const result = calculateRankingScore({
        vacancy,
        searchProfile: profile,
      });

      expect(result).toHaveProperty('interestScore');
      expect(result).toHaveProperty('careerFitScore');
      expect(typeof result.interestScore).toBe('number');
      expect(typeof result.careerFitScore).toBe('number');
    });

    it('interest should not override career mismatch', () => {
      const vacancy = createTestVacancy({
        title: 'Senior Java Backend Developer',
        technologies: ['Java', 'Spring', 'Hibernate'],
      });
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
        desiredTechnologies: ['React', 'TypeScript'],
      });

      const result = calculateRankingScore({
        vacancy,
        searchProfile: profile,
        interactionBoost: 20,
      });

      expect(result.careerFitScore).toBeLessThan(50);
      expect(result.score).toBeLessThan(50);
      expect(result.reasons).toContain('Role mismatch: vacancy is backend, user wants frontend');
    });

    it('high career fit should produce high score even without interactions', () => {
      const vacancy = createTestVacancy({
        title: 'Senior React Developer',
        technologies: ['React', 'TypeScript', 'Next.js'],
        remote: 'remote',
      });
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer', 'React Engineer'],
        desiredTechnologies: ['React', 'TypeScript', 'Next.js'],
        isRemoteOnly: true,
      });

      const result = calculateRankingScore({
        vacancy,
        searchProfile: profile,
      });

      expect(result.careerFitScore).toBeGreaterThan(60);
      expect(result.score).toBeGreaterThan(40);
    });

    it('interest boosts should not exceed career fit ceiling', () => {
      const vacancy = createTestVacancy({
        title: 'Senior Java Developer',
        technologies: ['Java', 'Spring'],
      });
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
        desiredTechnologies: ['React', 'TypeScript'],
      });

      const resultWithBoost = calculateRankingScore({
        vacancy,
        searchProfile: profile,
        interactionBoost: 20,
      });

      const resultWithoutBoost = calculateRankingScore({
        vacancy,
        searchProfile: profile,
        interactionBoost: 0,
      });

      expect(resultWithBoost.score).toBeLessThanOrEqual(resultWithoutBoost.score + 10);
      expect(resultWithBoost.score).toBeLessThan(60);
    });
  });

  describe('Unknown Role Handling', () => {
    const frontendProfile = createTestSearchProfile({
      desiredPositions: ['Senior Frontend Developer', 'Full Stack Developer', 'React Developer'],
      desiredTechnologies: ['React', 'TypeScript', 'Node.js'],
    });

    it('should give a high score for Frontend Developer + React', () => {
      const vacancy = createTestVacancy({
        title: 'Frontend Developer',
        technologies: ['React', 'TypeScript'],
      });

      const result = calculateRankingScore({ vacancy, searchProfile: frontendProfile });

      expect(result.score).toBeGreaterThanOrEqual(60);
    });

    it('should give a high score for Senior Full Stack Developer + React/TypeScript/Node', () => {
      const vacancy = createTestVacancy({
        title: 'Senior Full Stack Developer',
        technologies: ['React', 'TypeScript', 'Node.js'],
      });

      const result = calculateRankingScore({ vacancy, searchProfile: frontendProfile });

      expect(result.score).toBeGreaterThanOrEqual(60);
    });

    it('should not destroy Product Engineer score via the unknown-role fallback when technologies match', () => {
      const vacancy = createTestVacancy({
        title: 'Product Engineer',
        technologies: ['React', 'TypeScript'],
      });

      const result = calculateRankingScore({ vacancy, searchProfile: frontendProfile });

      expect(result.reasons).toContain('Role category unknown - relying on technology match');
      expect(result.matchedSkills).toContain('react');
      expect(result.matchedSkills).toContain('typescript');
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('should not destroy Founding Engineer score via the unknown-role fallback when technologies match', () => {
      const vacancy = createTestVacancy({
        title: 'Founding Engineer',
        technologies: ['TypeScript', 'React'],
      });

      const result = calculateRankingScore({ vacancy, searchProfile: frontendProfile });

      expect(result.reasons).toContain('Role category unknown - relying on technology match');
      expect(result.matchedSkills).toContain('typescript');
      expect(result.matchedSkills).toContain('react');
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('should give a low score for Director, SOX Compliance with no technology match', () => {
      const vacancy = createTestVacancy({
        title: 'Director, SOX Compliance',
        technologies: [],
      });

      const result = calculateRankingScore({ vacancy, searchProfile: frontendProfile });

      expect(result.tier).toBe('REJECT');
      expect(result.score).toBeLessThan(40);
    });

    it('should give a low score for Sales Director with no technology match', () => {
      const vacancy = createTestVacancy({
        title: 'Fleet Charging Sales Director',
        technologies: [],
      });

      const result = calculateRankingScore({ vacancy, searchProfile: frontendProfile });

      expect(result.tier).toBe('REJECT');
      expect(result.score).toBeLessThan(40);
    });

    it('should give a low score for Chief of Staff with no technology match', () => {
      const vacancy = createTestVacancy({
        title: 'Chief of Staff to GM & COO',
        technologies: [],
      });

      const result = calculateRankingScore({ vacancy, searchProfile: frontendProfile });

      expect(result.tier).toBe('REJECT');
      expect(result.score).toBeLessThan(40);
    });

    it('should not award role points to an unrecognized title with no technology match', () => {
      const vacancy = createTestVacancy({
        title: 'Director of Something Unrelated',
        technologies: [],
      });

      const result = calculateRankingScore({ vacancy, searchProfile: frontendProfile });

      const roleFactor = result.positiveFactors.find((f) => f.name === 'Role match')
        ?? result.negativeFactors.find((f) => f.name === 'Role mismatch');
      expect(roleFactor?.score).toBe(0);
      expect(result.score).toBeLessThan(40);
    });

    it('should not let remote + seniority alone produce a good-looking recommendation without technology match', () => {
      const vacancy = createTestVacancy({
        title: 'Director of Something Unrelated',
        technologies: [],
        remote: 'remote',
        experienceLevel: ExperienceLevel.SENIOR,
      });

      const result = calculateRankingScore({ vacancy, searchProfile: frontendProfile });

      expect(result.tier).not.toBe('WARM');
      expect(result.tier).not.toBe('HOT');
      expect(result.score).toBeLessThan(45);
    });
  });
});
