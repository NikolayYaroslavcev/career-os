import type { Vacancy } from '@careeros/career';

export interface ProviderQualityBreakdown {
  readonly salaryAvailability: number;
  readonly companyAvailability: number;
  readonly applyUrlAvailability: number;
  readonly descriptionQuality: number;
  readonly freshness: number;
  readonly duplicateRate: number;
  readonly total: number;
}

const WEIGHTS = {
  SALARY_AVAILABILITY: 20,
  COMPANY_AVAILABILITY: 10,
  APPLY_URL_AVAILABILITY: 15,
  DESCRIPTION_QUALITY: 20,
  FRESHNESS: 20,
  DUPLICATE_RATE: 15,
} as const;

function calculateDescriptionQualityScore(description: string): number {
  if (!description) return 0;
  const length = description.length;
  if (length < 50) return 20;
  if (length < 100) return 40;
  if (length < 200) return 60;
  if (length < 500) return 80;
  return 100;
}

function calculateFreshnessScore(vacancies: readonly Vacancy[], now: Date): number {
  if (vacancies.length === 0) return 0;

  let totalFreshness = 0;
  for (const vacancy of vacancies) {
    if (!vacancy.publishedAt) {
      totalFreshness += 30;
      continue;
    }
    const daysSincePublished = (now.getTime() - vacancy.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePublished <= 1) totalFreshness += 100;
    else if (daysSincePublished <= 3) totalFreshness += 90;
    else if (daysSincePublished <= 7) totalFreshness += 75;
    else if (daysSincePublished <= 14) totalFreshness += 60;
    else if (daysSincePublished <= 30) totalFreshness += 40;
    else if (daysSincePublished <= 60) totalFreshness += 20;
    else totalFreshness += 10;
  }

  return Math.round(totalFreshness / vacancies.length);
}

function calculateDuplicateRate(vacancies: readonly Vacancy[]): number {
  if (vacancies.length === 0) return 100;

  const titles = new Map<string, number>();
  for (const vacancy of vacancies) {
    const normalizedTitle = vacancy.title.toLowerCase().trim();
    titles.set(normalizedTitle, (titles.get(normalizedTitle) ?? 0) + 1);
  }

  let duplicates = 0;
  for (const count of titles.values()) {
    if (count > 1) duplicates += count - 1;
  }

  const duplicateRatio = duplicates / vacancies.length;
  return Math.round((1 - duplicateRatio) * 100);
}

export function calculateProviderQualityFromVacancies(
  vacancies: readonly Vacancy[],
  now?: Date,
): ProviderQualityBreakdown {
  const referenceDate = now ?? new Date();

  if (vacancies.length === 0) {
    return {
      salaryAvailability: 0,
      companyAvailability: 0,
      applyUrlAvailability: 0,
      descriptionQuality: 0,
      freshness: 0,
      duplicateRate: 100,
      total: 0,
    };
  }

  const withSalary = vacancies.filter((v) => v.salary).length;
  const withCompany = vacancies.filter((v) => v.companyId).length;

  const salaryAvailability = Math.round((withSalary / vacancies.length) * 100);
  const companyAvailability = Math.round((withCompany / vacancies.length) * 100);

  let totalDescQuality = 0;
  for (const vacancy of vacancies) {
    totalDescQuality += calculateDescriptionQualityScore(vacancy.description);
  }
  const descriptionQuality = Math.round(totalDescQuality / vacancies.length);

  const freshness = calculateFreshnessScore(vacancies, referenceDate);
  const duplicateRate = calculateDuplicateRate(vacancies);

  const total = Math.round(
    (salaryAvailability / 100) * WEIGHTS.SALARY_AVAILABILITY +
    (companyAvailability / 100) * WEIGHTS.COMPANY_AVAILABILITY +
    // Apply URL not available from Vacancy entity, use 50 as neutral default
    (50 / 100) * WEIGHTS.APPLY_URL_AVAILABILITY +
    (descriptionQuality / 100) * WEIGHTS.DESCRIPTION_QUALITY +
    (freshness / 100) * WEIGHTS.FRESHNESS +
    (duplicateRate / 100) * WEIGHTS.DUPLICATE_RATE,
  );

  return {
    salaryAvailability,
    companyAvailability,
    applyUrlAvailability: 50,
    descriptionQuality,
    freshness,
    duplicateRate,
    total: Math.min(100, Math.max(0, total)),
  };
}
