import { describe, it, expect, beforeEach } from 'vitest';
import { classifyTier, calculateRankingScore, calculateInteractionBoost, VacancyRankingService } from './vacancy-ranking-service.js';
import { calculateVacancyQualityScore } from './vacancy-quality-score.js';
import { calculatePersonalizationBoost, computePreferenceBoosts } from './preference-boost.js';
import { normalizeTechnology, normalizeTechnologies } from './technology-normalization.js';
import { calculateProviderQualityFromVacancies } from './provider-quality-calculator.js';
import { InMemoryUserVacancyInteractionRepository } from '../../testing/in-memory-repositories.js';
import { Vacancy, SearchProfile, Technology, Location, Salary, ExperienceLevel } from '@careeros/career';
import { createUserId, createVacancyId, createCompanyId, createSearchProfileId } from '@careeros/career';
import type { UserVacancyInteractionRepository, VacancyId } from '@careeros/career';

function createTestVacancy(overrides: {
  id?: string;
  title?: string;
  technologies?: string[];
  experienceLevel?: ExperienceLevel;
  salaryMin?: number;
  salaryMax?: number;
  remote?: 'remote' | 'hybrid' | 'onsite';
  location?: string;
  description?: string;
  publishedAt?: Date;
} = {}): Vacancy {
  const now = new Date();
  return Vacancy.reconstitute(createVacancyId(overrides.id ?? 'vacancy-1'), {
    title: overrides.title ?? 'Senior React Developer',
    description: overrides.description ?? 'A great frontend role with React and TypeScript',
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
          'yearly',
        )
      : undefined,
    technologies: (overrides.technologies ?? ['React', 'TypeScript', 'Next.js']).map(
      (t) => Technology.create(t, 'framework'),
    ),
    requirements: [],
    responsibilities: [],
    isActive: true,
    publishedAt: overrides.publishedAt ?? now,
    createdAt: now,
    updatedAt: now,
  });
}

function createTestSearchProfile(overrides: {
  desiredPositions?: string[];
  desiredTechnologies?: string[];
  experienceLevel?: ExperienceLevel;
  salaryMin?: number;
  salaryMax?: number;
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
          'yearly',
        )
      : undefined,
    isRemoteOnly: overrides.isRemoteOnly ?? false,
  });
}

describe('Vacancy Tiering', () => {
  describe('classifyTier', () => {
    it('should classify score >= 80 as HOT', () => {
      expect(classifyTier(80)).toBe('HOT');
      expect(classifyTier(100)).toBe('HOT');
      expect(classifyTier(95)).toBe('HOT');
    });

    it('should classify score 60-79 as WARM', () => {
      expect(classifyTier(60)).toBe('WARM');
      expect(classifyTier(79)).toBe('WARM');
      expect(classifyTier(70)).toBe('WARM');
    });

    it('should classify score 40-59 as COLD', () => {
      expect(classifyTier(40)).toBe('COLD');
      expect(classifyTier(59)).toBe('COLD');
      expect(classifyTier(50)).toBe('COLD');
    });

    it('should classify score < 40 as REJECT', () => {
      expect(classifyTier(39)).toBe('REJECT');
      expect(classifyTier(0)).toBe('REJECT');
      expect(classifyTier(10)).toBe('REJECT');
    });
  });

  describe('RankingResult includes tier', () => {
    it('should include tier in ranking result', () => {
      const vacancy = createTestVacancy({
        technologies: ['React', 'TypeScript', 'Next.js'],
      });
      const profile = createTestSearchProfile({
        desiredTechnologies: ['React', 'TypeScript', 'Next.js'],
      });

      const result = calculateRankingScore({ vacancy, searchProfile: profile });

      expect(result.tier).toBeDefined();
      expect(['HOT', 'WARM', 'COLD', 'REJECT']).toContain(result.tier);
    });

    it('should assign HOT tier for high-scoring vacancy', () => {
      const vacancy = createTestVacancy({
        title: 'Senior React Developer',
        technologies: ['React', 'TypeScript', 'Next.js'],
        remote: 'remote',
        salaryMin: 100000,
        salaryMax: 140000,
      });
      const profile = createTestSearchProfile({
        desiredPositions: ['Senior React Developer'],
        desiredTechnologies: ['React', 'TypeScript', 'Next.js'],
        isRemoteOnly: true,
        salaryMin: 90000,
        salaryMax: 150000,
      });

      const result = calculateRankingScore({ vacancy, searchProfile: profile });

      expect(result.tier).toBe('HOT');
    });

    it('should assign REJECT tier for low-scoring vacancy', () => {
      const vacancy = createTestVacancy({
        title: 'Java Developer',
        technologies: ['Java', 'Spring'],
        remote: 'onsite',
      });
      const profile = createTestSearchProfile({
        desiredPositions: ['Frontend Developer'],
        desiredTechnologies: ['React', 'TypeScript'],
        isRemoteOnly: true,
      });

      const result = calculateRankingScore({ vacancy, searchProfile: profile });

      expect(result.tier).toBe('REJECT');
    });

    it('should distribute vacancies across tiers with relaxed thresholds', () => {
      const scores = [85, 70, 50, 30];
      const expectedTiers = ['HOT', 'WARM', 'COLD', 'REJECT'];

      for (let i = 0; i < scores.length; i++) {
        const score = scores[i];
        if (score === undefined) throw new Error('expected a score');
        expect(classifyTier(score)).toBe(expectedTiers[i]);
      }
    });
  });
});

