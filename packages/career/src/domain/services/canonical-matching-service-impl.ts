import type { Vacancy } from '../entities/vacancy.js';
import type { CanonicalMatchingService, CanonicalMatchResult } from './canonical-matching-service.js';

function normalizeForMatching(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

function computeLevenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0]![j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return 1 - matrix[a.length]![b.length]! / maxLen;
}

function salaryOverlap(
  aMin?: number, aMax?: number,
  bMin?: number, bMax?: number
): number {
  if (aMin === undefined && aMax === undefined) return 0.5;
  if (bMin === undefined && bMax === undefined) return 0.5;

  const aLo = aMin ?? 0;
  const aHi = aMax ?? aMin ?? Infinity;
  const bLo = bMin ?? 0;
  const bHi = bMax ?? bMin ?? Infinity;

  const overlapStart = Math.max(aLo, bLo);
  const overlapEnd = Math.min(aHi, bHi);

  if (overlapStart <= overlapEnd) return 1.0;

  const gap = overlapStart - overlapEnd;
  const range = Math.max(aHi, bHi) - Math.min(aLo, bLo);
  if (range === 0) return 0;

  return Math.max(0, 1 - gap / range);
}

const MATCH_WEIGHTS = {
  title: 0.30,
  company: 0.30,
  location: 0.15,
  remote: 0.10,
  employmentType: 0.05,
  salary: 0.10,
} as const;

const MATCH_THRESHOLD = 0.75;

export class CanonicalMatchingServiceImpl implements CanonicalMatchingService {
  computeMatchScore(
    a: { title: string; companyName: string; location?: string; remote?: string; employmentType?: string; salaryMin?: number; salaryMax?: number },
    b: { title: string; companyName: string; location?: string; remote?: string; employmentType?: string; salaryMin?: number; salaryMax?: number }
  ): number {
    const titleA = normalizeForMatching(a.title);
    const titleB = normalizeForMatching(b.title);
    const titleScore = computeLevenshteinSimilarity(titleA, titleB);

    const companyA = normalizeForMatching(a.companyName);
    const companyB = normalizeForMatching(b.companyName);
    const companyScore = computeLevenshteinSimilarity(companyA, companyB);

    let locationScore = 0.5;
    if (a.location && b.location) {
      const locA = normalizeForMatching(a.location);
      const locB = normalizeForMatching(b.location);
      locationScore = computeLevenshteinSimilarity(locA, locB);
    }

    let remoteScore = 0.5;
    if (a.remote && b.remote) {
      remoteScore = a.remote.toLowerCase() === b.remote.toLowerCase() ? 1.0 : 0.0;
    }

    let empScore = 0.5;
    if (a.employmentType && b.employmentType) {
      empScore = a.employmentType === b.employmentType ? 1.0 : 0.0;
    }

    const salaryScore = salaryOverlap(a.salaryMin, a.salaryMax, b.salaryMin, b.salaryMax);

    return (
      titleScore * MATCH_WEIGHTS.title +
      companyScore * MATCH_WEIGHTS.company +
      locationScore * MATCH_WEIGHTS.location +
      remoteScore * MATCH_WEIGHTS.remote +
      empScore * MATCH_WEIGHTS.employmentType +
      salaryScore * MATCH_WEIGHTS.salary
    );
  }

  async findCanonicalMatch(
    candidate: {
      title: string;
      companyName: string;
      location?: string;
      remote?: string;
      employmentType?: string;
      salaryMin?: number;
      salaryMax?: number;
      description?: string;
    },
    existingVacancies: Vacancy[],
    _workspaceId: string
  ): Promise<CanonicalMatchResult> {
    let bestScore = 0;
    let bestMatch: Vacancy | null = null;
    let bestFields: string[] = [];

    for (const existing of existingVacancies) {
      const score = this.computeMatchScore(
        candidate,
        {
          title: existing.title,
          companyName: existing.description,
          location: existing.location.city,
          remote: existing.location.workMode,
          employmentType: existing.employmentType,
          salaryMin: existing.salary?.min,
          salaryMax: existing.salary?.max,
        }
      );

      if (score > bestScore) {
        bestScore = score;
        bestMatch = existing;
        bestFields = this.getMatchedFields(candidate, existing);
      }
    }

    const isDuplicate = bestScore >= MATCH_THRESHOLD;

    return {
      isDuplicate,
      canonicalVacancyId: isDuplicate && bestMatch ? bestMatch.id : undefined,
      matchScore: bestScore,
      matchedFields: bestFields,
      shouldMerge: isDuplicate && bestScore < 0.95,
    };
  }

  private getMatchedFields(
    candidate: { title: string; companyName: string; location?: string; remote?: string; employmentType?: string },
    existing: Vacancy
  ): string[] {
    const fields: string[] = [];

    const titleSim = computeLevenshteinSimilarity(
      normalizeForMatching(candidate.title),
      normalizeForMatching(existing.title)
    );
    if (titleSim > 0.8) fields.push('title');

    const companySim = computeLevenshteinSimilarity(
      normalizeForMatching(candidate.companyName),
      normalizeForMatching(existing.description)
    );
    if (companySim > 0.8) fields.push('company');

    if (candidate.location && existing.location.city) {
      const locSim = computeLevenshteinSimilarity(
        normalizeForMatching(candidate.location),
        normalizeForMatching(existing.location.city)
      );
      if (locSim > 0.8) fields.push('location');
    }

    if (candidate.remote && candidate.remote.toLowerCase() === existing.location.workMode) {
      fields.push('remote');
    }

    if (candidate.employmentType && candidate.employmentType === existing.employmentType) {
      fields.push('employmentType');
    }

    return fields;
  }
}
