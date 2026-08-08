import type { Vacancy, SearchProfile, ExperienceLevel, Salary, UserId, UserVacancyInteractionRepository } from '@careeros/career';
import { EXPERIENCE_LEVEL_ORDER } from '@careeros/career';
import { calculatePersonalizationBoost, type PreferenceBoosts } from './preference-boost.js';
import { calculateVacancyQualityScore } from './vacancy-quality-score.js';
import { normalizeTechnology, computeTechnologyMatchLevel } from './technology-normalization.js';
import { calculateProviderQualityFromVacancies } from './provider-quality-calculator.js';

const INTERACTION_WEIGHTS: Record<string, number> = {
  SAVE: 10,
  APPLY: 15,
  VIEW: 2,
  IGNORE: -10,
  HIDE: -20,
};

export interface RankingInput {
  readonly vacancy: Vacancy;
  readonly searchProfile: SearchProfile;
  readonly providerQualityScore?: number;
  readonly preferenceBoosts?: PreferenceBoosts;
  readonly interactionBoost?: number;
  readonly qualityScore?: number;
  readonly freshnessScore?: number;
}

export interface RankingFactor {
  readonly name: string;
  readonly score: number;
  readonly maxScore: number;
  readonly impact: 'positive' | 'negative' | 'neutral';
  readonly description: string;
}

export type VacancyTier = 'HOT' | 'WARM' | 'COLD' | 'REJECT';

export function classifyTier(score: number): VacancyTier {
  if (score >= 80) return 'HOT';
  if (score >= 60) return 'WARM';
  if (score >= 40) return 'COLD';
  return 'REJECT';
}

export interface RankingExplanation {
  readonly score: number;
  readonly tier: VacancyTier;
  readonly positiveFactors: string[];
  readonly warnings: string[];
}

export interface RankingResult {
  readonly score: number;
  readonly tier: VacancyTier;
  readonly interestScore: number;
  readonly careerFitScore: number;
  readonly matchedSkills: string[];
  readonly missingSkills: string[];
  readonly reasons: string[];
  readonly positiveFactors: RankingFactor[];
  readonly negativeFactors: RankingFactor[];
  readonly explanation: RankingExplanation;
}

const WEIGHTS = {
  ROLE: 35,
  TECHNOLOGY: 30,
  EXPERIENCE: 15,
  REMOTE_LOCATION: 10,
  SALARY: 5,
  PROVIDER_QUALITY: 5,
} as const;

type RoleCategory = 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'devops' | 'data' | 'product' | 'design' | 'other';

const ROLE_CLASSIFICATION: Record<RoleCategory, string[]> = {
  frontend: [
    'frontend', 'front-end', 'front end', 'react developer', 'react engineer',
    'javascript developer', 'web developer', 'ui developer', 'vue developer',
    'angular developer', 'css developer', 'html developer',
    'фронтенд', 'фронт-енд', 'frontend-разработчик', 'фронтенд-разработчик',
    'разработчик интерфейсов', 'react разработчик', 'web-разработчик',
    'веб-разработчик', 'javascript разработчик', 'vue разработчик',
    'angular разработчик', 'ui разработчик',
  ],
  backend: [
    'backend', 'back-end', 'back end', 'api developer', 'server engineer',
    'node developer', 'python developer', 'java developer', 'golang developer',
    'rust developer', 'php developer', 'ruby developer', 'dotnet developer',
    'бэкенд', 'бэк-энд', 'backend-разработчик', 'бэкенд-разработчик',
    'серверный разработчик', 'node разработчик', 'python разработчик',
    'java разработчик', 'golang разработчик', 'php разработчик',
  ],
  fullstack: [
    'fullstack', 'full-stack', 'full stack', 'full stack developer',
    'full stack engineer', 'фуллстек', 'фулл-стек', 'fullstack разработчик',
    'фуллстек разработчик',
  ],
  mobile: [
    'mobile', 'ios', 'android', 'flutter', 'react native', 'swift developer',
    'kotlin developer', 'xamarin', 'ionic', 'мобильный разработчик',
    'разработчик мобильных приложений', 'ios разработчик', 'android разработчик',
  ],
  devops: [
    'devops', 'dev ops', 'sre', 'infrastructure', 'cloud', 'platform engineer',
    'sysadmin', 'kubernetes', 'docker', 'terraform', 'инженер инфраструктуры',
    'системный администратор', 'cloud инженер', 'platform инженер',
  ],
  data: [
    'data scientist', 'ml engineer', 'ai engineer', 'machine learning',
    'data analyst', 'data engineer', 'analytics engineer', ' data инженер',
    'аналитик данных', 'инженер данных', 'мл инженер', 'ai инженер',
  ],
  product: [
    'product manager', 'product owner', 'pm', 'scrum master',
    'продукт менеджер', 'продакт менеджер', 'product менеджер',
  ],
  design: [
    'designer', 'ux designer', 'ui designer', 'ux/ui', 'figma',
    'product designer', 'дизайнер', 'ux дизайнер', 'ui дизайнер',
    'продуктовый дизайнер',
  ],
  other: [],
};

