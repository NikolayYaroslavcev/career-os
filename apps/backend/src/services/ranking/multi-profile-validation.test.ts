import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@careeros/database';
import {
  Vacancy,
  SearchProfile,
  ExperienceLevel,
  Location,
  Salary,
  Technology,
  createVacancyId,
  createCompanyId,
  createSearchProfileId,
  createUserId,
} from '@careeros/career';
import { calculateRankingScore } from './vacancy-ranking-service.js';
import type { RankingResult } from './vacancy-ranking-service.js';

// ============================================================
// 5 TEST PROFILES
// ============================================================
interface ProfileDefinition {
  name: string;
  desiredPositions: string[];
  desiredTechnologies: string[];
  experienceLevel: ExperienceLevel;
  salaryMin: number;
  salaryMax: number;
  salaryPeriod: 'monthly' | 'yearly';
  isRemoteOnly: boolean;
  relevantCategories: string[];
  irrelevantCategories: string[];
}

const PROFILES: ProfileDefinition[] = [
  {
    name: 'Senior Frontend Developer',
    desiredPositions: ['Frontend Developer', 'React Developer', 'Frontend Engineer', 'UI Developer'],
    desiredTechnologies: ['React', 'TypeScript', 'Next.js', 'JavaScript', 'Redux', 'CSS', 'HTML'],
    experienceLevel: ExperienceLevel.SENIOR,
    salaryMin: 90000,
    salaryMax: 150000,
    salaryPeriod: 'yearly',
    isRemoteOnly: true,
    relevantCategories: ['Frontend', 'Fullstack'],
    irrelevantCategories: ['Backend', 'QA', 'DevOps', 'Data/ML', 'Mobile', 'Design', 'Product', 'Security'],
  },
  {
    name: 'Backend Engineer',
    desiredPositions: ['Backend Developer', 'Java Developer', 'Backend Engineer', 'API Developer'],
    desiredTechnologies: ['Java', 'Spring', 'Kafka', 'PostgreSQL', 'Redis', 'REST API'],
    experienceLevel: ExperienceLevel.MIDDLE,
    salaryMin: 80000,
    salaryMax: 130000,
    salaryPeriod: 'yearly',
    isRemoteOnly: false,
    relevantCategories: ['Backend', 'Fullstack'],
    irrelevantCategories: ['Frontend', 'QA', 'DevOps', 'Data/ML', 'Mobile', 'Design', 'Product', 'Security'],
  },
  {
    name: 'QA Engineer',
    desiredPositions: ['QA Engineer', 'Quality Assurance', 'Test Engineer', 'SDET'],
    desiredTechnologies: ['Selenium', 'Playwright', 'Jest', 'Cypress', 'TypeScript'],
    experienceLevel: ExperienceLevel.MIDDLE,
    salaryMin: 70000,
    salaryMax: 110000,
    salaryPeriod: 'yearly',
    isRemoteOnly: false,
    relevantCategories: ['QA', 'Frontend'],
    irrelevantCategories: ['Backend', 'DevOps', 'Data/ML', 'Mobile', 'Design', 'Product', 'Security'],
  },
  {
    name: 'DevOps Engineer',
    desiredPositions: ['DevOps Engineer', 'SRE', 'Platform Engineer', 'Infrastructure Engineer'],
    desiredTechnologies: ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'Python', 'Linux'],
    experienceLevel: ExperienceLevel.SENIOR,
    salaryMin: 100000,
    salaryMax: 160000,
    salaryPeriod: 'yearly',
    isRemoteOnly: false,
    relevantCategories: ['DevOps', 'Backend'],
    irrelevantCategories: ['Frontend', 'QA', 'Data/ML', 'Mobile', 'Design', 'Product', 'Security'],
  },
  {
    name: 'Data Engineer',
    desiredPositions: ['Data Engineer', 'ML Engineer', 'Data Scientist', 'Analytics Engineer'],
    desiredTechnologies: ['Python', 'SQL', 'Spark', 'Airflow', 'PostgreSQL', 'Docker'],
    experienceLevel: ExperienceLevel.MIDDLE,
    salaryMin: 85000,
    salaryMax: 140000,
    salaryPeriod: 'yearly',
    isRemoteOnly: false,
    relevantCategories: ['Data/ML', 'Backend'],
    irrelevantCategories: ['Frontend', 'QA', 'DevOps', 'Mobile', 'Design', 'Product', 'Security'],
  },
];

