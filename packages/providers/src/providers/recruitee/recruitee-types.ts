export interface RecruiteeOffer {
  readonly id: number;
  readonly title: string;
  readonly description: string;
  readonly location: string;
  readonly remote: boolean;
  readonly salary_from: number | null;
  readonly salary_to: number | null;
  readonly employment_type: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly apply_url: string;
  readonly department: string | null;
  readonly team: string | null;
}

export interface RecruiteeResponse {
  readonly offers: readonly RecruiteeOffer[];
  readonly meta: {
    readonly total: number;
    readonly per_page: number;
    readonly current_page: number;
    readonly total_pages: number;
  };
}
