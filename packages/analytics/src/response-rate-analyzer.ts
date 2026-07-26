import type { PerformanceBreakdown, BreakdownSegment, DateRange } from './types.js';

interface ApplicationRecord {
  readonly status: string;
  readonly vacancyId: string;
}

interface VacancyRecord {
  readonly id: string;
  readonly country: string | null;
  readonly city: string | null;
  readonly remote: string;
  readonly salaryMin: number | null;
  readonly salaryMax: number | null;
  readonly currency: string | null;
  readonly experienceLevel: string | null;
  readonly source: string;
  readonly companyId: string;
  readonly technologies: readonly string[];
}

interface MatchResultRecord {
  readonly vacancyId: string;
  readonly overallScore: number;
}

interface CompanyRecord {
  readonly id: string;
  readonly name: string;
  readonly industry: string | null;
  readonly size: string | null;
}

function computeSegment(
  label: string,
  apps: readonly ApplicationRecord[],
  matchResults: Map<string, MatchResultRecord>,
): BreakdownSegment {
  const total = apps.length;
  const responded = apps.filter((a) => a.status !== 'saved' && a.status !== 'applied').length;
  const interviewApps = apps.filter((a) =>
    ['hr_interview', 'technical_interview', 'final_interview'].includes(a.status),
  );
  const offerApps = apps.filter((a) => a.status === 'offer');

  const matchScores = apps
    .map((a) => matchResults.get(a.vacancyId))
    .filter((m): m is MatchResultRecord => m !== undefined)
    .map((m) => m.overallScore);

  const avgMatchScore = matchScores.length > 0
    ? Math.round(matchScores.reduce((s, v) => s + v, 0) / matchScores.length)
    : 0;

  return {
    label,
    count: total,
    applications: total,
    interviews: interviewApps.length,
    offers: offerApps.length,
    responseRate: total > 0 ? Math.round((responded / total) * 10000) / 100 : 0,
    interviewRate: total > 0 ? Math.round((interviewApps.length / total) * 10000) / 100 : 0,
    offerRate: total > 0 ? Math.round((offerApps.length / total) * 10000) / 100 : 0,
    avgMatchScore,
  };
}

function groupByVacancyField(
  applications: readonly ApplicationRecord[],
  vacancies: Map<string, VacancyRecord>,
  select: (vacancy: VacancyRecord) => string,
): Map<string, ApplicationRecord[]> {
  const grouped = new Map<string, ApplicationRecord[]>();
  for (const app of applications) {
    const vacancy = vacancies.get(app.vacancyId);
    const key = vacancy ? select(vacancy) : 'Unknown';
    const existing = grouped.get(key) ?? [];
    grouped.set(key, [...existing, app]);
  }
  return grouped;
}

function toBreakdown(
  dimension: string,
  grouped: Map<string, ApplicationRecord[]>,
  matchResults: Map<string, MatchResultRecord>,
  period: DateRange,
): PerformanceBreakdown {
  const segments = Array.from(grouped.entries())
    .map(([label, apps]) => computeSegment(label, apps, matchResults))
    .sort((a, b) => b.applications - a.applications);

  return { dimension, segments, period };
}

export function analyzeByCountry(
  applications: readonly ApplicationRecord[],
  vacancies: Map<string, VacancyRecord>,
  matchResults: Map<string, MatchResultRecord>,
  period: DateRange,
): PerformanceBreakdown {
  const grouped = groupByVacancyField(applications, vacancies, (v) => v.country ?? 'Unknown');
  return toBreakdown('country', grouped, matchResults, period);
}

export function analyzeByCity(
  applications: readonly ApplicationRecord[],
  vacancies: Map<string, VacancyRecord>,
  matchResults: Map<string, MatchResultRecord>,
  period: DateRange,
): PerformanceBreakdown {
  const grouped = groupByVacancyField(applications, vacancies, (v) => v.city ?? 'Unknown');
  return toBreakdown('city', grouped, matchResults, period);
}

export function analyzeByProvider(
  applications: readonly ApplicationRecord[],
  vacancies: Map<string, VacancyRecord>,
  matchResults: Map<string, MatchResultRecord>,
  period: DateRange,
): PerformanceBreakdown {
  const grouped = groupByVacancyField(applications, vacancies, (v) => v.source);
  return toBreakdown('provider', grouped, matchResults, period);
}

export function analyzeByRemotePreference(
  applications: readonly ApplicationRecord[],
  vacancies: Map<string, VacancyRecord>,
  matchResults: Map<string, MatchResultRecord>,
  period: DateRange,
): PerformanceBreakdown {
  const grouped = groupByVacancyField(applications, vacancies, (v) => v.remote);
  return toBreakdown('remote', grouped, matchResults, period);
}

