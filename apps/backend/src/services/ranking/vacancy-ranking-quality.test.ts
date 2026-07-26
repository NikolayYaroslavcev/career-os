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
// TEST PROFILE: Frontend Developer / Middle+
// ============================================================
const TEST_PROFILE = {
  desiredPositions: ['Frontend Developer', 'React Developer', 'Frontend Engineer'],
  desiredTechnologies: [
    'React', 'TypeScript', 'Next.js', 'JavaScript',
    'Redux', 'REST API', 'GraphQL', 'WebSocket', 'CSS', 'HTML',
  ],
  experienceLevel: ExperienceLevel.SENIOR,
  desiredSalary: Salary.create(2000, 3000, 'USD', 'monthly'),
  desiredLocations: [Location.create({ country: 'Belarus', workMode: 'remote' })],
  isRemoteOnly: true,
};

function createTestSearchProfile(): SearchProfile {
  return SearchProfile.create({
    id: createSearchProfileId('test-eval-profile'),
    userId: createUserId('test-eval-user'),
    name: 'Frontend Developer Middle+',
    desiredPositions: TEST_PROFILE.desiredPositions,
    desiredTechnologies: TEST_PROFILE.desiredTechnologies.map(t => Technology.create(t, 'framework')),
    experienceLevel: TEST_PROFILE.experienceLevel,
    desiredSalary: TEST_PROFILE.desiredSalary,
    desiredLocations: TEST_PROFILE.desiredLocations,
    isRemoteOnly: TEST_PROFILE.isRemoteOnly,
  });
}

// ============================================================
// DATABASE FETCHING
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

// ============================================================
// CATEGORIZATION
// ============================================================
function categorizeTitle(title: string): string {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('frontend') || titleLower.includes('front-end') || titleLower.includes('front end') || titleLower.includes('react') || titleLower.includes('vue') || titleLower.includes('angular') || titleLower.includes('ui developer') || titleLower.includes('web developer')) {
    return 'Frontend';
  }
  if (titleLower.includes('backend') || titleLower.includes('back-end') || titleLower.includes('back end') || titleLower.includes('node') || titleLower.includes('java developer') || titleLower.includes('python developer') || titleLower.includes('golang') || titleLower.includes('rust developer')) {
    return 'Backend';
  }
  if (titleLower.includes('fullstack') || titleLower.includes('full-stack') || titleLower.includes('full stack')) {
    return 'Fullstack';
  }
  if (titleLower.includes('devops') || titleLower.includes('sre') || titleLower.includes('platform engineer')) {
    return 'DevOps';
  }
  if (titleLower.includes('mobile') || titleLower.includes('ios') || titleLower.includes('android') || titleLower.includes('flutter') || titleLower.includes('react native')) {
    return 'Mobile';
  }
  if (titleLower.includes('data') || titleLower.includes('ml') || titleLower.includes('machine learning') || titleLower.includes('ai') || titleLower.includes('analytics')) {
    return 'Data/ML';
  }
  if (titleLower.includes('qa') || titleLower.includes('quality') || titleLower.includes('test')) {
    return 'QA';
  }
  if (titleLower.includes('design') || titleLower.includes('ux') || titleLower.includes('ui designer')) {
    return 'Design';
  }
  if (titleLower.includes('product') || titleLower.includes('pm')) {
    return 'Product';
  }
  if (titleLower.includes('security')) {
    return 'Security';
  }
  
  return 'Other';
}

// ============================================================
// INTERFACES
// ============================================================
interface RankedVacancy {
  vacancy: Vacancy;
  companyName: string;
  sources: string[];
  providerQualityScore: number | undefined;
  result: RankingResult;
}

