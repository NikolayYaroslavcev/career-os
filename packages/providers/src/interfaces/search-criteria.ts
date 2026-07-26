import type { ExperienceLevel } from '../types/vacancy.js';
import type { SyncCursor } from './sync-cursor.js';

export interface SearchCriteria {
  readonly query?: string;
  readonly positions?: readonly string[];
  readonly technologies?: readonly string[];
  readonly location?: string;
  readonly remoteOnly?: boolean;
  readonly experienceLevel?: {
    readonly min?: ExperienceLevel;
    readonly max?: ExperienceLevel;
  };
  readonly salary?: {
    readonly min?: number;
    readonly max?: number;
  };
  readonly cursor?: SyncCursor;
  readonly limit?: number;
  readonly sort?: {
    readonly field: 'date' | 'relevance' | 'salary';
    readonly order: 'asc' | 'desc';
  };
  readonly publishedAfter?: Date;
  readonly filters?: Record<string, unknown>;
}
