export interface HimalayasJob {
  readonly guid?: string;
  readonly title?: string;
  readonly companyName?: string;
  readonly companySlug?: string;
  readonly companyLogo?: string;
  readonly employmentType?: string;
  readonly minSalary?: number | null;
  readonly maxSalary?: number | null;
  readonly currency?: string | null;
  readonly salaryPeriod?: string;
  readonly seniority?: readonly string[];
  readonly locationRestrictions?: readonly string[];
  readonly categories?: readonly string[];
  readonly parentCategories?: readonly string[];
  readonly description?: string;
  readonly excerpt?: string;
  readonly pubDate?: number;
  readonly applicationLink?: string;
}

export interface HimalayasApiResponse {
  readonly jobs: readonly HimalayasJob[];
  readonly totalCount: number;
  readonly offset: number;
  readonly limit: number;
}
