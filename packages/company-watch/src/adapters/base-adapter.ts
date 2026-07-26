import type { AtsType } from '../domain/value-objects/ats-type.js';

export interface AtsConfig {
  careerUrl: string;
  atsEndpoint?: string;
  metadata?: Record<string, unknown>;
}

export interface AtsJob {
  externalId: string;
  title: string;
  description: string;
  url: string;
  location?: string;
  salary?: { min?: number; max?: number; currency?: string };
  technologies?: string[];
  publishedAt?: Date;
  departments?: string[];
}

export interface AtsAdapter {
  readonly atsType: AtsType;
  fetchJobs(config: AtsConfig): Promise<AtsJob[]>;
  fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null>;
  ping(config: AtsConfig): Promise<boolean>;
}