const ROLE_TECH_RELEVANCE: Record<RoleCategory, Set<string>> = {
  frontend: new Set([
    'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'typescript',
    'javascript', 'html', 'css', 'scss', 'tailwind', 'redux', 'zustand',
    'graphql', 'rest api', 'webpack', 'vite', 'jest', 'cypress', 'mobx',
    'pinia', 'vuex',
  ]),
  backend: new Set([
    'node', 'node.js', 'express', 'fastify', 'nest.js', 'python', 'django',
    'flask', 'fastapi', 'java', 'spring', 'golang', 'rust', 'php', 'laravel',
    'ruby', 'rails', 'postgresql', 'mysql', 'mongodb', 'redis', 'kafka',
    'grpc', 'rest api', 'graphql', 'elasticsearch', 'rabbitmq',
  ]),
  fullstack: new Set([
    'react', 'vue', 'angular', 'node', 'node.js', 'typescript', 'javascript',
    'postgresql', 'mongodb', 'redis', 'docker', 'rest api', 'graphql',
    'python', 'java', 'php', 'ruby',
  ]),
  mobile: new Set([
    'swift', 'kotlin', 'flutter', 'react native', 'dart', 'ios', 'android',
    'xamarin', 'ionic', 'objective-c', 'swiftui', 'jetpack compose',
  ]),
  devops: new Set([
    'docker', 'kubernetes', 'terraform', 'ansible', 'aws', 'gcp', 'azure',
    'jenkins', 'github actions', 'gitlab ci', 'prometheus', 'grafana',
    'linux', 'bash', 'python', 'helm', 'argo', 'consul', 'vault',
  ]),
  data: new Set([
    'python', 'r', 'sql', 'tensorflow', 'pytorch', 'spark', 'hadoop',
    'airflow', 'dbt', 'snowflake', 'bigquery', 'pandas', 'numpy',
    'machine learning', 'deep learning', 'nlp', 'scikit-learn', 'keras',
  ]),
  product: new Set([
    'jira', 'confluence', 'figma', 'notion', 'linear', 'productboard',
    'miro', 'amplitude', 'mixpanel',
  ]),
  design: new Set([
    'figma', 'sketch', 'adobe xd', 'photoshop', 'illustrator',
    'invision', 'zeplin', 'maze', 'principle', 'after effects',
  ]),
  other: new Set(),
};

function normalizeString(value: string): string {
  return value.toLowerCase().trim();
}

export function calculateInteractionBoost(interactions: Array<{ action: string; vacancyId: string }>, vacancyId: string): number {
  let boost = 0;
  for (const interaction of interactions) {
    if (interaction.vacancyId === vacancyId) {
      boost += INTERACTION_WEIGHTS[interaction.action] ?? 0;
    }
  }
  return Math.max(-20, Math.min(20, boost));
}

