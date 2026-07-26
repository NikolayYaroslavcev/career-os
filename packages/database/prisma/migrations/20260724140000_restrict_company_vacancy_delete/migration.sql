-- Company -> Vacancy was ON DELETE CASCADE, meaning deleting a Company
-- silently deleted every one of its Vacancy rows (and transitively, via
-- Vacancy's own cascades, their MatchResults, Applications, VacancySources,
-- etc). Every other optional inbound relation on Company (Application,
-- Recruiter) already uses SetNull; Vacancy was the dangerous outlier. Since
-- Vacancy.companyId is required (non-optional), SetNull isn't valid here —
-- Restrict simply blocks deleting a Company that still has vacancies,
-- forcing an explicit decision (reassign or bulk-delete vacancies first)
-- instead of an accidental silent cascade.

ALTER TABLE "Vacancy" DROP CONSTRAINT "Vacancy_companyId_fkey";

ALTER TABLE "Vacancy" ADD CONSTRAINT "Vacancy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
