import type { RawJob } from './raw-job.js';

export interface Mapper {
  readonly providerId: string;
  map(raw: RawJob): MappedJob;
}

export interface MappedJob {
  readonly sourceId: string;
  readonly title: string;
  readonly description: string;
  readonly companyName: string;
  readonly companySourceId?: string;
  readonly location: {
    readonly raw: string;
    readonly city?: string;
    readonly country?: string;
  };
  readonly salary?: {
    readonly min?: number;
    readonly max?: number;
    readonly currency: string;
    readonly period: 'hourly' | 'monthly' | 'yearly' | 'unknown';
  };
  readonly experienceLevel?: string;
  readonly technologies: readonly string[];
  readonly url: string;
  readonly publishedAt: Date;
  readonly fetchedAt: Date;
  readonly remote?: boolean;
  readonly employmentType?: string;
  readonly extensions?: Record<string, unknown>;
}