/**
 * Same result as calling calculateInteractionBoost(interactions, id) once per
 * vacancy id, but groups interactions by vacancyId first — O(vacancies +
 * interactions) instead of O(vacancies * interactions). rankVacancies below
 * ranks every candidate vacancy against the same interaction history, so
 * calling the per-id version there rescans the whole list once per vacancy.
 */
function buildInteractionBoostMap(interactions: Array<{ action: string; vacancyId: string }>): Map<string, number> {
  const raw = new Map<string, number>();
  for (const interaction of interactions) {
    raw.set(interaction.vacancyId, (raw.get(interaction.vacancyId) ?? 0) + (INTERACTION_WEIGHTS[interaction.action] ?? 0));
  }

  const clamped = new Map<string, number>();
  for (const [vacancyId, boost] of raw) {
    clamped.set(vacancyId, Math.max(-20, Math.min(20, boost)));
  }
  return clamped;
}

function buildExplanation(
  score: number,
  tier: VacancyTier,
  positiveFactors: RankingFactor[],
  negativeFactors: RankingFactor[],
  vacancy: Vacancy,
  providerQualityScore?: number,
  freshnessScore?: number,
): RankingExplanation {
  const positive: string[] = [];
  const warnings: string[] = [];

  for (const f of positiveFactors) {
    if (f.impact === 'positive') {
      positive.push(f.description);
    }
  }

  if (!vacancy.salary) {
    warnings.push('Missing salary');
  }
  if (!vacancy.description || vacancy.description.length < 50) {
    warnings.push('Missing apply URL');
  }
  if (providerQualityScore === undefined || providerQualityScore < 50) {
    warnings.push('Low provider quality');
  }
  if (freshnessScore !== undefined && freshnessScore < 40) {
    warnings.push('Old vacancy');
  }

  return { score, tier, positiveFactors: positive, warnings };
}

function extractTechnologiesFromText(text: string): string[] {
  const techPatterns = [
    'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'typescript',
    'javascript', 'html', 'css', 'scss', 'tailwind', 'redux', 'graphql',
    'rest api', 'webpack', 'vite', 'node', 'node.js', 'express', 'fastify',
    'nest.js', 'python', 'django', 'flask', 'fastapi', 'java', 'spring',
    'golang', 'rust', 'php', 'laravel', 'ruby', 'rails', 'postgresql',
    'mysql', 'mongodb', 'redis', 'kafka', 'docker', 'kubernetes', 'terraform',
    'aws', 'gcp', 'azure', 'swift', 'kotlin', 'flutter', 'react native',
    'dart', 'mobx', 'pinia', 'vuex', 'zustand', 'elasticsearch', 'rabbitmq',
  ];

  const textLower = text.toLowerCase();
  const found: string[] = [];

  for (const tech of techPatterns) {
    if (textLower.includes(tech)) {
      found.push(normalizeTechnology(tech));
    }
  }

  return Array.from(new Set(found));
}

function classifyVacancyRole(title: string): RoleCategory {
  const titleLower = normalizeString(title);

  for (const [category, keywords] of Object.entries(ROLE_CLASSIFICATION)) {
    if (category === 'other') continue;
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        return category as RoleCategory;
      }
    }
  }

  return 'other';
}

function classifyUserRole(desiredPositions: readonly string[]): RoleCategory {
  const positionCounts: Record<RoleCategory, number> = {
    frontend: 0, backend: 0, fullstack: 0, mobile: 0,
    devops: 0, data: 0, product: 0, design: 0, other: 0,
  };

  for (const position of desiredPositions) {
    const category = classifyVacancyRole(position);
    positionCounts[category]++;
  }

  let maxCategory: RoleCategory = 'other';
  let maxCount = 0;
  for (const [category, count] of Object.entries(positionCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxCategory = category as RoleCategory;
    }
  }

  return maxCategory;
}