// ============================================================
// DATABASE INFRASTRUCTURE
// ============================================================
interface RawVacancy {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  technologies: string[];
  experienceLevel: string | null;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  location: string | null;
  remote: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  companyId: string;
  company: { name: string; id: string } | null;
  sources: { providerType: string; providerId: string; sourceUrl: string | null }[];
  metadata: unknown;
}

interface ProviderQualityMap {
  byProviderId: Map<string, number>;
  byProviderType: Map<string, number>;
}

function mapExperienceLevel(level: string | null): ExperienceLevel {
  const known = Object.values(ExperienceLevel);
  if (level && known.includes(level as ExperienceLevel)) return level as ExperienceLevel;
  return ExperienceLevel.MIDDLE;
}

function readTechnologies(metadata: unknown): string[] {
  if (metadata && typeof metadata === 'object' && Array.isArray((metadata as Record<string, unknown>).technologies)) {
    return (metadata as Record<string, unknown>).technologies as string[];
  }
  return [];
}

function prismaVacancyToDomain(record: RawVacancy): { vacancy: Vacancy; companyName: string; sources: string[]; providerIds: string[] } {
  const salary = record.salaryMin || record.salaryMax
    ? Salary.create(
        record.salaryMin ?? 0,
        record.salaryMax ?? record.salaryMin ?? 0,
        record.currency as 'USD' | 'EUR' | 'GBP' | 'UAH' | 'RUB',
        'yearly'
      )
    : undefined;

  const techNames = record.technologies.length > 0
    ? record.technologies
    : readTechnologies(record.metadata);

  const vacancy = Vacancy.reconstitute(createVacancyId(record.id), {
    title: record.title,
    description: record.description,
    companyId: createCompanyId(record.companyId),
    location: Location.create({
      city: record.location ?? undefined,
      workMode: record.remote.toLowerCase() as 'remote' | 'hybrid' | 'onsite',
    }),
    salary,
    experienceLevel: mapExperienceLevel(record.experienceLevel),
    employmentType: record.employmentType ?? undefined,
    technologies: techNames.map((name) => Technology.create(name, 'other')),
    requirements: record.requirements,
    responsibilities: [],
    isActive: true,
    publishedAt: record.publishedAt ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });

  const companyName = record.company?.name ?? 'Unknown';
  const sources = record.sources.map(s => s.providerType);
  const providerIds = record.sources.map(s => s.providerId);

  return { vacancy, companyName, sources, providerIds };
}

function categorizeTitle(title: string): string {
  const t = title.toLowerCase();

  if (t.includes('frontend') || t.includes('front-end') || t.includes('front end') || t.includes('react') || t.includes('vue') || t.includes('angular') || t.includes('ui developer') || t.includes('web developer') || t.includes('javascript developer')) {
    return 'Frontend';
  }
  if (t.includes('fullstack') || t.includes('full-stack') || t.includes('full stack')) {
    return 'Fullstack';
  }
  if (t.includes('backend') || t.includes('back-end') || t.includes('back end') || t.includes('node') || t.includes('java developer') || t.includes('python developer') || t.includes('golang') || t.includes('rust developer') || t.includes('php developer') || t.includes('ruby developer')) {
    return 'Backend';
  }
  if (t.includes('devops') || t.includes('sre') || t.includes('platform engineer') || t.includes('infrastructure') || t.includes('cloud engineer')) {
    return 'DevOps';
  }
  if (t.includes('mobile') || t.includes('ios') || t.includes('android') || t.includes('flutter') || t.includes('react native') || t.includes('swift developer') || t.includes('kotlin developer')) {
    return 'Mobile';
  }
  if (t.includes('data') || t.includes('ml ') || t.includes('machine learning') || t.includes(' ai ') || t.includes('analytics') || t.includes('data scientist') || t.includes('data engineer')) {
    return 'Data/ML';
  }
  if (t.includes('qa') || t.includes('quality') || t.includes('test engineer') || t.includes('sdet') || t.includes('automation')) {
    return 'QA';
  }
  if (t.includes('design') || t.includes('ux') || t.includes('ui designer')) {
    return 'Design';
  }
  if (t.includes('product') || t.includes(' pm ') || t.includes('scrum')) {
    return 'Product';
  }
  if (t.includes('security')) {
    return 'Security';
  }

  return 'Other';
}

