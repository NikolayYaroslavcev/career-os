// Real api.hh.ru vacancy shapes (https://github.com/hhru/api/blob/master/docs/vacancies.md).
// The search/list endpoint (`GET /vacancies`) never returns a full `description` or a
// `skills`/`key_skills` array — those only exist on the detail endpoint
// (`GET /vacancies/{id}`). Conflating the two shapes was the root cause of HH returning
// zero vacancies: the old types modeled a `title`/`description`/`skills` shape that never
// matches a real list-endpoint response.

export interface HHEmployer {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly alternate_url: string;
  readonly logo_urls?: {
    readonly original?: string;
    readonly small?: string;
    readonly medium?: string;
  };
  readonly vacancies_url: string;
  readonly trusted: boolean;
}

export interface HHArea {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly parent_id?: string;
}

export interface HHSalary {
  readonly from: number | null;
  readonly to: number | null;
  readonly currency: string;
  readonly gross: boolean;
}

export interface HHNamedEntity {
  readonly id: string;
  readonly name: string;
}

export interface HHAddress {
  readonly city?: string;
  readonly street?: string;
  readonly building?: string;
  readonly description?: string;
  readonly lat?: number;
  readonly lng?: number;
}

export interface HHSnippet {
  readonly requirement: string | null;
  readonly responsibility: string | null;
}

export interface HHKeySkill {
  readonly name: string;
}

/**
 * Shape returned by `GET /vacancies` (search results). No `description` and no
 * `key_skills` field exists here — only the truncated `snippet`.
 */
export interface HHVacancyListItem {
  readonly id: string;
  readonly premium: boolean;
  readonly name: string;
  readonly area: HHArea;
  readonly salary: HHSalary | null;
  readonly address?: HHAddress | null;
  readonly response_letter_required: boolean;
  readonly published_at: string;
  readonly created_at: string;
  readonly archived?: boolean;
  readonly url: string;
  readonly alternate_url: string;
  readonly employer: HHEmployer;
  readonly snippet: HHSnippet | null;
  readonly schedule: HHNamedEntity;
  readonly accept_temporary: boolean;
  readonly professional_roles?: readonly HHNamedEntity[];
  readonly experience: HHNamedEntity;
  readonly employment: HHNamedEntity;
}

/**
 * Shape returned by `GET /vacancies/{id}` (detail endpoint). Adds the full HTML
 * `description` and `key_skills` that the list endpoint never provides.
 */
export interface HHVacancyDetail extends HHVacancyListItem {
  readonly description: string;
  readonly key_skills: readonly HHKeySkill[];
}

export interface HHVacancyListResponse {
  readonly items: readonly HHVacancyListItem[];
  readonly found: number;
  readonly pages: number;
  readonly per_page: number;
  readonly page: number;
}

export interface HHSearchParams {
  text?: string;
  area?: string;
  employment?: string;
  schedule?: string;
  experience?: string;
  salary?: number;
  currency?: string;
  only_with_salary?: boolean;
  page?: number;
  per_page?: number;
  order_by?: string;
  search_field?: string;
  industries?: string;
  type?: string;
  professional_role?: string;
}