function calculateRoleScore(
  vacancyTitle: string,
  desiredPositions: readonly string[],
): { score: number; reason: string; vacancyRole: RoleCategory; userRole: RoleCategory } {
  if (desiredPositions.length === 0) {
    return { score: 0, reason: 'No desired positions specified', vacancyRole: 'other', userRole: 'other' };
  }

  const vacancyRole = classifyVacancyRole(vacancyTitle);
  const userRole = classifyUserRole(desiredPositions);

  const titleLower = normalizeString(vacancyTitle);

  for (const position of desiredPositions) {
    const positionLower = normalizeString(position);
    if (titleLower.includes(positionLower)) {
      return {
        score: WEIGHTS.ROLE,
        reason: `Title exactly matches "${position}"`,
        vacancyRole,
        userRole,
      };
    }
  }

  if (vacancyRole === userRole && vacancyRole !== 'other') {
    return {
      score: Math.round(WEIGHTS.ROLE * 0.85),
      reason: `Role category matches (${vacancyRole})`,
      vacancyRole,
      userRole,
    };
  }

  if (vacancyRole === 'fullstack' && (userRole === 'frontend' || userRole === 'backend')) {
    return {
      score: Math.round(WEIGHTS.ROLE * 0.6),
      reason: `Fullstack role compatible with ${userRole}`,
      vacancyRole,
      userRole,
    };
  }

  if (userRole === 'fullstack' && (vacancyRole === 'frontend' || vacancyRole === 'backend')) {
    return {
      score: Math.round(WEIGHTS.ROLE * 0.6),
      reason: `${vacancyRole} role compatible with fullstack`,
      vacancyRole,
      userRole,
    };
  }

  if (vacancyRole !== 'other' && userRole !== 'other') {
    return {
      score: 0,
      reason: `Role mismatch: vacancy is ${vacancyRole}, user wants ${userRole}`,
      vacancyRole,
      userRole,
    };
  }

  return {
    score: Math.round(WEIGHTS.ROLE * 0.3),
    reason: 'Role category unknown, partial match',
    vacancyRole,
    userRole,
  };
}

function calculateTechnologyScore(
  userTechnologies: readonly string[],
  vacancyTechnologies: readonly string[],
  vacancyRole: RoleCategory,
): { score: number; matched: string[]; missing: string[] } {
  if (userTechnologies.length === 0) {
    return { score: 0, matched: [], missing: [] };
  }

  const userTechList = userTechnologies.map(normalizeString);

  const relevantTech = ROLE_TECH_RELEVANCE[vacancyRole] ?? new Set<string>();

  let weightedMatchCount = 0;
  let weightedTotalCount = 0;
  const matched: string[] = [];
  const missing: string[] = [];

  for (const tech of userTechList) {
    const isRelevant = relevantTech.size === 0 || relevantTech.has(tech);
    const weight = isRelevant ? 1.0 : 0.3;
    weightedTotalCount += weight;

    let bestMatchScore = 0;

    for (const vacancyTech of vacancyTechnologies) {
      const matchResult = computeTechnologyMatchLevel(tech, vacancyTech);
      if (matchResult.score > bestMatchScore) {
        bestMatchScore = matchResult.score;
      }
    }

    if (bestMatchScore > 0) {
      weightedMatchCount += weight * bestMatchScore;
      matched.push(tech);
    } else {
      missing.push(tech);
    }
  }

  const matchRatio = weightedTotalCount > 0 ? weightedMatchCount / weightedTotalCount : 0;
  const score = Math.round(matchRatio * WEIGHTS.TECHNOLOGY);

  return { score, matched, missing };
}

