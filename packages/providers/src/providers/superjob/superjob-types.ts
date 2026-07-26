// api.superjob.ru vacancy shapes (https://api.superjob.ru/, /2.0/vacancies/ and /2.33/vacancies/
// both live — verified by direct request; the official HTML docs are geo/WAF-blocked from this
// environment). Field names below are cross-verified against several open-source SuperJob API
// clients (pySuperJob, LanguageSalary, ArkJzzz/language-salary) rather than the (inaccessible)
// official reference, so treat optional/nullable fields defensively — same posture as hh-types.ts.

export interface SJTown {
  readonly id: number;
  readonly title: string;
  readonly declension?: string;
}

export interface SJNamedEntity {
  readonly id: number;
  readonly title: string;
}

export interface SJClient {
  readonly id: number;
  readonly title: string;
  readonly town?: SJTown;
  readonly logo?: string | null;
}

/**
 * Shape returned by `GET /vacancies/` (search results), one item per `objects[]` entry.
 * `payment_from`/`payment_to` are `0` (not `null`) when unset — verified across every
 * independent client inspected. `firm_name` is always present (falls back to
 * "Индивидуальный предприниматель" for private/anonymous postings); `client`/`id_client`
 * are only present for postings tied to a registered employer profile.
 */
export interface SJVacancy {
  readonly id: number;
  readonly profession: string;
  readonly town?: SJTown;
  readonly firm_name: string;
  readonly id_client?: number | null;
  readonly client?: SJClient | null;
  readonly payment_from: number;
  readonly payment_to: number;
  readonly currency: string;
  readonly candidat?: string | null;
  readonly work?: string | null;
  readonly vacancyRichText?: string | null;
  readonly date_published: number;
  readonly link: string;
  readonly type_of_work?: SJNamedEntity | null;
  readonly place_of_work?: SJNamedEntity | null;
  readonly experience?: SJNamedEntity | null;
  readonly agreement?: boolean;
  readonly is_archive?: boolean;
}

export interface SJVacancyListResponse {
  readonly total: number;
  readonly more?: boolean;
  readonly objects: readonly SJVacancy[];
}

export interface SJErrorResponse {
  readonly error: {
    readonly code: number;
    readonly message: string;
    readonly error?: string | null;
  };
}

export interface SJSearchParams {
  keyword?: string;
  town?: number;
  catalogues?: number;
  payment_from?: number;
  payment_to?: number;
  page?: number;
  count?: number;
  no_agreement?: 0 | 1;
}