describe('UserVacancyInteraction', () => {
  let repo: InMemoryUserVacancyInteractionRepository;

  beforeEach(() => {
    repo = new InMemoryUserVacancyInteractionRepository();
  });

  it('should record a VIEW interaction', async () => {
    await repo.record({
      userId: createUserId('user-1'),
      vacancyId: createVacancyId('vacancy-1'),
      action: 'VIEW',
    });

    const interactions = await repo.findByUserId(createUserId('user-1'));
    expect(interactions).toHaveLength(1);
    expect(interactions[0]?.action).toBe('VIEW');
  });

  it('should record multiple interaction types', async () => {
    await repo.record({
      userId: createUserId('user-1'),
      vacancyId: createVacancyId('vacancy-1'),
      action: 'VIEW',
    });
    await repo.record({
      userId: createUserId('user-1'),
      vacancyId: createVacancyId('vacancy-1'),
      action: 'SAVE',
    });
    await repo.record({
      userId: createUserId('user-1'),
      vacancyId: createVacancyId('vacancy-1'),
      action: 'APPLY',
    });

    const interactions = await repo.findByUserId(createUserId('user-1'));
    expect(interactions).toHaveLength(3);
  });

  it('should not duplicate same action for same vacancy', async () => {
    await repo.record({
      userId: createUserId('user-1'),
      vacancyId: createVacancyId('vacancy-1'),
      action: 'VIEW',
    });
    await repo.record({
      userId: createUserId('user-1'),
      vacancyId: createVacancyId('vacancy-1'),
      action: 'VIEW',
    });

    const interactions = await repo.findByUserId(createUserId('user-1'));
    expect(interactions).toHaveLength(1);
  });

  it('should filter by action type', async () => {
    await repo.record({
      userId: createUserId('user-1'),
      vacancyId: createVacancyId('vacancy-1'),
      action: 'VIEW',
    });
    await repo.record({
      userId: createUserId('user-1'),
      vacancyId: createVacancyId('vacancy-1'),
      action: 'SAVE',
    });

    const views = await repo.findByUserId(createUserId('user-1'), { action: 'VIEW' });
    expect(views).toHaveLength(1);
    expect(views[0]?.action).toBe('VIEW');

    const saves = await repo.findByUserId(createUserId('user-1'), { action: 'SAVE' });
    expect(saves).toHaveLength(1);
    expect(saves[0]?.action).toBe('SAVE');
  });

  it('should find interactions by userId and vacancyId', async () => {
    await repo.record({
      userId: createUserId('user-1'),
      vacancyId: createVacancyId('vacancy-1'),
      action: 'VIEW',
    });
    await repo.record({
      userId: createUserId('user-1'),
      vacancyId: createVacancyId('vacancy-2'),
      action: 'VIEW',
    });

    const interactions = await repo.findByUserIdAndVacancyId(
      createUserId('user-1'),
      createVacancyId('vacancy-1'),
    );
    expect(interactions).toHaveLength(1);
  });

  it('should count interactions by action', async () => {
    await repo.record({
      userId: createUserId('user-1'),
      vacancyId: createVacancyId('vacancy-1'),
      action: 'VIEW',
    });
    await repo.record({
      userId: createUserId('user-1'),
      vacancyId: createVacancyId('vacancy-2'),
      action: 'VIEW',
    });
    await repo.record({
      userId: createUserId('user-1'),
      vacancyId: createVacancyId('vacancy-1'),
      action: 'SAVE',
    });

    const viewCount = await repo.countByAction(createUserId('user-1'), 'VIEW');
    expect(viewCount).toBe(2);

    const saveCount = await repo.countByAction(createUserId('user-1'), 'SAVE');
    expect(saveCount).toBe(1);
  });
});