function calculateExperienceScore(
  userProfileLevel: ExperienceLevel,
  vacancyLevel: ExperienceLevel,
): { score: number; reason: string } {
  const profileOrder = EXPERIENCE_LEVEL_ORDER[userProfileLevel];
  const vacancyOrder = EXPERIENCE_LEVEL_ORDER[vacancyLevel];
  const diff = Math.abs(profileOrder - vacancyOrder);

  if (diff === 0) {
    return { score: WEIGHTS.EXPERIENCE, reason: 'Experience level matches exactly' };
  }
  if (diff === 1) {
    return { score: 10, reason: 'Experience level close match' };
  }
  if (diff === 2) {
    return { score: 5, reason: 'Experience level somewhat different' };
  }
  return { score: 5, reason: 'Experience level mismatch' };
}

function normalizeSalaryToYearly(
  min: number | undefined,
  max: number | undefined,
  period: string | undefined,
): { min: number; max: number } {
  const multipliers: Record<string, number> = {
    monthly: 12,
    yearly: 1,
    hourly: 2080,
  };

  const multiplier = multipliers[period ?? 'yearly'] ?? 1;
  const effectiveMin = min ?? 0;
  const effectiveMax = max ?? Infinity;

  return {
    min: effectiveMin * multiplier,
    max: effectiveMax === Infinity ? Infinity : effectiveMax * multiplier,
  };
}

function calculateSalaryScore(
  vacancySalary: Salary | undefined,
  userSalary: Salary | undefined,
): { score: number; reason: string } {
  if (!userSalary) {
    return { score: Math.round(WEIGHTS.SALARY * 0.5), reason: 'No salary preference specified' };
  }

  if (!vacancySalary) {
    return { score: Math.round(WEIGHTS.SALARY * 0.3), reason: 'Salary not listed' };
  }

  const userYearly = normalizeSalaryToYearly(userSalary.min, userSalary.max, userSalary.period);
  const vacancyYearly = normalizeSalaryToYearly(vacancySalary.min, vacancySalary.max, vacancySalary.period);

  if (vacancyYearly.min >= userYearly.min && vacancyYearly.max <= userYearly.max) {
    return { score: WEIGHTS.SALARY, reason: 'Salary within expected range' };
  }

  if (vacancyYearly.min >= userYearly.min) {
    return { score: Math.round(WEIGHTS.SALARY * 0.8), reason: 'Salary meets minimum expectation' };
  }

  if (vacancyYearly.max >= userYearly.min) {
    return { score: Math.round(WEIGHTS.SALARY * 0.5), reason: 'Salary partially meets expectation' };
  }

  return { score: Math.round(WEIGHTS.SALARY * 0.2), reason: 'Salary below expectation' };
}

function calculateRemoteLocationScore(
  vacancyRemote: string,
  vacancyLocation: string | undefined,
  userDesiredLocations: readonly string[],
  isRemoteOnly: boolean,
): { score: number; reason: string } {
  const remoteUpper = vacancyRemote.toUpperCase();

  if (isRemoteOnly) {
    if (remoteUpper === 'REMOTE') {
      return { score: WEIGHTS.REMOTE_LOCATION, reason: 'Remote position as requested' };
    }
    if (remoteUpper === 'HYBRID') {
      return { score: 3, reason: 'Hybrid position (not fully remote)' };
    }
    return { score: 0, reason: 'Not a remote position' };
  }

  if (remoteUpper === 'REMOTE') {
    return { score: WEIGHTS.REMOTE_LOCATION, reason: 'Remote position available' };
  }

  if (remoteUpper === 'HYBRID') {
    if (userDesiredLocations.length === 0) {
      return { score: Math.round(WEIGHTS.REMOTE_LOCATION * 0.7), reason: 'Hybrid position' };
    }
    if (vacancyLocation) {
      const locLower = normalizeString(vacancyLocation);
      for (const loc of userDesiredLocations) {
        if (locLower.includes(normalizeString(loc))) {
          return { score: WEIGHTS.REMOTE_LOCATION, reason: 'Hybrid in desired location' };
        }
      }
    }
    return { score: Math.round(WEIGHTS.REMOTE_LOCATION * 0.5), reason: 'Hybrid in different location' };
  }

  if (remoteUpper === 'ONSITE') {
    if (userDesiredLocations.length === 0) {
      return { score: Math.round(WEIGHTS.REMOTE_LOCATION * 0.5), reason: 'Onsite position' };
    }
    if (vacancyLocation) {
      const locLower = normalizeString(vacancyLocation);
      for (const loc of userDesiredLocations) {
        if (locLower.includes(normalizeString(loc))) {
          return { score: WEIGHTS.REMOTE_LOCATION, reason: 'Onsite in desired location' };
        }
      }
    }
    return { score: Math.round(WEIGHTS.REMOTE_LOCATION * 0.2), reason: 'Onsite in different location' };
  }

  return { score: Math.round(WEIGHTS.REMOTE_LOCATION * 0.5), reason: 'Location unknown' };
}

