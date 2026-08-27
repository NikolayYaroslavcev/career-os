export interface RawJob {
  readonly sourceId: string;
  readonly title: string;
  readonly description: string;
  readonly companyName: string;
  readonly companySourceId?: string;
  readonly companyUrl?: string;
  readonly location: string;
  readonly salary?: RawSalary;
  readonly experienceLevel?: string;
  readonly technologies: readonly string[];
  // Optional because a LinkedIn Feed post can have no working URL at all
  // (no job card, no in-text link, and LinkedIn's SDUI feed markup exposes no
  // real post permalink) — every other provider still always supplies one.
  readonly url?: string;
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