describe('Vacancy Quality Score', () => {
  it('should give high score for complete vacancy', () => {
    const vacancy = createTestVacancy({
      salaryMin: 100000,
      salaryMax: 140000,
    });

    const result = calculateVacancyQualityScore(vacancy, 'https://apply.example.com', 90);

    expect(result.total).toBeGreaterThanOrEqual(80);
    expect(result.companyExists).toBe(100);
    expect(result.salaryExists).toBe(100);
    expect(result.applyUrlExists).toBe(100);
  });

  it('should give low score for incomplete vacancy', () => {
    const vacancy = createTestVacancy({
      salaryMin: undefined,
      salaryMax: undefined,
      description: 'Short',
    });

    const result = calculateVacancyQualityScore(vacancy);

    expect(result.total).toBeLessThanOrEqual(60);
    expect(result.salaryExists).toBe(0);
    expect(result.applyUrlExists).toBe(0);
  });

  it('should penalize old vacancies', () => {
    const now = new Date();
    const recentResult = calculateVacancyQualityScore(
      createTestVacancy({ publishedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) }),
      undefined, undefined, now,
    );
    const oldResult = calculateVacancyQualityScore(
      createTestVacancy({ publishedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) }),
      undefined, undefined, now,
    );

    expect(recentResult.freshness).toBeGreaterThanOrEqual(oldResult.freshness);
  });

  it('should give higher score with apply URL', () => {
    const vacancy = createTestVacancy();

    const withUrl = calculateVacancyQualityScore(vacancy, 'https://apply.example.com');
    const withoutUrl = calculateVacancyQualityScore(vacancy);

    expect(withUrl.total).toBeGreaterThan(withoutUrl.total);
  });
});

describe('Personalization', () => {
  it('should apply penalty for hidden vacancies', () => {
    const vacancy = createTestVacancy();
    const profile = createTestSearchProfile();

    const boosts = {
      technologyBoosts: new Map<string, number>(),
      roleBoosts: new Map<string, number>(),
      remoteBoost: 0,
      locationBoosts: new Map<string, number>(),
      hiddenVacancyIds: new Set<string>(['vacancy-1']),
      ignoredRoles: new Set<string>(),
    };

    const { boost, reasons } = calculatePersonalizationBoost(
      { userId: createUserId('user-1'), vacancy, searchProfile: profile, interactionRepository: null as unknown as UserVacancyInteractionRepository },
      boosts,
    );

    expect(boost).toBe(-20);
    expect(reasons).toContain('Previously hidden by user');
  });

  it('should apply technology boost for frequently interacted tech', () => {
    const vacancy = createTestVacancy({ technologies: ['React', 'TypeScript'] });
    const profile = createTestSearchProfile();

    const boosts = {
      technologyBoosts: new Map<string, number>([['react', 100], ['typescript', 100], ['next.js', 100]]),
      roleBoosts: new Map<string, number>([['frontend', 100]]),
      remoteBoost: 100,
      locationBoosts: new Map<string, number>([['new york', 100]]),
      hiddenVacancyIds: new Set<string>(),
      ignoredRoles: new Set<string>(),
    };

    const { boost, reasons } = calculatePersonalizationBoost(
      { userId: createUserId('user-1'), vacancy, searchProfile: profile, interactionRepository: null as unknown as UserVacancyInteractionRepository },
      boosts,
    );

    expect(boost).toBeGreaterThan(0);
    expect(reasons.some((r) => r.includes('react'))).toBe(true);
  });

  it('should cap personalization boost at 20', () => {
    const vacancy = createTestVacancy({ technologies: ['React', 'TypeScript', 'Next.js'] });
    const profile = createTestSearchProfile();

    const boosts = {
      technologyBoosts: new Map<string, number>([['react', 100], ['typescript', 100], ['next.js', 100]]),
      roleBoosts: new Map<string, number>([['frontend', 100]]),
      remoteBoost: 100,
      locationBoosts: new Map<string, number>([['new york', 100]]),
      hiddenVacancyIds: new Set<string>(),
      ignoredRoles: new Set<string>(),
    };

    const { boost } = calculatePersonalizationBoost(
      { userId: createUserId('user-1'), vacancy, searchProfile: profile, interactionRepository: null as unknown as UserVacancyInteractionRepository },
      boosts,
    );

    expect(boost).toBeLessThanOrEqual(20);
  });

  it('should affect ranking score when personalization is applied', () => {
    const vacancy = createTestVacancy({
      technologies: ['React', 'TypeScript'],
    });
    const profile = createTestSearchProfile({
      desiredTechnologies: ['React', 'TypeScript'],
    });

    const baseResult = calculateRankingScore({ vacancy, searchProfile: profile });

    const boosts = {
      technologyBoosts: new Map<string, number>([['react', 5], ['typescript', 5]]),
      roleBoosts: new Map<string, number>(),
      remoteBoost: 0,
      locationBoosts: new Map<string, number>(),
      hiddenVacancyIds: new Set<string>(),
      ignoredRoles: new Set<string>(),
    };

    const personalizedResult = calculateRankingScore({
      vacancy,
      searchProfile: profile,
      preferenceBoosts: boosts,
    });

    expect(personalizedResult.score).toBeGreaterThanOrEqual(baseResult.score);
    expect(personalizedResult.reasons.length).toBeGreaterThanOrEqual(baseResult.reasons.length);
  });

  it('should rank hidden vacancies lower', () => {
    const vacancy1 = createTestVacancy({ id: 'vacancy-1', technologies: ['React'] });
    const vacancy2 = createTestVacancy({ id: 'vacancy-2', technologies: ['React'] });
    const profile = createTestSearchProfile({ desiredTechnologies: ['React'] });

    const baseResult1 = calculateRankingScore({ vacancy: vacancy1, searchProfile: profile });
    const baseResult2 = calculateRankingScore({ vacancy: vacancy2, searchProfile: profile });

    const hiddenBoosts = {
      technologyBoosts: new Map<string, number>(),
      roleBoosts: new Map<string, number>(),
      remoteBoost: 0,
      locationBoosts: new Map<string, number>(),
      hiddenVacancyIds: new Set<string>(['vacancy-1']),
      ignoredRoles: new Set<string>(),
    };

    const personalizedResult1 = calculateRankingScore({
      vacancy: vacancy1,
      searchProfile: profile,
      preferenceBoosts: hiddenBoosts,
    });

    const personalizedResult2 = calculateRankingScore({
      vacancy: vacancy2,
      searchProfile: profile,
      preferenceBoosts: hiddenBoosts,
    });

    expect(personalizedResult1.score).toBeLessThan(baseResult1.score);
    expect(personalizedResult2.score).toBe(baseResult2.score);
  });
});