// ============================================================
// MAIN TEST
// ============================================================
describe('Vacancy Ranking Quality Evaluation', () => {
  const rankedVacancies: RankedVacancy[] = [];
  let rawVacancies: RawVacancy[] = [];
  
  beforeAll(async () => {
    // Fetch all vacancies from database
    rawVacancies = await prisma.vacancy.findMany({
      include: {
        company: { select: { name: true, id: true } },
        sources: { select: { providerType: true, providerId: true, sourceUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Fetch provider configs for quality scores
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
    
    console.log(`\n${'='.repeat(70)}`);
    console.log('VACANCY RANKING ENGINE v3.1 - PRODUCTION QUALITY EVALUATION');
    console.log(`${'='.repeat(70)}\n`);
    
    // 1. Test Profile
    console.log('1. TEST PROFILE');
    console.log('----------------');
    console.log(`   Role: Frontend Developer / Middle+`);
    console.log(`   Experience: 7 years (${TEST_PROFILE.experienceLevel})`);
    console.log(`   Technologies: ${TEST_PROFILE.desiredTechnologies.join(', ')}`);
    console.log(`   Preferences: Remote only`);
    console.log(`   Location: Belarus / Europe`);
    console.log(`   Salary: ${TEST_PROFILE.desiredSalary?.min}-${TEST_PROFILE.desiredSalary?.max} USD/month`);
    console.log('');
    
    // 2. Database stats
    console.log('2. DATABASE STATISTICS');
    console.log('----------------------');
    console.log(`   Total vacancies in database: ${rawVacancies.length}`);
    
    const remoteCount = rawVacancies.filter(v => v.remote === 'REMOTE').length;
    const hybridCount = rawVacancies.filter(v => v.remote === 'HYBRID').length;
    const onsiteCount = rawVacancies.filter(v => v.remote === 'ONSITE').length;
    const unknownCount = rawVacancies.filter(v => v.remote === 'UNKNOWN').length;
    
    console.log(`   Remote: ${remoteCount}`);
    console.log(`   Hybrid: ${hybridCount}`);
    console.log(`   Onsite: ${onsiteCount}`);
    console.log(`   Unknown: ${unknownCount}`);
    console.log(`   Provider configs with quality scores: ${qualityScores.byProviderId.size}`);
    console.log('');
    
    // Convert to domain entities
    const vacancyData = rawVacancies.map(v => prismaVacancyToDomain(v as unknown as RawVacancy));
    
    // 3. Run ranking with real provider quality scores
    console.log('3. RUNNING RANKING');
    console.log('------------------');
    const searchProfile = createTestSearchProfile();
    
    for (const { vacancy, companyName, sources, providerIds } of vacancyData) {
      // Find provider quality score from any of the vacancy's sources
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
      
      rankedVacancies.push({ vacancy, companyName, sources, providerQualityScore, result });
    }
    
    rankedVacancies.sort((a, b) => b.result.score - a.result.score);
    console.log(`   Ranked ${rankedVacancies.length} vacancies`);
    console.log('');
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
  });
  
  it('should have ranked vacancies', () => {
    expect(rankedVacancies.length).toBeGreaterThan(0);
  });
  
  it('should produce a ranking quality report', () => {
    // Top 20 Analysis
    const top20 = rankedVacancies.slice(0, 20);
    const relevantCategories = ['Frontend', 'Fullstack'];
    const irrelevantCategories = ['Backend', 'QA', 'DevOps', 'Data/ML', 'Mobile', 'Design', 'Product', 'Security'];
    
    let top20Relevant = 0;
    let top20Irrelevant = 0;
    const top20Categories: Record<string, number> = {};
    
    for (const r of top20) {
      const category = categorizeTitle(r.vacancy.title);
      top20Categories[category] = (top20Categories[category] || 0) + 1;
      
      if (relevantCategories.includes(category)) {
        top20Relevant++;
      } else if (irrelevantCategories.includes(category)) {
        top20Irrelevant++;
      }
    }
    
    // Score Distribution
    const scoreDistribution: Record<string, number> = {
      '90-100': 0, '80-89': 0, '70-79': 0, '60-69': 0,
      '50-59': 0, '40-49': 0, '30-39': 0, '20-29': 0, '10-19': 0, '0-9': 0,
    };
    
    for (const r of rankedVacancies) {
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
    
    // False Positives: unrelated vacancy with high score
    const falsePositives = rankedVacancies.filter(r => {
      const category = categorizeTitle(r.vacancy.title);
      return irrelevantCategories.includes(category) && r.result.score > 60;
    });
    
    // False Negatives: relevant vacancy with low score
    const falseNegatives = rankedVacancies.filter(r => {
      const category = categorizeTitle(r.vacancy.title);
      return relevantCategories.includes(category) && r.result.score < 40;
    });
    
    // Print report
    console.log(`${'='.repeat(70)}`);
    console.log('4. TOP 20 RECOMMENDATIONS');
    console.log(`${'='.repeat(70)}\n`);
    
    for (let i = 0; i < Math.min(20, top20.length); i++) {
      const item = top20[i];
      if (!item) throw new Error('expected a ranked vacancy');
      const { vacancy, companyName, sources, providerQualityScore, result } = item;
      const category = categorizeTitle(vacancy.title);
      
      console.log(`#${i + 1} [Score: ${result.score}] ${vacancy.title}`);
      console.log(`   Company: ${companyName}`);
      console.log(`   Provider: ${sources.join(', ') || 'Unknown'}`);
      console.log(`   Provider Quality: ${providerQualityScore !== undefined ? `${providerQualityScore}/100` : 'N/A'}`);
      console.log(`   Category: ${category}`);
      console.log(`   Matched: ${result.matchedSkills.join(', ') || 'None'}`);
      console.log(`   Missing: ${result.missingSkills.join(', ') || 'None'}`);
      console.log(`   Reasons: ${result.reasons.slice(0, 3).join(' | ')}`);
      console.log('');
    }
    
    console.log(`${'='.repeat(70)}`);
    console.log('5. QUALITY ANALYSIS');
    console.log(`${'='.repeat(70)}\n`);
    
    console.log('A) Top 20 Relevance:');
    console.log(`   Relevant (Frontend/Fullstack): ${top20Relevant}/20 (${Math.round(top20Relevant/20*100)}%)`);
    console.log(`   Irrelevant (Backend/QA/DevOps/etc.): ${top20Irrelevant}/20 (${Math.round(top20Irrelevant/20*100)}%)`);
    console.log('');
    
    console.log('B) Top 20 Category Distribution:');
    for (const [category, count] of Object.entries(top20Categories).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${category}: ${count}`);
    }
    console.log('');
    
    console.log('C) Score Distribution:');
    for (const [range, count] of Object.entries(scoreDistribution)) {
      if (count > 0) {
        console.log(`   ${range}: ${count}`);
      }
    }
    console.log('');
    
    console.log('D) False Positives (Irrelevant vacancy with high score >60):');
    if (falsePositives.length === 0) {
      console.log('   None found');
    } else {
      for (const fp of falsePositives.slice(0, 10)) {
        console.log(`   - [Score: ${fp.result.score}] ${fp.vacancy.title} (${categorizeTitle(fp.vacancy.title)})`);
      }
    }
    console.log('');
    
    console.log('E) False Negatives (Relevant vacancy with low score <40):');
    if (falseNegatives.length === 0) {
      console.log('   None found');
    } else {
      for (const fn of falseNegatives.slice(0, 10)) {
        console.log(`   - [Score: ${fn.result.score}] ${fn.vacancy.title} (${categorizeTitle(fn.vacancy.title)})`);
      }
    }
    console.log('');
    
    console.log(`${'='.repeat(70)}`);
    console.log('6. RANKING FACTORS ANALYSIS');
    console.log(`${'='.repeat(70)}\n`);
    
    // Analyze factor contributions
    const factorCounts: Record<string, number> = {
      technology: 0, titleRole: 0, experience: 0,
      salary: 0, remoteLocation: 0, providerQuality: 0,
    };
    
    for (const r of rankedVacancies) {
      for (const reason of r.result.reasons) {
        if (reason.includes('matches')) factorCounts.technology = (factorCounts.technology ?? 0) + 1;
        else if (reason.includes('Title')) factorCounts.titleRole = (factorCounts.titleRole ?? 0) + 1;
        else if (reason.includes('Experience')) factorCounts.experience = (factorCounts.experience ?? 0) + 1;
        else if (reason.includes('Salary')) factorCounts.salary = (factorCounts.salary ?? 0) + 1;
        else if (reason.includes('Remote') || reason.includes('location') || reason.includes('Onsite') || reason.includes('Hybrid')) factorCounts.remoteLocation = (factorCounts.remoteLocation ?? 0) + 1;
        else if (reason.includes('provider') || reason.includes('Quality')) factorCounts.providerQuality = (factorCounts.providerQuality ?? 0) + 1;
      }
    }
    
    const totalFactors = Object.values(factorCounts).reduce((a, b) => a + b, 0);
    const factorPercentages: Record<string, number> = {};
    if (totalFactors > 0) {
      for (const [key, val] of Object.entries(factorCounts)) {
        factorPercentages[key] = Math.round((val / totalFactors) * 100);
      }
    }
    
    console.log('Factor Impact (% of total scoring):');
    console.log(`   Technology: ${factorPercentages.technology || 0}%`);
    console.log(`   Title/Role: ${factorPercentages.titleRole || 0}%`);
    console.log(`   Experience: ${factorPercentages.experience || 0}%`);
    console.log(`   Salary: ${factorPercentages.salary || 0}%`);
    console.log(`   Remote/Location: ${factorPercentages.remoteLocation || 0}%`);
    console.log(`   Provider Quality: ${factorPercentages.providerQuality || 0}%`);
    console.log('');
    
    // Provider Quality Impact Analysis
    console.log(`${'='.repeat(70)}`);
    console.log('6b. PROVIDER QUALITY IMPACT');
    console.log(`${'='.repeat(70)}\n`);
    
    const withQuality = rankedVacancies.filter(r => r.providerQualityScore !== undefined);
    const withoutQuality = rankedVacancies.filter(r => r.providerQualityScore === undefined);
    
    console.log(`   Vacancies with provider quality score: ${withQuality.length}`);
    console.log(`   Vacancies without provider quality score: ${withoutQuality.length}`);
    
    if (withQuality.length > 0) {
      const avgQuality = withQuality.reduce((sum, r) => sum + (r.providerQualityScore ?? 0), 0) / withQuality.length;
      const avgScoreWith = withQuality.reduce((sum, r) => sum + r.result.score, 0) / withQuality.length;
      const avgScoreWithout = withoutQuality.length > 0
        ? withoutQuality.reduce((sum, r) => sum + r.result.score, 0) / withoutQuality.length
        : 0;
      
      console.log(`   Average provider quality score: ${avgQuality.toFixed(1)}/100`);
      console.log(`   Average ranking score (with quality): ${avgScoreWith.toFixed(1)}`);
      console.log(`   Average ranking score (without quality): ${avgScoreWithout.toFixed(1)}`);
    }
    console.log('');
    
    // Technology Fallback Impact Analysis
    console.log(`${'='.repeat(70)}`);
    console.log('6c. TECHNOLOGY FALLBACK IMPACT');
    console.log(`${'='.repeat(70)}\n`);
    
    let techFromFallback = 0;
    let techFromDatabase = 0;
    
    for (const raw of rawVacancies) {
      const rawVacancy = raw as unknown as RawVacancy;
      if (rawVacancy.technologies.length === 0) {
        techFromFallback++;
      } else {
        techFromDatabase++;
      }
    }
    
    console.log(`   Vacancies with technologies in database: ${techFromDatabase}`);
    console.log(`   Vacancies using technology fallback (from text): ${techFromFallback}`);
    console.log(`   Fallback usage: ${rawVacancies.length > 0 ? Math.round(techFromFallback / rawVacancies.length * 100) : 0}%`);
    console.log('');
    
    console.log(`${'='.repeat(70)}`);
    console.log('7. RANKING PROBLEMS');
    console.log(`${'='.repeat(70)}\n`);
    
    const highScoreIrrelevant = rankedVacancies.filter(r => {
      const category = categorizeTitle(r.vacancy.title);
      return ['Backend', 'QA', 'DevOps', 'Data/ML', 'Mobile'].includes(category) && r.result.score > 50;
    });
    
    console.log('A) Unrelated vacancies with high scores (>50):');
    if (highScoreIrrelevant.length === 0) {
      console.log('   None found');
    } else {
      for (const r of highScoreIrrelevant.slice(0, 5)) {
        console.log(`   - [Score: ${r.result.score}] ${r.vacancy.title} (${categorizeTitle(r.vacancy.title)})`);
        console.log(`     Reasons: ${r.result.reasons.join(', ')}`);
      }
    }
    console.log('');
    
    const lowScoreRelevant = rankedVacancies.filter(r => {
      const category = categorizeTitle(r.vacancy.title);
      return ['Frontend', 'Fullstack'].includes(category) && r.result.score < 50;
    });
    
    console.log('B) Relevant vacancies with low scores (<50):');
    if (lowScoreRelevant.length === 0) {
      console.log('   None found');
    } else {
      for (const r of lowScoreRelevant.slice(0, 5)) {
        console.log(`   - [Score: ${r.result.score}] ${r.vacancy.title} (${categorizeTitle(r.vacancy.title)})`);
        console.log(`     Reasons: ${r.result.reasons.join(', ')}`);
      }
    }
    console.log('');
    
    // Technology fallback issues
    const techFallbackIssues = rankedVacancies.filter(r => {
      const rawVacancy = rawVacancies.find(v => (v as unknown as RawVacancy).id === r.vacancy.id.toString());
      const raw = rawVacancy as unknown as RawVacancy | undefined;
      return raw && raw.technologies.length === 0 && r.result.matchedSkills.length === 0;
    });
    
    console.log('C) Vacancies with empty technologies and no fallback matches:');
    if (techFallbackIssues.length === 0) {
      console.log('   None found');
    } else {
      for (const r of techFallbackIssues.slice(0, 5)) {
        console.log(`   - [Score: ${r.result.score}] ${r.vacancy.title}`);
        console.log(`     Description snippet: ${r.vacancy.description.slice(0, 100)}...`);
      }
    }
    console.log('');
    
    console.log(`${'='.repeat(70)}`);
    console.log('8. RANKING QUALITY SUMMARY');
    console.log(`${'='.repeat(70)}\n`);
    
    const precision = top20Relevant / 20;
    
    console.log(`Precision (Top 20): ${(precision * 100).toFixed(1)}%`);
    console.log(`Relevant vacancies in top 20: ${top20Relevant}/20`);
    console.log(`False positives (irrelevant with high score): ${falsePositives.length}`);
    console.log(`False negatives (relevant with low score): ${falseNegatives.length}`);
    console.log('');
    
    console.log('RECOMMENDED IMPROVEMENTS:');
    console.log('1. Technology matching: Add fuzzy matching for similar technologies');
    console.log('2. Title matching: Improve keyword similarity scoring');
    console.log('3. Salary normalization: Account for yearly vs monthly salary differences');
    console.log('4. Remote filtering: Add stricter filtering for remote-only preferences');
    console.log('5. Provider quality: Use actual provider quality scores from database');
    console.log('6. Technology fallback: Improve extraction from vacancy descriptions');
    console.log(`${'='.repeat(70)}\n`);
    
    // Assertions for quality
    expect(rankedVacancies.length).toBeGreaterThan(0);
    expect(top20Relevant + top20Irrelevant).toBeLessThanOrEqual(20);
  });
});
