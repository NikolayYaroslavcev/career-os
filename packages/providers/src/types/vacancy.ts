export type ExperienceLevel =
  | 'intern'
  | 'junior'
  | 'middle'
  | 'senior'
  | 'lead'
  | 'principal';

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'freelance'
  | 'internship';

export type RemoteLevel = 'remote_only' | 'hybrid' | 'onsite' | 'unknown';

export interface LocationInfo {
  readonly raw: string;
  readonly city?: string;
  readonly country?: string;
  readonly remoteEligible: boolean;
}

export interface SalaryInfo {
  readonly min?: number;
  readonly max?: number;
  readonly originalCurrency?: string;
  readonly originalMin?: number;
  readonly originalMax?: number;
  readonly period: 'monthly';
  readonly isEstimate: boolean;
}

export interface RemoteInfo {
  readonly level: RemoteLevel;
  readonly explicit: boolean;
}