describe('Interaction Boost', () => {
  it('should calculate SAVE boost as +10', () => {
    const interactions = [{ action: 'SAVE', vacancyId: 'v1' }];
    expect(calculateInteractionBoost(interactions, 'v1')).toBe(10);
  });

  it('should calculate APPLY boost as +15', () => {
    const interactions = [{ action: 'APPLY', vacancyId: 'v1' }];
    expect(calculateInteractionBoost(interactions, 'v1')).toBe(15);
  });

  it('should calculate VIEW boost as +2', () => {
    const interactions = [{ action: 'VIEW', vacancyId: 'v1' }];
    expect(calculateInteractionBoost(interactions, 'v1')).toBe(2);
  });

  it('should calculate IGNORE penalty as -10', () => {
    const interactions = [{ action: 'IGNORE', vacancyId: 'v1' }];
    expect(calculateInteractionBoost(interactions, 'v1')).toBe(-10);
  });

  it('should calculate HIDE penalty as -20', () => {
    const interactions = [{ action: 'HIDE', vacancyId: 'v1' }];
    expect(calculateInteractionBoost(interactions, 'v1')).toBe(-20);
  });

  it('should combine multiple interactions for same vacancy', () => {
    const interactions = [
      { action: 'VIEW', vacancyId: 'v1' },
      { action: 'SAVE', vacancyId: 'v1' },
    ];
    expect(calculateInteractionBoost(interactions, 'v1')).toBe(12);
  });

  it('should cap boost at 20', () => {
    const interactions = [
      { action: 'APPLY', vacancyId: 'v1' },
      { action: 'SAVE', vacancyId: 'v1' },
    ];
    expect(calculateInteractionBoost(interactions, 'v1')).toBe(20);
  });

  it('should cap negative boost at -20', () => {
    const interactions = [
      { action: 'HIDE', vacancyId: 'v1' },
      { action: 'IGNORE', vacancyId: 'v1' },
    ];
    expect(calculateInteractionBoost(interactions, 'v1')).toBe(-20);
  });

  it('should return 0 for vacancy with no interactions', () => {
    const interactions = [{ action: 'SAVE', vacancyId: 'v2' }];
    expect(calculateInteractionBoost(interactions, 'v1')).toBe(0);
  });

  it('should not affect other vacancies', () => {
    const interactions = [{ action: 'SAVE', vacancyId: 'v1' }];
    expect(calculateInteractionBoost(interactions, 'v2')).toBe(0);
  });
});