function calculateProviderQualityScore(qualityScore: number | undefined): { score: number; reason: string } {
  if (qualityScore === undefined || qualityScore === null) {
    return { score: 2, reason: 'Provider quality unknown' };
  }

  const normalizedScore = Math.min(10, Math.max(0, Math.round(qualityScore / 10)));

  if (normalizedScore >= 8) {
    const score = Math.round((normalizedScore / 10) * WEIGHTS.PROVIDER_QUALITY);
    return { score, reason: 'High-quality job source' };
  }
  if (normalizedScore >= 5) {
    const score = Math.round((normalizedScore / 10) * WEIGHTS.PROVIDER_QUALITY);
    return { score, reason: 'Moderate-quality job source' };
  }
  const score = Math.max(1, Math.round((normalizedScore / 10) * WEIGHTS.PROVIDER_QUALITY));
  return { score, reason: 'Lower-quality job source' };
}

function buildFactors(
  roleResult: { score: number; reason: string },
  techResult: { score: number; matched: string[]; missing: string[] },
  expResult: { score: number; reason: string },
  salaryResult: { score: number; reason: string },
  locationResult: { score: number; reason: string },
  providerResult: { score: number; reason: string },
): { positiveFactors: RankingFactor[]; negativeFactors: RankingFactor[] } {
  const positiveFactors: RankingFactor[] = [];
  const negativeFactors: RankingFactor[] = [];

  if (roleResult.score > 0) {
    const impact = roleResult.score >= WEIGHTS.ROLE * 0.7 ? 'positive' : 'neutral';
    positiveFactors.push({
      name: 'Role match',
      score: roleResult.score,
      maxScore: WEIGHTS.ROLE,
      impact,
      description: roleResult.reason,
    });
  } else {
    negativeFactors.push({
      name: 'Role mismatch',
      score: 0,
      maxScore: WEIGHTS.ROLE,
      impact: 'negative',
      description: roleResult.reason,
    });
  }

  if (techResult.matched.length > 0) {
    positiveFactors.push({
      name: 'Technology match',
      score: techResult.score,
      maxScore: WEIGHTS.TECHNOLOGY,
      impact: techResult.matched.length >= 3 ? 'positive' : 'neutral',
      description: `Matched: ${techResult.matched.join(', ')}`,
    });
  }

  if (techResult.missing.length > 0 && techResult.matched.length === 0) {
    negativeFactors.push({
      name: 'Technology gap',
      score: 0,
      maxScore: WEIGHTS.TECHNOLOGY,
      impact: 'negative',
      description: `Missing: ${techResult.missing.join(', ')}`,
    });
  }

  if (expResult.score > 0) {
    positiveFactors.push({
      name: 'Experience match',
      score: expResult.score,
      maxScore: WEIGHTS.EXPERIENCE,
      impact: expResult.score === WEIGHTS.EXPERIENCE ? 'positive' : 'neutral',
      description: expResult.reason,
    });
  } else {
    negativeFactors.push({
      name: 'Experience mismatch',
      score: 0,
      maxScore: WEIGHTS.EXPERIENCE,
      impact: 'negative',
      description: expResult.reason,
    });
  }

  if (salaryResult.score > 0) {
    positiveFactors.push({
      name: 'Salary match',
      score: salaryResult.score,
      maxScore: WEIGHTS.SALARY,
      impact: salaryResult.score === WEIGHTS.SALARY ? 'positive' : 'neutral',
      description: salaryResult.reason,
    });
  } else {
    negativeFactors.push({
      name: 'Salary mismatch',
      score: 0,
      maxScore: WEIGHTS.SALARY,
      impact: 'negative',
      description: salaryResult.reason,
    });
  }

  if (locationResult.score > 0) {
    positiveFactors.push({
      name: 'Location match',
      score: locationResult.score,
      maxScore: WEIGHTS.REMOTE_LOCATION,
      impact: locationResult.score === WEIGHTS.REMOTE_LOCATION ? 'positive' : 'neutral',
      description: locationResult.reason,
    });
  } else {
    negativeFactors.push({
      name: 'Location mismatch',
      score: 0,
      maxScore: WEIGHTS.REMOTE_LOCATION,
      impact: 'negative',
      description: locationResult.reason,
    });
  }

  if (providerResult.score > 0) {
    positiveFactors.push({
      name: 'Provider quality',
      score: providerResult.score,
      maxScore: WEIGHTS.PROVIDER_QUALITY,
      impact: providerResult.score >= WEIGHTS.PROVIDER_QUALITY * 0.7 ? 'positive' : 'neutral',
      description: providerResult.reason,
    });
  }

  return { positiveFactors, negativeFactors };
}

