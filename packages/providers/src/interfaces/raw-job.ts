export interface RawJob {
  readonly sourceId: string;
  readonly title: string;
  readonly description: string;
  readonly companyName: string;
  readonly companySourceId?: string;
  readonly location: string;
  readonly salary?: RawSalary;
  readonly experienceLevel?: string;
  readonly technologies: readonly string[];
  readonly url: string;
  readonly publishedAt: Date;
  readonly remote?: boolean;
  readonly employmentType?: string;
  readonly fetchedAt: Date;
  readonly extensions?: Record<string, unknown>;
}

export interface RawSalary {
  readonly from?: number;
  readonly to?: number;
  readonly currency: string;
  readonly period: 'hourly' | 'monthly' | 'yearly' | 'unknown';
}
