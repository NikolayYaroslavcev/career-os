export interface RemotiveJob {
  readonly id: number;
  readonly url: string;
  readonly title: string;
  readonly company_name: string;
  readonly company_logo: string | null;
  readonly tags: readonly string[];
  readonly job_type: string;
  readonly publication_date: string;
  readonly description: string;
  readonly salary: string;
  readonly required_experience: string;
  readonly candidate_required_location: string;
  readonly category: string;
}

export interface RemotiveApiResponse {
  readonly jobs: readonly RemotiveJob[];
  readonly job_count: number;
  readonly query?: string;
}