export function calculateRankingScore(input: RankingInput): RankingResult {
  const { vacancy, searchProfile, providerQualityScore, preferenceBoosts, interactionBoost, qualityScore, freshnessScore } = input;

  const roleResult = calculateRoleScore(vacancy.title, searchProfile.desiredPositions);

  const userTechnologies = searchProfile.desiredTechnologies.map((t) => normalizeTechnology(t.name));

  let vacancyTechnologies = vacancy.technologies.map((t) => normalizeTechnology(t.name));

  if (vacancyTechnologies.length === 0) {
    const fromTitle = extractTechnologiesFromText(vacancy.title);
    const fromRequirements = extractTechnologiesFromText(vacancy.requirements.join(' '));
    const fromDescription = extractTechnologiesFromText(vacancy.description.slice(0, 500));
    vacancyTechnologies = Array.from(new Set([...fromTitle, ...fromRequirements, ...fromDescription]));
  }

  const techResult = calculateTechnologyScore(userTechnologies, vacancyTechnologies, roleResult.vacancyRole);

  const expResult = calculateExperienceScore(
    searchProfile.experienceLevel,
    vacancy.experienceLevel,
  );

  const salaryResult = calculateSalaryScore(vacancy.salary, searchProfile.desiredSalary);

  const locationResult = calculateRemoteLocationScore(
    vacancy.location.workMode,
    vacancy.location.city,
    searchProfile.desiredLocations.map((l) => l.city ?? l.country ?? ''),
    searchProfile.isRemoteOnly,
  );

  const providerResult = calculateProviderQualityScore(providerQualityScore);

  let personalizationBoost = 0;
  const personalizationReasons: string[] = [];

  if (preferenceBoosts) {
    const { boost, reasons } = calculatePersonalizationBoost(
      {
        userId: '' as unknown as UserId,
        vacancy,
        searchProfile,
        interactionRepository: null as unknown as UserVacancyInteractionRepository,
      },
      preferenceBoosts,
    );
    personalizationBoost = boost;
    personalizationReasons.push(...reasons);
  }

  const careerFitScore = Math.min(100, Math.round(
    roleResult.score +
    techResult.score +
    expResult.score +
    salaryResult.score +
    locationResult.score +
    providerResult.score,
  ));

  const interestScore = Math.min(100, Math.max(0, Math.round(
    (personalizationBoost + 20) * 2.5 +
    (interactionBoost ?? 0),
  )));

  const hasRoleMismatch = roleResult.score === 0;
  const careerFitPenalty = hasRoleMismatch ? 0.5 : 1.0;

  const quality = qualityScore ?? 50;
  const freshness = freshnessScore ?? 50;

  const totalScore = Math.min(100, Math.round(
    careerFitScore * 0.7 * careerFitPenalty +
    interestScore * 0.1 +
    quality * 0.1 +
    freshness * 0.1,
  ));

  const reasons: string[] = [];

  if (roleResult.reason) reasons.push(roleResult.reason);
  for (const matched of techResult.matched) {
    reasons.push(`${matched} matches`);
  }
  if (techResult.missing.length > 0) {
    reasons.push(`Missing: ${techResult.missing.join(', ')}`);
  }
  reasons.push(expResult.reason);
  reasons.push(salaryResult.reason);
  reasons.push(locationResult.reason);
  reasons.push(providerResult.reason);
  reasons.push(...personalizationReasons);

  const { positiveFactors, negativeFactors } = buildFactors(
    roleResult,
    techResult,
    expResult,
    salaryResult,
    locationResult,
    providerResult,
  );

  const tier = classifyTier(totalScore);

  const explanation = buildExplanation(
    totalScore,
    tier,
    positiveFactors,
    negativeFactors,
    vacancy,
    providerQualityScore,
    freshnessScore,
  );

  return {
    score: totalScore,
    tier,
    interestScore,
    careerFitScore,
    matchedSkills: techResult.matched,
    missingSkills: techResult.missing,
    reasons,
    positiveFactors,
    negativeFactors,
    explanation,
  };
}

