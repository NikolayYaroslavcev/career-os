import type { Vacancy } from '../entities/vacancy.js';
import type { Source as VacancySourceEntity } from '../entities/vacancy-source.js';

export interface CanonicalMatchCandidate {
  vacancy: Vacancy;
  sources: VacancySourceEntity[];
  score: number;
  matchedFields: string[];
}

export interface CanonicalMatchResult {
  isDuplicate: boolean;
  canonicalVacancyId?: string;
  matchScore: number;
  matchedFields: string[];
  shouldMerge: boolean;
}

export interface CanonicalMatchingService {
  findCanonicalMatch(
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
    workspaceId: string
  ): Promise<CanonicalMatchResult>;

  computeMatchScore(
    a: { title: string; companyName: string; location?: string; remote?: string; employmentType?: string; salaryMin?: number; salaryMax?: number },
    b: { title: string; companyName: string; location?: string; remote?: string; employmentType?: string; salaryMin?: number; salaryMax?: number }
  ): number;
}