export function analyzeBySalaryRange(
  applications: readonly ApplicationRecord[],
  vacancies: Map<string, VacancyRecord>,
  matchResults: Map<string, MatchResultRecord>,
  period: DateRange,
): PerformanceBreakdown {
  const grouped = groupByVacancyField(applications, vacancies, (v) => {
    const salary = v.salaryMax ?? v.salaryMin;
    if (!salary) return 'Not specified';
    if (salary < 50000) return 'Under 50K';
    if (salary < 80000) return '50K-80K';
    if (salary < 120000) return '80K-120K';
    if (salary < 150000) return '120K-150K';
    return '150K+';
  });
  return toBreakdown('salary_range', grouped, matchResults, period);
}

export function analyzeByExperienceLevel(
  applications: readonly ApplicationRecord[],
  vacancies: Map<string, VacancyRecord>,
  matchResults: Map<string, MatchResultRecord>,
  period: DateRange,
): PerformanceBreakdown {
  const grouped = groupByVacancyField(applications, vacancies, (v) => v.experienceLevel ?? 'Not specified');
  return toBreakdown('experience_level', grouped, matchResults, period);
}

export function analyzeByCompany(
  applications: readonly ApplicationRecord[],
  vacancies: Map<string, VacancyRecord>,
  companies: Map<string, CompanyRecord>,
  matchResults: Map<string, MatchResultRecord>,
  period: DateRange,
): PerformanceBreakdown {
  const grouped = groupByVacancyField(applications, vacancies, (v) => companies.get(v.companyId)?.name ?? 'Unknown');
  return toBreakdown('company', grouped, matchResults, period);
}

export function analyzeByIndustry(
  applications: readonly ApplicationRecord[],
  vacancies: Map<string, VacancyRecord>,
  companies: Map<string, CompanyRecord>,
  matchResults: Map<string, MatchResultRecord>,
  period: DateRange,
): PerformanceBreakdown {
  const grouped = groupByVacancyField(applications, vacancies, (v) => companies.get(v.companyId)?.industry ?? 'Unknown');
  return toBreakdown('industry', grouped, matchResults, period);
}

export function analyzeByCompanySize(
  applications: readonly ApplicationRecord[],
  vacancies: Map<string, VacancyRecord>,
  companies: Map<string, CompanyRecord>,
  matchResults: Map<string, MatchResultRecord>,
  period: DateRange,
): PerformanceBreakdown {
  const grouped = groupByVacancyField(applications, vacancies, (v) => companies.get(v.companyId)?.size ?? 'Unknown');
  return toBreakdown('company_size', grouped, matchResults, period);
}

/**
 * Unlike the other dimensions, a vacancy carries multiple technologies, so
 * an application is counted in every technology segment its vacancy lists
 * (non-exclusive groups) rather than exactly one.
 */
export function analyzeByTechnology(
  applications: readonly ApplicationRecord[],
  vacancies: Map<string, VacancyRecord>,
  matchResults: Map<string, MatchResultRecord>,
  period: DateRange,
): PerformanceBreakdown {
  const grouped = new Map<string, ApplicationRecord[]>();
  for (const app of applications) {
    const vacancy = vacancies.get(app.vacancyId);
    const technologies = vacancy && vacancy.technologies.length > 0 ? vacancy.technologies : ['Unknown'];
    for (const tech of technologies) {
      const existing = grouped.get(tech) ?? [];
      grouped.set(tech, [...existing, app]);
    }
  }
  return toBreakdown('technology', grouped, matchResults, period);
}

export interface ResumeApplicationRecord extends ApplicationRecord {
  readonly resumeId: string | null;
}

/**
 * Groups by resumeId (an application field, not a vacancy field). Applications with a
 * null resumeId land in a distinct 'Unassigned' segment rather than being dropped, so the
 * null-resumeId edge case is handled here once instead of in every downstream consumer.
 */
function groupByResumeId(applications: readonly ResumeApplicationRecord[]): Map<string, ApplicationRecord[]> {
  const grouped = new Map<string, ApplicationRecord[]>();
  for (const app of applications) {
    const key = app.resumeId ?? 'Unassigned';
    const existing = grouped.get(key) ?? [];
    grouped.set(key, [...existing, app]);
  }
  return grouped;
}

export function analyzeByResumeVersion(
  applications: readonly ResumeApplicationRecord[],
  matchResults: Map<string, MatchResultRecord>,
  period: DateRange,
): PerformanceBreakdown {
  const grouped = groupByResumeId(applications);
  return toBreakdown('resume_version', grouped, matchResults, period);
}