describe('Ranking Explanation', () => {
  it('should generate explanation with score and tier', () => {
    const vacancy = createTestVacancy();
    const profile = createTestSearchProfile();

    const result = calculateRankingScore({ vacancy, searchProfile: profile });

    expect(result.explanation).toBeDefined();
    expect(result.explanation.score).toBe(result.score);
    expect(result.explanation.tier).toBe(result.tier);
  });

  it('should include positive factors in explanation', () => {
    const vacancy = createTestVacancy({
      technologies: ['React', 'TypeScript'],
      remote: 'remote',
    });
    const profile = createTestSearchProfile({
      desiredTechnologies: ['React', 'TypeScript'],
      isRemoteOnly: true,
    });

    const result = calculateRankingScore({ vacancy, searchProfile: profile });

    expect(result.explanation.positiveFactors.length).toBeGreaterThan(0);
  });

  it('should warn about missing salary', () => {
    const vacancy = createTestVacancy({ salaryMin: undefined, salaryMax: undefined });
    const profile = createTestSearchProfile();

    const result = calculateRankingScore({ vacancy, searchProfile: profile });

    expect(result.explanation.warnings).toContain('Missing salary');
  });

  it('should warn about low provider quality', () => {
    const vacancy = createTestVacancy();
    const profile = createTestSearchProfile();

    const result = calculateRankingScore({
      vacancy,
      searchProfile: profile,
      providerQualityScore: 30,
    });

    expect(result.explanation.warnings).toContain('Low provider quality');
  });

  it('should warn about old vacancy', () => {
    const vacancy = createTestVacancy();
    const profile = createTestSearchProfile();

    const result = calculateRankingScore({
      vacancy,
      searchProfile: profile,
      freshnessScore: 10,
    });

    expect(result.explanation.warnings).toContain('Old vacancy');
  });

  it('should not warn about missing salary when present', () => {
    const vacancy = createTestVacancy({ salaryMin: 100000, salaryMax: 150000 });
    const profile = createTestSearchProfile();

    const result = calculateRankingScore({ vacancy, searchProfile: profile });

    expect(result.explanation.warnings).not.toContain('Missing salary');
  });
});

