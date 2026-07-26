import type { Vacancy } from '@careeros/career';

export interface QualityScoreBreakdown {
  readonly companyExists: number;
  readonly salaryExists: number;
  readonly applyUrlExists: number;
  readonly descriptionQuality: number;
  readonly sourceReliability: number;
  readonly freshness: number;
  readonly total: number;
}

const WEIGHTS = {
  COMPANY_EXISTS: 15,
  SALARY_EXISTS: 15,
  APPLY_URL_EXISTS: 15,
  DESCRIPTION_QUALITY: 25,
  SOURCE_RELIABILITY: 15,
  FRESHNESS: 15,
} as const;

function calculateDescriptionQuality(description: string): number {
  if (!description) return 0;

  const length = description.length;
  if (length < 50) return 30;
  if (length < 100) return 50;
  if (length < 200) return 70;
  if (length < 500) return 85;
  return 100;
}

function calculateFreshness(publishedAt: Date | undefined, fetchedAt: Date): number {
  if (!publishedAt) return 30;

  const now = fetchedAt.getTime();
  const published = publishedAt.getTime();
  const daysSincePublished = (now - published) / (1000 * 60 * 60 * 24);

  if (daysSincePublished <= 1) return 100;
  if (daysSincePublished <= 3) return 90;
  if (daysSincePublished <= 7) return 75;
  if (daysSincePublished <= 14) return 60;
  if (daysSincePublished <= 30) return 40;
  if (daysSincePublished <= 60) return 20;
  return 10;
}

export function calculateVacancyQualityScore(
  vacancy: Vacancy,
  applyUrl?: string,
  providerQualityScore?: number,
  now?: Date,
): QualityScoreBreakdown {
  const companyExists = vacancy.companyId ? 100 : 0;
  const salaryExists = vacancy.salary ? 100 : 0;
  const applyUrlExists = applyUrl ? 100 : 0;
  const descriptionQuality = calculateDescriptionQuality(vacancy.description);
  const sourceReliability = providerQualityScore ?? 50;
  const referenceDate = now ?? new Date();
  const freshness = calculateFreshness(vacancy.publishedAt, referenceDate);

  const total = Math.round(
    (companyExists / 100) * WEIGHTS.COMPANY_EXISTS +
    (salaryExists / 100) * WEIGHTS.SALARY_EXISTS +
    (applyUrlExists / 100) * WEIGHTS.APPLY_URL_EXISTS +
    (descriptionQuality / 100) * WEIGHTS.DESCRIPTION_QUALITY +
    (sourceReliability / 100) * WEIGHTS.SOURCE_RELIABILITY +
    (freshness / 100) * WEIGHTS.FRESHNESS,
  );

  return {
    companyExists,
    salaryExists,
    applyUrlExists,
    descriptionQuality,
    sourceReliability,
    freshness,
    total: Math.min(100, Math.max(0, total)),
  };
}
