import type { NormalizedVacancy } from '../interfaces/normalized-vacancy.js';
import { normalizeForMatching, computeLevenshteinSimilarity } from '@careeros/shared';

export interface DeduplicationConfig {
  readonly keyFields: ReadonlyArray<keyof NormalizedVacancy>;
  readonly similarityThreshold: number;
  readonly timeWindowMs: number;
  /** Enable multi-field fuzzy matching across providers (default: true) */
  readonly enableFuzzyMatching?: boolean;
}

export interface DeduplicationResult {
  readonly unique: NormalizedVacancy[];
  readonly duplicates: DeduplicatedGroup[];
  readonly stats: DeduplicationStats;
}

export interface DeduplicatedGroup {
  readonly canonical: NormalizedVacancy;
  readonly all: NormalizedVacancy[];
  readonly sources: string[];
}

export interface DeduplicationStats {
  readonly totalInput: number;
  readonly uniqueOutput: number;
  readonly duplicatesFound: number;
  readonly durationMs: number;
}

export class DeduplicationEngine {
  private seenKeys = new Map<string, NormalizedVacancy>();
  private seenFuzzy = new Map<string, NormalizedVacancy[]>();

  constructor(private readonly config: DeduplicationConfig) {}

  deduplicate(jobs: NormalizedVacancy[]): DeduplicationResult {
    const startTime = Date.now();
    const unique: NormalizedVacancy[] = [];
    const duplicateGroups = new Map<string, DeduplicatedGroup>();

    for (const job of jobs) {
      const exactKey = this.generateExactKey(job);

      if (this.seenKeys.has(exactKey)) {
        const existing = this.seenKeys.get(exactKey)!;
        this.addToGroup(duplicateGroups, existing, job);
        continue;
      }

      if (this.config.enableFuzzyMatching !== false) {
        const fuzzyMatch = this.findFuzzyMatch(job);
        if (fuzzyMatch) {
          this.addToGroup(duplicateGroups, fuzzyMatch, job);
          continue;
        }
      }

      this.seenKeys.set(exactKey, job);
      unique.push(job);

      if (this.config.enableFuzzyMatching !== false) {
        this.addToFuzzyIndex(job);
      }
    }

    return {
      unique,
      duplicates: Array.from(duplicateGroups.values()),
      stats: {
        totalInput: jobs.length,
        uniqueOutput: unique.length,
        duplicatesFound: jobs.length - unique.length,
        durationMs: Date.now() - startTime,
      },
    };
  }

  private generateExactKey(job: NormalizedVacancy): string {
    const parts = this.config.keyFields.map((field) => {
      const value = job[field];
      if (typeof value === 'string') return value.toLowerCase().trim();
      if (Array.isArray(value)) return [...value].sort().join(',');
      return String(value);
    });
    return parts.join('::');
  }

  private findFuzzyMatch(job: NormalizedVacancy): NormalizedVacancy | null {
    const companyNormalized = normalizeForMatching(job.companyName);
    const titleNormalized = normalizeForMatching(job.title);

    for (const [fingerprint, candidates] of this.seenFuzzy) {
      const [fpCompany, fpTitle] = fingerprint.split('||');

      const companySimilarity = computeLevenshteinSimilarity(companyNormalized, fpCompany ?? '');
      if (companySimilarity < 0.7) continue;

      const titleSimilarity = computeLevenshteinSimilarity(titleNormalized, fpTitle ?? '');
      if (titleSimilarity < 0.6) continue;

      const combinedScore = companySimilarity * 0.5 + titleSimilarity * 0.5;
      if (combinedScore >= this.config.similarityThreshold) {
        return candidates[0] ?? null;
      }
    }

    return null;
  }

  private addToFuzzyIndex(job: NormalizedVacancy): void {
    const companyNormalized = normalizeForMatching(job.companyName);
    const titleNormalized = normalizeForMatching(job.title);
    const fingerprint = `${companyNormalized}||${titleNormalized}`;

    if (!this.seenFuzzy.has(fingerprint)) {
      this.seenFuzzy.set(fingerprint, []);
    }
    this.seenFuzzy.get(fingerprint)!.push(job);
  }

  private addToGroup(groups: Map<string, DeduplicatedGroup>, canonical: NormalizedVacancy, duplicate: NormalizedVacancy): void {
    const key = canonical.id;
    if (!groups.has(key)) {
      groups.set(key, { canonical, all: [canonical], sources: [canonical.source] });
    }
    const group = groups.get(key)!;
    group.all.push(duplicate);
    if (!group.sources.includes(duplicate.source)) {
      group.sources.push(duplicate.source);
    }
  }

  clear(): void {
    this.seenKeys.clear();
    this.seenFuzzy.clear();
  }
}