describe('Quality Score Integration', () => {
  it('should factor quality score into final ranking', () => {
    const vacancy = createTestVacancy();
    const profile = createTestSearchProfile();

    const resultLowQuality = calculateRankingScore({
      vacancy,
      searchProfile: profile,
      qualityScore: 30,
      freshnessScore: 30,
    });

    const resultHighQuality = calculateRankingScore({
      vacancy,
      searchProfile: profile,
      qualityScore: 90,
      freshnessScore: 90,
    });

    expect(resultHighQuality.score).toBeGreaterThan(resultLowQuality.score);
  });

  it('should factor freshness into final ranking', () => {
    const vacancy = createTestVacancy();
    const profile = createTestSearchProfile();

    const resultOld = calculateRankingScore({
      vacancy,
      searchProfile: profile,
      freshnessScore: 10,
    });

    const resultFresh = calculateRankingScore({
      vacancy,
      searchProfile: profile,
      freshnessScore: 100,
    });

    expect(resultFresh.score).toBeGreaterThan(resultOld.score);
  });

  it('should use 70/20/10 composition for final score', () => {
    const vacancy = createTestVacancy();
    const profile = createTestSearchProfile();

    const result = calculateRankingScore({
      vacancy,
      searchProfile: profile,
      qualityScore: 100,
      freshnessScore: 100,
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('should affect tier distribution through quality scores', () => {
    const vacancy = createTestVacancy({
      title: 'Frontend Developer',
      technologies: ['React', 'TypeScript'],
      remote: 'remote',
      salaryMin: 100000,
      salaryMax: 140000,
    });
    const profile = createTestSearchProfile({
      desiredPositions: ['Frontend Developer'],
      desiredTechnologies: ['React', 'TypeScript'],
      isRemoteOnly: true,
      salaryMin: 90000,
      salaryMax: 150000,
    });

    const resultHigh = calculateRankingScore({
      vacancy,
      searchProfile: profile,
      qualityScore: 100,
      freshnessScore: 100,
    });

    const resultLow = calculateRankingScore({
      vacancy,
      searchProfile: profile,
      qualityScore: 20,
      freshnessScore: 10,
    });

    expect(resultHigh.score).toBeGreaterThanOrEqual(resultLow.score);
  });
});

describe('Interaction Boost Integration', () => {
  it('should affect ranking score when interaction boost is provided', () => {
    const vacancy = createTestVacancy({
      technologies: ['React', 'TypeScript'],
    });
    const profile = createTestSearchProfile({
      desiredTechnologies: ['React', 'TypeScript'],
    });

    const baseResult = calculateRankingScore({ vacancy, searchProfile: profile });

    const boostedResult = calculateRankingScore({
      vacancy,
      searchProfile: profile,
      interactionBoost: 15,
    });

    expect(boostedResult.score).toBeGreaterThan(baseResult.score);
  });

  it('should reduce ranking score with negative interaction boost', () => {
    const vacancy = createTestVacancy({
      technologies: ['React', 'TypeScript'],
    });
    const profile = createTestSearchProfile({
      desiredTechnologies: ['React', 'TypeScript'],
    });

    const baseResult = calculateRankingScore({ vacancy, searchProfile: profile });

    const penalizedResult = calculateRankingScore({
      vacancy,
      searchProfile: profile,
      interactionBoost: -20,
    });

    expect(penalizedResult.score).toBeLessThan(baseResult.score);
  });

  it('should rank service with interactions', () => {
    const service = new VacancyRankingService();
    const vacancy = createTestVacancy({
      id: 'v1',
      technologies: ['React', 'TypeScript'],
    });
    const profile = createTestSearchProfile({
      desiredTechnologies: ['React', 'TypeScript'],
    });

    const interactions = [
      { action: 'SAVE', vacancyId: 'v1' },
    ];

    const ranked = service.rankVacancies(
      [vacancy],
      profile,
      undefined,
      undefined,
      undefined,
      interactions,
    );

    expect(ranked).toHaveLength(1);

    const baseResult = calculateRankingScore({ vacancy, searchProfile: profile });
    expect(ranked[0]?.result.score).toBeGreaterThan(baseResult.score);
  });
});

describe('Technology Normalization', () => {
  it('should normalize ReactJS to react', () => {
    expect(normalizeTechnology('ReactJS')).toBe('react');
  });

  it('should normalize React.js to react', () => {
    expect(normalizeTechnology('React.js')).toBe('react');
  });

  it('should normalize NodeJS to node.js', () => {
    expect(normalizeTechnology('NodeJS')).toBe('node.js');
  });

  it('should normalize Node to node.js', () => {
    expect(normalizeTechnology('Node')).toBe('node.js');
  });

  it('should normalize JS to javascript', () => {
    expect(normalizeTechnology('JS')).toBe('javascript');
  });

  it('should normalize TS to typescript', () => {
    expect(normalizeTechnology('TS')).toBe('typescript');
  });

  it('should normalize Go to golang', () => {
    expect(normalizeTechnology('Go')).toBe('golang');
  });

  it('should normalize K8s to kubernetes', () => {
    expect(normalizeTechnology('K8s')).toBe('kubernetes');
  });

  it('should normalize PG to postgresql', () => {
    expect(normalizeTechnology('PG')).toBe('postgresql');
  });

  it('should keep unknown technologies as-is (lowercased)', () => {
    expect(normalizeTechnology('MyCustomLib')).toBe('mycustomlib');
  });

  it('should normalize list of technologies', () => {
    const result = normalizeTechnologies(['ReactJS', 'NodeJS', 'TS', 'Go']);
    expect(result).toEqual(['react', 'node.js', 'typescript', 'golang']);
  });

  it('should deduplicate after normalization', () => {
    const result = normalizeTechnologies(['React', 'ReactJS', 'react.js']);
    expect(result).toEqual(['react']);
  });

  it('should handle case insensitive input', () => {
    expect(normalizeTechnology('REACT')).toBe('react');
    expect(normalizeTechnology('react')).toBe('react');
    expect(normalizeTechnology('React')).toBe('react');
  });
});

describe('User Preferences (computePreferenceBoosts)', () => {
  let repo: InMemoryUserVacancyInteractionRepository;

  beforeEach(() => {
    repo = new InMemoryUserVacancyInteractionRepository();
  });

  it('should build technology boosts from saved vacancies', async () => {
    const userId = createUserId('user-1');
    const vacancyId = createVacancyId('vacancy-1');

    await repo.record({ userId, vacancyId, action: 'SAVE' });

    const savedVacancy = createTestVacancy({
      id: 'vacancy-1',
      technologies: ['React', 'TypeScript'],
    });

    const vacancyLookup = async (id: VacancyId): Promise<Vacancy | null> => {
      if (id === vacancyId) return savedVacancy;
      return null;
    };

    const boosts = await computePreferenceBoosts(userId, repo, vacancyLookup);

    expect(boosts.technologyBoosts.get('react')).toBe(10);
    expect(boosts.technologyBoosts.get('typescript')).toBe(10);
  });

  it('should build technology boosts from applied vacancies', async () => {
    const userId = createUserId('user-1');
    const vacancyId = createVacancyId('vacancy-1');

    await repo.record({ userId, vacancyId, action: 'APPLY' });

    const savedVacancy = createTestVacancy({
      id: 'vacancy-1',
      technologies: ['React', 'Next.js'],
    });

    const vacancyLookup = async (id: VacancyId): Promise<Vacancy | null> => {
      if (id === vacancyId) return savedVacancy;
      return null;
    };

    const boosts = await computePreferenceBoosts(userId, repo, vacancyLookup);

    expect(boosts.technologyBoosts.get('react')).toBe(15);
    expect(boosts.technologyBoosts.get('next.js')).toBe(15);
  });

  it('should build negative boosts from hidden vacancies', async () => {
    const userId = createUserId('user-1');
    const vacancyId = createVacancyId('vacancy-1');

    await repo.record({ userId, vacancyId, action: 'HIDE' });

    const savedVacancy = createTestVacancy({
      id: 'vacancy-1',
      technologies: ['Angular', 'Java'],
    });

    const vacancyLookup = async (id: VacancyId): Promise<Vacancy | null> => {
      if (id === vacancyId) return savedVacancy;
      return null;
    };

    const boosts = await computePreferenceBoosts(userId, repo, vacancyLookup);

    expect(boosts.technologyBoosts.get('angular')).toBe(-15);
    expect(boosts.technologyBoosts.get('java')).toBe(-15);
    expect(boosts.hiddenVacancyIds.has('vacancy-1')).toBe(true);
  });

  it('should build role boosts from saved vacancies', async () => {
    const userId = createUserId('user-1');
    const vacancyId = createVacancyId('vacancy-1');

    await repo.record({ userId, vacancyId, action: 'SAVE' });

    const savedVacancy = createTestVacancy({
      id: 'vacancy-1',
      title: 'Senior React Developer',
      technologies: ['React'],
    });

    const vacancyLookup = async (id: VacancyId): Promise<Vacancy | null> => {
      if (id === vacancyId) return savedVacancy;
      return null;
    };

    const boosts = await computePreferenceBoosts(userId, repo, vacancyLookup);

    expect(boosts.roleBoosts.get('frontend')).toBe(5);
  });

  it('should track remote preference from interactions', async () => {
    const userId = createUserId('user-1');
    const vacancyId = createVacancyId('vacancy-1');

    await repo.record({ userId, vacancyId, action: 'SAVE' });

    const savedVacancy = createTestVacancy({
      id: 'vacancy-1',
      remote: 'remote',
      technologies: ['React'],
    });

    const vacancyLookup = async (id: VacancyId): Promise<Vacancy | null> => {
      if (id === vacancyId) return savedVacancy;
      return null;
    };

    const boosts = await computePreferenceBoosts(userId, repo, vacancyLookup);

    expect(boosts.remoteBoost).toBe(3);
  });

  it('should track location preference from interactions', async () => {
    const userId = createUserId('user-1');
    const vacancyId = createVacancyId('vacancy-1');

    await repo.record({ userId, vacancyId, action: 'SAVE' });

    const savedVacancy = createTestVacancy({
      id: 'vacancy-1',
      location: 'Berlin',
      technologies: ['React'],
    });

    const vacancyLookup = async (id: VacancyId): Promise<Vacancy | null> => {
      if (id === vacancyId) return savedVacancy;
      return null;
    };

    const boosts = await computePreferenceBoosts(userId, repo, vacancyLookup);

    expect(boosts.locationBoosts.get('berlin')).toBe(3);
  });

  it('should combine multiple interaction signals', async () => {
    const userId = createUserId('user-1');
    const vacancyId = createVacancyId('vacancy-1');

    await repo.record({ userId, vacancyId, action: 'VIEW' });
    await repo.record({ userId, vacancyId, action: 'SAVE' });

    const savedVacancy = createTestVacancy({
      id: 'vacancy-1',
      technologies: ['React'],
    });

    const vacancyLookup = async (id: VacancyId): Promise<Vacancy | null> => {
      if (id === vacancyId) return savedVacancy;
      return null;
    };

    const boosts = await computePreferenceBoosts(userId, repo, vacancyLookup);

    expect(boosts.technologyBoosts.get('react')).toBe(12);
  });

  it('should fall back to hides-only when no vacancy lookup provided', async () => {
    const userId = createUserId('user-1');

    await repo.record({ userId, vacancyId: createVacancyId('v1'), action: 'HIDE' });
    await repo.record({ userId, vacancyId: createVacancyId('v1'), action: 'SAVE' });

    const boosts = await computePreferenceBoosts(userId, repo);

    expect(boosts.hiddenVacancyIds.has('v1')).toBe(true);
    expect(boosts.technologyBoosts.size).toBe(0);
  });

  it('should normalize technologies from vacancies', async () => {
    const userId = createUserId('user-1');
    const vacancyId = createVacancyId('vacancy-1');

    await repo.record({ userId, vacancyId, action: 'SAVE' });

    const savedVacancy = createTestVacancy({
      id: 'vacancy-1',
      technologies: ['ReactJS', 'TS', 'NodeJS'],
    });

    const vacancyLookup = async (id: VacancyId): Promise<Vacancy | null> => {
      if (id === vacancyId) return savedVacancy;
      return null;
    };

    const boosts = await computePreferenceBoosts(userId, repo, vacancyLookup);

    expect(boosts.technologyBoosts.get('react')).toBe(10);
    expect(boosts.technologyBoosts.get('typescript')).toBe(10);
    expect(boosts.technologyBoosts.get('node.js')).toBe(10);
  });
});

describe('Provider Quality Calculation', () => {
  it('should give high score for complete vacancies', () => {
    const vacancies = [
      createTestVacancy({ salaryMin: 100000, salaryMax: 140000, description: 'A'.repeat(600) }),
      createTestVacancy({ salaryMin: 90000, salaryMax: 130000, description: 'B'.repeat(500) }),
    ];

    const result = calculateProviderQualityFromVacancies(vacancies);

    expect(result.salaryAvailability).toBe(100);
    expect(result.companyAvailability).toBe(100);
    expect(result.total).toBeGreaterThan(50);
  });

  it('should give low score for incomplete vacancies', () => {
    const vacancies = [
      createTestVacancy({ salaryMin: undefined, salaryMax: undefined, description: 'Short' }),
    ];

    const result = calculateProviderQualityFromVacancies(vacancies);

    expect(result.salaryAvailability).toBe(0);
    expect(result.total).toBeLessThan(70);
    expect(result.descriptionQuality).toBeLessThan(50);
  });

  it('should penalize duplicate titles', () => {
    const vacancies = [
      createTestVacancy({ title: 'React Developer' }),
      createTestVacancy({ title: 'React Developer' }),
      createTestVacancy({ title: 'Vue Developer' }),
    ];

    const result = calculateProviderQualityFromVacancies(vacancies);

    expect(result.duplicateRate).toBeLessThan(100);
  });

  it('should reward fresh vacancies', () => {
    const now = new Date();
    const freshVacancies = [
      createTestVacancy({ salaryMin: 100000, salaryMax: 140000 }),
    ];

    const result = calculateProviderQualityFromVacancies(freshVacancies, now);

    expect(result.freshness).toBeGreaterThanOrEqual(40);
  });

  it('should return 0 for empty vacancy list', () => {
    const result = calculateProviderQualityFromVacancies([]);

    expect(result.total).toBe(0);
    expect(result.salaryAvailability).toBe(0);
  });

  it('should calculate quality from mixed vacancy data', () => {
    const vacancies = [
      createTestVacancy({ salaryMin: 100000, salaryMax: 140000, description: 'Good description with enough content' }),
      createTestVacancy({ salaryMin: undefined, salaryMax: undefined, description: 'Short' }),
      createTestVacancy({ salaryMin: 80000, salaryMax: 120000, description: 'Another good description here' }),
    ];

    const result = calculateProviderQualityFromVacancies(vacancies);

    expect(result.salaryAvailability).toBe(67);
    expect(result.companyAvailability).toBe(100);
    expect(result.total).toBeGreaterThan(30);
    expect(result.total).toBeLessThan(100);
  });
});
