/**
 * LinkedIn Guest API response types.
 *
 * The Guest API (`/jobs-guest/jobs/api/seeMoreJobPostings/search`) returns
 * HTML fragments, not JSON. These types model the HTML structure we parse
 * with cheerio.
 */

export interface LinkedInSearchParams {
  keywords?: string;
  location?: string;
  start?: number;
  sortBy?: 'DD' | 'R';
  f_TPR?: string;
  f_WT?: string;
}

export interface LinkedInJobCard {
  readonly jobId: string;
  readonly title: string;
  readonly company: string;
  readonly companyUrl?: string;
  readonly location: string;
  readonly url: string;
  readonly postedDate?: string;
  readonly applicants?: string;
}

export interface LinkedInJobDetail {
  readonly jobId: string;
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly description: string;
  readonly url: string;
  readonly postedDate?: string;
  readonly salary?: string;
  readonly employmentType?: string;
  readonly seniorityLevel?: string;
  readonly industries?: string;
  readonly skills: readonly string[];
}

export interface LinkedInIngestionPayload {
  readonly jobId: string;
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly description: string;
  readonly salary?: string;
  readonly skills?: readonly string[];
  readonly url: string;
  readonly postedDate?: string;
  readonly easyApply?: boolean;
}