// ============================================================
// PROFILE EVALUATION
// ============================================================
interface ProfileEvaluation {
  profileName: string;
  rankedVacancies: number;
  top20: Array<{
    rank: number;
    title: string;
    category: string;
    score: number;
    interestScore: number;
    careerFitScore: number;
    matchedSkills: string[];
  }>;
  scoreDistribution: Record<string, number>;
  top20Relevant: number;
  top20Irrelevant: number;
  top20Categories: Record<string, number>;
  falsePositives: Array<{ title: string; category: string; score: number }>;
  falseNegatives: Array<{ title: string; category: string; score: number }>;
  avgCareerFit: number;
  avgInterest: number;
  avgTotal: number;
  careerFitRange: { min: number; max: number };
  interestRange: { min: number; max: number };
}

function evaluateProfile(
  profile: ProfileDefinition,
  rawVacancies: RawVacancy[],
  qualityScores: ProviderQualityMap,
): ProfileEvaluation {
  const searchProfile = SearchProfile.create({
    id: createSearchProfileId(`eval-${profile.name.toLowerCase().replace(/\s+/g, '-')}`),
    userId: createUserId('eval-user'),
    name: profile.name,
    desiredPositions: profile.desiredPositions,
    desiredTechnologies: profile.desiredTechnologies.map(t => Technology.create(t, 'framework')),
    experienceLevel: profile.experienceLevel,
    desiredSalary: Salary.create(profile.salaryMin, profile.salaryMax, 'USD', profile.salaryPeriod),
    desiredLocations: [Location.create({ country: 'USA', workMode: profile.isRemoteOnly ? 'remote' : 'hybrid' })],
    isRemoteOnly: profile.isRemoteOnly,
  });

  const vacancyData = rawVacancies.map(v => prismaVacancyToDomain(v as unknown as RawVacancy));

  const ranked: Array<{
    vacancy: Vacancy;
    companyName: string;
    result: RankingResult;
  }> = [];

  for (const { vacancy, companyName, providerIds } of vacancyData) {
    let providerQualityScore: number | undefined;
    for (const providerId of providerIds) {
      const score = qualityScores.byProviderId.get(providerId);
      if (score !== undefined) {
        providerQualityScore = score;
        break;
      }
    }

    const result = calculateRankingScore({
      vacancy,
      searchProfile,
      providerQualityScore,
    });

    ranked.push({ vacancy, companyName, result });
  }

  ranked.sort((a, b) => b.result.score - a.result.score);

  const top20 = ranked.slice(0, 20);
  let top20Relevant = 0;
  let top20Irrelevant = 0;
  const top20Categories: Record<string, number> = {};

  for (const r of top20) {
    const category = categorizeTitle(r.vacancy.title);
    top20Categories[category] = (top20Categories[category] || 0) + 1;

    if (profile.relevantCategories.includes(category)) {
      top20Relevant++;
    } else if (profile.irrelevantCategories.includes(category)) {
      top20Irrelevant++;
    }
  }

  const scoreDistribution: Record<string, number> = {
    '90-100': 0, '80-89': 0, '70-79': 0, '60-69': 0,
    '50-59': 0, '40-49': 0, '30-39': 0, '20-29': 0, '10-19': 0, '0-9': 0,
  };

  for (const r of ranked) {
    const score = r.result.score;
    const bucket = score >= 90 ? '90-100'
      : score >= 80 ? '80-89'
      : score >= 70 ? '70-79'
      : score >= 60 ? '60-69'
      : score >= 50 ? '50-59'
      : score >= 40 ? '40-49'
      : score >= 30 ? '30-39'
      : score >= 20 ? '20-29'
      : score >= 10 ? '10-19'
      : '0-9';
    scoreDistribution[bucket] = (scoreDistribution[bucket] ?? 0) + 1;
  }

  const falsePositives = ranked.filter(r => {
    const category = categorizeTitle(r.vacancy.title);
    return profile.irrelevantCategories.includes(category) && r.result.score > 50;
  }).map(r => ({ title: r.vacancy.title, category: categorizeTitle(r.vacancy.title), score: r.result.score }));

  const falseNegatives = ranked.filter(r => {
    const category = categorizeTitle(r.vacancy.title);
    return profile.relevantCategories.includes(category) && r.result.score < 40;
  }).map(r => ({ title: r.vacancy.title, category: categorizeTitle(r.vacancy.title), score: r.result.score }));

  const totalScores = ranked.map(r => r.result.score);
  const careerFitScores = ranked.map(r => r.result.careerFitScore);
  const interestScores = ranked.map(r => r.result.interestScore);

  return {
    profileName: profile.name,
    rankedVacancies: ranked.length,
    top20: top20.map((r, i) => ({
      rank: i + 1,
      title: r.vacancy.title,
      category: categorizeTitle(r.vacancy.title),
      score: r.result.score,
      interestScore: r.result.interestScore,
      careerFitScore: r.result.careerFitScore,
      matchedSkills: r.result.matchedSkills,
    })),
    scoreDistribution,
    top20Relevant,
    top20Irrelevant,
    top20Categories,
    falsePositives,
    falseNegatives,
    avgCareerFit: Math.round(careerFitScores.reduce((a, b) => a + b, 0) / careerFitScores.length),
    avgInterest: Math.round(interestScores.reduce((a, b) => a + b, 0) / interestScores.length),
    avgTotal: Math.round(totalScores.reduce((a, b) => a + b, 0) / totalScores.length),
    careerFitRange: { min: Math.min(...careerFitScores), max: Math.max(...careerFitScores) },
    interestRange: { min: Math.min(...interestScores), max: Math.max(...interestScores) },
  };
}

