import type { NormalizedVacancy } from '@careeros/providers';

/**
 * Companies whose vacancies must never be created or shown, regardless of
 * which provider surfaces them. Proxify AB rejected the workspace owner's
 * application; their account page states re-application isn't possible
 * before 2027-01-27, so Proxify listings (currently arriving via
 * working_nomads) have no practical value until then. Not a VacancySource
 * exclusion (see vacancy-source.ts's WELLFOUND/OTTA) because Proxify was
 * never a provider — it's a company surfaced through a general aggregator.
 *
 * Lemon.io is a developer staffing marketplace, not a direct employer: its
 * listings (confirmed arriving via remotive, working_nomads, and telegram —
 * 262 rows in the dev DB, none tagged as a distinct provider) are generic
 * contractor postings ("Senior React Full-stack Developer", "Senior
 * Blockchain Developer") reposted identically across every aggregator that
 * carries them, so they compete for recommendation slots without
 * representing an actual hiring company.
 */
const EXCLUDED_COMPANY_NAMES = new Set(['proxify', 'lemon.io']);

export function isExcludedCompanyName(name: string | null | undefined): boolean {
  if (!name) return false;
  return EXCLUDED_COMPANY_NAMES.has(name.trim().toLowerCase());
}

export function filterExcludedCompanies(vacancies: readonly NormalizedVacancy[]): NormalizedVacancy[] {
  return vacancies.filter((vacancy) => !isExcludedCompanyName(vacancy.companyName));
}