export class VacancyRankingService {
  rankVacancies(
    vacancies: readonly Vacancy[],
    searchProfile: SearchProfile,
    providerQualityScores?: Map<string, number>,
    vacancyProviderTypes?: Map<string, string>,
    preferenceBoosts?: PreferenceBoosts,
    interactions?: Array<{ action: string; vacancyId: string }>,
  ): Array<{ vacancy: Vacancy; result: RankingResult }> {
    const computedProviderScores = new Map<string, number>();
    const interactionBoostByVacancyId = interactions ? buildInteractionBoostMap(interactions) : undefined;

    const results = vacancies.map((vacancy) => {
      let providerType: string | undefined;
      if (vacancyProviderTypes) {
        providerType = vacancyProviderTypes.get(vacancy.id.toString());
      }

      let qualityScore = providerType !== undefined
        ? providerQualityScores?.get(providerType)
        : undefined;

      if (qualityScore === undefined && providerType && !computedProviderScores.has(providerType)) {
        const providerVacancies = vacancies.filter(
          (v) => vacancyProviderTypes?.get(v.id.toString()) === providerType,
        );
        const computed = calculateProviderQualityFromVacancies(providerVacancies);
        computedProviderScores.set(providerType, computed.total);
        qualityScore = computed.total;
      } else if (qualityScore === undefined && providerType) {
        qualityScore = computedProviderScores.get(providerType);
      }

      const vacancyQuality = calculateVacancyQualityScore(vacancy, undefined, qualityScore);

      const interactionBoost = interactionBoostByVacancyId?.get(vacancy.id as string);

      const result = calculateRankingScore({
        vacancy,
        searchProfile,
        providerQualityScore: qualityScore,
        preferenceBoosts,
        interactionBoost,
        qualityScore: vacancyQuality.total,
        freshnessScore: vacancyQuality.freshness,
      });

      return { vacancy, result };
    });

    results.sort((a, b) => b.result.score - a.result.score);

    return results;
  }
}