// ============================================================
// MAIN TEST SUITE
// ============================================================
describe('Multi-Profile Ranking Validation', () => {
  const evaluations: ProfileEvaluation[] = [];
  let rawVacancies: RawVacancy[] = [];

  beforeAll(async () => {
    rawVacancies = await prisma.vacancy.findMany({
      include: {
        company: { select: { name: true, id: true } },
        sources: { select: { providerType: true, providerId: true, sourceUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const providerConfigs = await prisma.providerConfig.findMany();
    const qualityScores: ProviderQualityMap = {
      byProviderId: new Map(),
      byProviderType: new Map(),
    };
    for (const config of providerConfigs) {
      if (config.qualityScore !== null && config.qualityScore !== undefined) {
        qualityScores.byProviderId.set(config.providerId, config.qualityScore);
        qualityScores.byProviderType.set(config.providerId, config.qualityScore);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('RANKING v4.2 MULTI-PROFILE VALIDATION');
    console.log('='.repeat(80));
    console.log(`Database: ${rawVacancies.length} vacancies`);
    console.log(`Profiles: ${PROFILES.length}`);
    console.log('='.repeat(80) + '\n');

    for (const profile of PROFILES) {
      const evaluation = evaluateProfile(profile, rawVacancies, qualityScores);
      evaluations.push(evaluation);

      console.log('-'.repeat(80));
      console.log(`PROFILE: ${profile.name.toUpperCase()}`);
      console.log('-'.repeat(80));
      console.log(`  Positions: ${profile.desiredPositions.join(', ')}`);
      console.log(`  Technologies: ${profile.desiredTechnologies.join(', ')}`);
      console.log(`  Remote only: ${profile.isRemoteOnly}`);
      console.log(`  Experience: ${profile.experienceLevel}`);
      console.log(`  Salary: $${profile.salaryMin.toLocaleString()} - $${profile.salaryMax.toLocaleString()} ${profile.salaryPeriod}`);
      console.log(`  Relevant: ${profile.relevantCategories.join(', ')}`);
      console.log('');

      console.log('  TOP 20 RECOMMENDATIONS:');
      for (const item of evaluation.top20) {
        const marker = profile.relevantCategories.includes(item.category) ? '[OK]' : '[!!]';
        console.log(`    ${marker} #${item.rank} [Score: ${item.score}] [Career: ${item.careerFitScore}] [Interest: ${item.interestScore}] ${item.title} (${item.category})`);
        if (item.matchedSkills.length > 0) {
          console.log(`         Matched: ${item.matchedSkills.join(', ')}`);
        }
      }
      console.log('');

      console.log('  SCORE DISTRIBUTION:');
      for (const [range, count] of Object.entries(evaluation.scoreDistribution)) {
        if (count > 0) {
          const bar = '#'.repeat(Math.min(count, 40));
          console.log(`    ${range}: ${count.toString().padStart(3)} ${bar}`);
        }
      }
      console.log('');

      console.log('  CATEGORY BREAKDOWN:');
      for (const [cat, count] of Object.entries(evaluation.top20Categories).sort((a, b) => b[1] - a[1])) {
        const isRelevant = profile.relevantCategories.includes(cat);
        console.log(`    ${isRelevant ? '[OK]' : '[!!]'} ${cat}: ${count}`);
      }
      console.log('');

      console.log('  SCORES SUMMARY:');
      console.log(`    Precision (Top 20): ${(evaluation.top20Relevant / 20 * 100).toFixed(1)}%`);
      console.log(`    Relevant in Top 20: ${evaluation.top20Relevant}/20`);
      console.log(`    Irrelevant in Top 20: ${evaluation.top20Irrelevant}/20`);
      console.log(`    False Positives (score > 50, irrelevant): ${evaluation.falsePositives.length}`);
      console.log(`    False Negatives (score < 40, relevant): ${evaluation.falseNegatives.length}`);
      console.log(`    Avg Career Fit: ${evaluation.avgCareerFit}`);
      console.log(`    Avg Interest: ${evaluation.avgInterest}`);
      console.log(`    Avg Total: ${evaluation.avgTotal}`);
      console.log(`    Career Fit Range: ${evaluation.careerFitRange.min} - ${evaluation.careerFitRange.max}`);
      console.log(`    Interest Range: ${evaluation.interestRange.min} - ${evaluation.interestRange.max}`);
      console.log('');
    }

    // Cross-profile summary
    console.log('='.repeat(80));
    console.log('CROSS-PROFILE SUMMARY');
    console.log('='.repeat(80));
    console.log('');
    console.log('  Profile                   | Precision | Relevant | FP  | FN  | Avg Career | Avg Interest');
    console.log('  ' + '-'.repeat(78));
    for (const e of evaluations) {
      const precision = (e.top20Relevant / 20 * 100).toFixed(0).padStart(3);
      const relevant = `${e.top20Relevant}/20`.padEnd(5);
      const fp = e.falsePositives.length.toString().padStart(3);
      const fn = e.falseNegatives.length.toString().padStart(3);
      console.log(`  ${e.profileName.padEnd(25)} | ${precision}%    | ${relevant} | ${fp} | ${fn} | ${e.avgCareerFit.toString().padStart(10)} | ${e.avgInterest.toString().padStart(11)}`);
    }
    console.log('');

    // Validation checks
    console.log('='.repeat(80));
    console.log('VALIDATION CHECKS');
    console.log('='.repeat(80));
    console.log('');

    // Check 1: Role mismatch penalty
    const frontendEval = evaluations[0];
    if (!frontendEval) throw new Error('expected a Frontend evaluation');
    const backendInFrontend = frontendEval.falsePositives.filter(fp => fp.category === 'Backend');
    console.log('1. ROLE MISMATCH PENALTY:');
    console.log(`   Backend vacancies ranked high for Frontend profile: ${backendInFrontend.length}`);
    console.log(`   ${backendInFrontend.length === 0 ? 'PASS' : 'CHECK'}: No backend vacancies in frontend top recommendations`);
    console.log('');

    // Check 2: Technology matching
    console.log('2. TECHNOLOGY MATCHING:');
    for (const e of evaluations) {
      const topMatched = e.top20.filter(t => t.matchedSkills.length > 0);
      console.log(`   ${e.profileName}: ${topMatched.length}/20 top recommendations have tech matches`);
    }
    console.log('');

    // Check 3: Remote preference
    console.log('3. REMOTE PREFERENCE:');
    const frontendRemote = frontendEval.top20.filter(t => {
      const v = rawVacancies.find(rv => rv.title === t.title);
      return v && v.remote === 'REMOTE';
    });
    console.log(`   Frontend (remote-only): ${frontendRemote.length}/20 top recs are remote`);
    console.log(`   ${frontendRemote.length >= 10 ? 'PASS' : 'CHECK'}: Remote preference respected`);
    console.log('');

    // Check 4: Interest vs career fit
    console.log('4. INTEREST vs CAREER FIT:');
    for (const e of evaluations) {
      const dominatedByInterest = e.top20.filter(t => t.interestScore > t.careerFitScore).length;
      console.log(`   ${e.profileName}: ${dominatedByInterest}/20 where interest > career fit`);
    }
    console.log('   All profiles: Career fit should dominate (interest < career fit in most cases)');
    console.log('');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should evaluate all 5 profiles', () => {
    expect(evaluations.length).toBe(5);
    for (const e of evaluations) {
      expect(e.rankedVacancies).toBeGreaterThan(0);
      expect(e.top20.length).toBe(20);
    }
  });

  it('Frontend profile should have high precision', () => {
    const frontend = evaluations[0];
    if (!frontend) throw new Error('expected a Frontend evaluation');
    expect(frontend.top20Relevant).toBeGreaterThanOrEqual(14);
  });

  it('Backend profile should not rank frontend high', () => {
    const backend = evaluations[1];
    if (!backend) throw new Error('expected a Backend evaluation');
    const frontendInBackend = backend.top20.filter(t => t.category === 'Frontend');
    expect(frontendInBackend.length).toBeLessThanOrEqual(3);
  });

  it('QA profile should have reasonable precision', () => {
    const qa = evaluations[2];
    if (!qa) throw new Error('expected a QA evaluation');
    expect(qa.top20Relevant).toBeGreaterThanOrEqual(10);
  });

  it('DevOps profile should rank infrastructure roles high', () => {
    const devops = evaluations[3];
    if (!devops) throw new Error('expected a DevOps evaluation');
    expect(devops.top20Relevant).toBeGreaterThanOrEqual(10);
  });

  it('Data profile should rank data roles high', () => {
    const data = evaluations[4];
    if (!data) throw new Error('expected a Data evaluation');
    expect(data.top20Relevant).toBeGreaterThanOrEqual(10);
  });

  it('careerFitScore should be the primary driver across all profiles', () => {
    for (const e of evaluations) {
      for (const item of e.top20) {
        expect(item.careerFitScore).toBeGreaterThanOrEqual(item.interestScore - 10);
      }
    }
  });

  it('interestScore should not dominate career mismatch', () => {
    for (const e of evaluations) {
      const profile = PROFILES.find(p => p.name === e.profileName);
      if (!profile) throw new Error(`expected a profile named ${e.profileName}`);
      const falseHigh = e.top20.filter(t => {
        const category = t.category;
        const isRelevant = profile.relevantCategories.includes(category);
        return !isRelevant && t.interestScore > t.careerFitScore + 20;
      });
      expect(falseHigh.length).toBe(0);
    }
  });

  it('score distribution should be reasonable across profiles', () => {
    for (const e of evaluations) {
      const total = Object.values(e.scoreDistribution).reduce((a, b) => a + b, 0);
      expect(total).toBe(e.rankedVacancies);
      expect((e.scoreDistribution['90-100'] ?? 0) + (e.scoreDistribution['80-89'] ?? 0)).toBeLessThanOrEqual(total * 0.3);
    }
  });
});
