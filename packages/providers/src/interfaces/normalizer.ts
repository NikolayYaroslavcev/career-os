import type { MappedJob } from './mapper.js';
import type { NormalizedVacancy } from './normalized-vacancy.js';

export interface Normalizer {
  readonly providerId: string;
  normalize(job: MappedJob): NormalizedVacancy;
  validate(job: MappedJob): NormalizationError | null;
}

export interface NormalizationError {
  readonly field: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface NormalizationResult {
  readonly succeeded: NormalizedVacancy[];
  readonly failed: NormalizationFailure[];
  readonly stats: NormalizationStats;
}

export interface NormalizationFailure {
  readonly sourceId: string;
  readonly reason: string;
  readonly field?: string;
}

export interface NormalizationStats {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly durationMs: number;
}
