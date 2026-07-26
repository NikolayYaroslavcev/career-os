import type { ApplicationRepository, VacancyRepository, VacancySourceRepository, CompanyRepository, Application, Vacancy, Resume, ResumeRepository, ResumeListCriteria } from '@careeros/career';
import { createUserId, createVacancyId, createCompanyId, createResumeId, ApplicationStatus, ResumeVersionStatus } from '@careeros/career';
import type { MatchResultRepository, MatchResult } from '@careeros/ai';
import type { CareerInsightRepository } from '@careeros/database';
import {
  getDateRangeForPeriod,
  analyzeByResumeVersion,
  analyzeByCountry,
  analyzeByCity,
  analyzeByProvider,
  analyzeByIndustry,
  analyzeByTechnology,
  analyzeByCompanySize,
  analyzeBySalaryRange,
  analyzeByRemotePreference,
  generateResumeVersionInsights,
  computeAverageSalary,
  compareResumeVersions,
  recommendResumeVersion,
  type TrendPeriod,
  type DateRange,
  type PerformanceBreakdown,
  type Insights,
  type ResumeVersionPerformance,
  type ResumeVersionSummary,
  type ResumeVersionComparison,
  type ResumeRecommendation,
  type ResumeApplicationRecord,
  type ResumeVersionCandidate,
} from '@careeros/analytics';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class VacancyNotFoundError extends Error {
  constructor(id: string) {
    super(`Vacancy '${id}' not found`);
    this.name = 'VacancyNotFoundError';
  }
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

interface CompanyRecord {
  readonly id: string;
  readonly name: string;
  readonly industry: string | null;
  readonly size: string | null;
}

interface ApplicationsWithContext {
  readonly applications: readonly Application[];
  readonly vacancyMap: Map<string, VacancyRecord>;
  readonly companyMap: Map<string, CompanyRecord>;
  readonly matchRecords: Map<string, { vacancyId: string; overallScore: number }>;
}

export interface ResumeVersionIntelligenceDeps {
  readonly resumeRepository: ResumeRepository;
  readonly applicationRepository: ApplicationRepository;
  readonly vacancyRepository: VacancyRepository;
  readonly vacancySourceRepository: VacancySourceRepository;
  readonly companyRepository: CompanyRepository;
  readonly matchResultRepository: MatchResultRepository;
  readonly careerInsightRepository: CareerInsightRepository;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export class ResumeVersionIntelligenceService {
  constructor(private readonly deps: ResumeVersionIntelligenceDeps) {}

  async listVersions(userId: string, criteria?: ResumeListCriteria): Promise<Resume[]> {
    return this.deps.resumeRepository.findByUserId(createUserId(userId), criteria);
  }

  async getVersion(userId: string, resumeId: string): Promise<Resume | null> {
    const resume = await this.deps.resumeRepository.findById(createResumeId(resumeId));
    if (!resume || resume.userId !== userId) return null;
    return resume;
  }

  async getVersionPerformance(userId: string, resumeId: string, period: TrendPeriod = 'all'): Promise<ResumeVersionPerformance> {
    return this.withCache(userId, `resume-version-performance:${resumeId}`, period, async () => {
      const dateRange = getDateRangeForPeriod(period);
      const context = await this.fetchApplicationsWithContext(userId, dateRange);
      return this.computePerformance(resumeId, context, dateRange);
    });
  }

  async getAllVersionsPerformance(userId: string, period: TrendPeriod = 'all'): Promise<readonly ResumeVersionPerformance[]> {
    return this.withCache(userId, 'resume-version-performance-all', period, async () => {
      const dateRange = getDateRangeForPeriod(period);
      const versions = await this.deps.resumeRepository.findByUserId(createUserId(userId));
      const context = await this.fetchApplicationsWithContext(userId, dateRange);
      return Promise.all(versions.map((v) => this.computePerformance(v.id, context, dateRange)));
    });
  }

  async getVersionBreakdowns(userId: string, resumeId: string, period: TrendPeriod = 'all'): Promise<readonly PerformanceBreakdown[]> {
    return this.withCache(userId, `resume-version-breakdowns:${resumeId}`, period, async () => {
      const dateRange = getDateRangeForPeriod(period);
      const context = await this.fetchApplicationsWithContext(userId, dateRange);
      return this.computeBreakdowns(resumeId, context, dateRange);
    });
  }

  async getVersionInsights(userId: string, resumeId: string, period: TrendPeriod = 'all'): Promise<Insights> {
    const dateRange = getDateRangeForPeriod(period);
    const resume = await this.deps.resumeRepository.findById(createResumeId(resumeId));
    const resumeLabel = resume?.title ?? resumeId;

    const context = await this.fetchApplicationsWithContext(userId, dateRange);
    const resumeApplications: ResumeApplicationRecord[] = context.applications.map((a) => ({
      status: a.status,
      vacancyId: a.vacancyId,
      resumeId: a.resumeId ?? null,
    }));
    const overallBreakdown = analyzeByResumeVersion(resumeApplications, context.matchRecords, dateRange);
    const breakdowns = this.computeBreakdowns(resumeId, context, dateRange);

    return generateResumeVersionInsights(
      overallBreakdown,
      [{ resumeId, resumeLabel, breakdowns }],
      dateRange,
    );
  }

  async compareVersions(userId: string, resumeIdA: string, resumeIdB: string, period: TrendPeriod = 'all'): Promise<ResumeVersionComparison> {
    const dateRange = getDateRangeForPeriod(period);
    const [perfA, perfB] = await Promise.all([
      this.getVersionPerformance(userId, resumeIdA, period),
      this.getVersionPerformance(userId, resumeIdB, period),
    ]);

    return compareResumeVersions(this.toSummary(perfA), this.toSummary(perfB), dateRange);
  }

  async recommendForVacancy(userId: string, vacancyId: string): Promise<ResumeRecommendation> {
    const vacancy = await this.deps.vacancyRepository.findById(createVacancyId(vacancyId));
    if (!vacancy) {
      throw new VacancyNotFoundError(vacancyId);
    }

    const activeVersions = await this.deps.resumeRepository.findByUserId(createUserId(userId), {
      status: ResumeVersionStatus.ACTIVE,
    });

    const candidates: ResumeVersionCandidate[] = await Promise.all(
      activeVersions.map(async (version) => {
        const [performance, breakdowns] = await Promise.all([
          this.getVersionPerformance(userId, version.id, 'all'),
          this.getVersionBreakdowns(userId, version.id, 'all'),
        ]);
        return {
          resumeId: version.id,
          applications: performance.applications,
          interviewRate: performance.interviewRate,
          avgMatchScore: performance.avgMatchScore,
          offerRate: performance.offerRate,
          breakdowns,
        };
      }),
    );

    return recommendResumeVersion(
      {
        vacancyId: vacancy.id,
        country: vacancy.location.country ?? null,
        source: null,
        technologies: vacancy.technologies.map((t) => t.name),
      },
      candidates,
    );
  }

  // ---- shared fetch/mapping helpers ----

  private async fetchApplicationsWithContext(userId: string, dateRange: DateRange): Promise<ApplicationsWithContext> {
    const allApplications = await this.deps.applicationRepository.findByUserId(createUserId(userId));
    const applications = this.filterByDate(allApplications, dateRange);

    const vacancyIds = [...new Set(applications.map((a) => a.vacancyId))];
    const vacancies = await this.deps.vacancyRepository.findByIds(vacancyIds.map((id) => createVacancyId(id)));
    const vacancyMap = await this.toVacancyRecordMap(vacancies);

    const companyIds = [...new Set(vacancies.map((v) => v.companyId))];
    const companies = await this.deps.companyRepository.findByIds(companyIds.map((id) => createCompanyId(id)));
    const companyMap = this.toCompanyRecordMap(companies);

    const matchResults = await this.deps.matchResultRepository.findByUserId(userId);
    const filteredMatches = this.filterMatchResultsByDate(matchResults, dateRange);
    const matchRecords = new Map(filteredMatches.map((m) => [m.vacancyId, { vacancyId: m.vacancyId, overallScore: m.overallScore }]));

    return { applications, vacancyMap, companyMap, matchRecords };
  }

  private computePerformance(resumeId: string, context: ApplicationsWithContext, dateRange: DateRange): ResumeVersionPerformance {
    const versionApps = context.applications.filter((a) => a.resumeId === resumeId);

    const resumeApplications: ResumeApplicationRecord[] = context.applications.map((a) => ({
      status: a.status,
      vacancyId: a.vacancyId,
      resumeId: a.resumeId ?? null,
    }));
    const overallBreakdown = analyzeByResumeVersion(resumeApplications, context.matchRecords, dateRange);
    const segment = overallBreakdown.segments.find((s) => s.label === resumeId);

    const saved = versionApps.filter((a) => a.status === ApplicationStatus.SAVED).length;
    const applied = versionApps.filter(
      (a) => a.status !== ApplicationStatus.SAVED && a.status !== ApplicationStatus.ARCHIVED,
    ).length;
    const hrInterviews = versionApps.filter((a) => a.status === ApplicationStatus.HR_INTERVIEW).length;
    const technicalInterviews = versionApps.filter((a) => a.status === ApplicationStatus.TECHNICAL_INTERVIEW).length;
    const finalInterviews = versionApps.filter((a) => a.status === ApplicationStatus.FINAL_INTERVIEW).length;
    const offers = versionApps.filter((a) => a.status === ApplicationStatus.OFFER).length;
    const rejected = versionApps.filter((a) => a.status === ApplicationStatus.REJECTED).length;
    const withdrawn = versionApps.filter((a) => a.status === ApplicationStatus.ARCHIVED).length;

    const respondedApps = versionApps.filter(
      (a) => a.status !== ApplicationStatus.SAVED && a.status !== ApplicationStatus.STARTED && a.status !== ApplicationStatus.SUBMITTED && a.submittedAt,
    );
    const avgResponseTime = respondedApps.length > 0
      ? Math.round(respondedApps.reduce((sum, a) => sum + daysBetween(a.submittedAt as Date, a.updatedAt), 0) / respondedApps.length)
      : null;

    const offerApps = versionApps.filter((a) => a.status === ApplicationStatus.OFFER && a.submittedAt);
    const avgHiringTime = offerApps.length > 0
      ? Math.round(offerApps.reduce((sum, a) => sum + daysBetween(a.submittedAt as Date, a.updatedAt), 0) / offerApps.length)
      : null;

    const salaryEntries = versionApps
      .map((a) => context.vacancyMap.get(a.vacancyId))
      .filter((v): v is VacancyRecord => v !== undefined)
      .map((v) => ({ salaryMin: v.salaryMin, salaryMax: v.salaryMax, currency: v.currency }));
    const { avgSalary, currency: avgSalaryCurrency } = computeAverageSalary(salaryEntries);

    return {
      resumeId,
      applications: segment?.applications ?? versionApps.length,
      saved,
      applied,
      hrInterviews,
      technicalInterviews,
      finalInterviews,
      offers,
      accepted: 0,
      rejected,
      withdrawn,
      interviewRate: segment?.interviewRate ?? 0,
      offerRate: segment?.offerRate ?? 0,
      responseRate: segment?.responseRate ?? 0,
      avgMatchScore: segment?.avgMatchScore ?? 0,
      avgSalary,
      avgSalaryCurrency,
      avgResponseTime,
      avgHiringTime,
      period: dateRange,
    };
  }

  private computeBreakdowns(resumeId: string, context: ApplicationsWithContext, dateRange: DateRange): readonly PerformanceBreakdown[] {
    const versionApps = context.applications
      .filter((a) => a.resumeId === resumeId)
      .map((a) => ({ status: a.status, vacancyId: a.vacancyId }));

    return [
      analyzeByCountry(versionApps, context.vacancyMap, context.matchRecords, dateRange),
      analyzeByCity(versionApps, context.vacancyMap, context.matchRecords, dateRange),
      analyzeByProvider(versionApps, context.vacancyMap, context.matchRecords, dateRange),
      analyzeByIndustry(versionApps, context.vacancyMap, context.companyMap, context.matchRecords, dateRange),
      analyzeByTechnology(versionApps, context.vacancyMap, context.matchRecords, dateRange),
      analyzeByCompanySize(versionApps, context.vacancyMap, context.companyMap, context.matchRecords, dateRange),
      analyzeBySalaryRange(versionApps, context.vacancyMap, context.matchRecords, dateRange),
      analyzeByRemotePreference(versionApps, context.vacancyMap, context.matchRecords, dateRange),
    ];
  }

  private toSummary(performance: ResumeVersionPerformance): ResumeVersionSummary {
    return {
      resumeId: performance.resumeId,
      applications: performance.applications,
      interviewRate: performance.interviewRate,
      offerRate: performance.offerRate,
      responseRate: performance.responseRate,
      avgMatchScore: performance.avgMatchScore,
      avgSalary: performance.avgSalary,
      sampleSize: performance.applications,
    };
  }

  private async toVacancyRecordMap(vacancies: readonly Vacancy[]): Promise<Map<string, VacancyRecord>> {
    const sourcesByVacancyId = await this.deps.vacancySourceRepository.findByVacancyIds(
      vacancies.map((v) => createVacancyId(v.id)),
    );

    const map = new Map<string, VacancyRecord>();
    for (const v of vacancies) {
      const sources = sourcesByVacancyId.get(v.id) ?? [];
      const primarySource = sources.find((s) => s.isPrimary) ?? sources[0];
      map.set(v.id, {
        id: v.id,
        country: v.location.country ?? null,
        city: v.location.city ?? null,
        remote: v.location.workMode,
        salaryMin: v.salary?.min ?? null,
        salaryMax: v.salary?.max ?? null,
        currency: v.salary?.currency ?? null,
        experienceLevel: v.experienceLevel,
        source: primarySource?.providerId ?? 'unknown',
        companyId: v.companyId,
        technologies: v.technologies.map((t) => t.name),
      });
    }
    return map;
  }

  private toCompanyRecordMap(companies: readonly { id: string; name: string; industry?: string | null; size?: string | null }[]): Map<string, CompanyRecord> {
    const map = new Map<string, CompanyRecord>();
    for (const c of companies) {
      map.set(c.id, { id: c.id, name: c.name, industry: c.industry ?? null, size: c.size ?? null });
    }
    return map;
  }

  private filterByDate<T extends { createdAt: Date }>(items: readonly T[], dateRange: DateRange): T[] {
    return items.filter((item) => item.createdAt >= dateRange.from && item.createdAt <= dateRange.to);
  }

  private filterMatchResultsByDate(items: readonly MatchResult[], dateRange: DateRange): readonly MatchResult[] {
    return items.filter((item) => item.generatedAt >= dateRange.from && item.generatedAt <= dateRange.to);
  }

  // ---- caching (CareerInsight-backed, same pattern as CareerIntelligenceService) ----

  private async withCache<T>(userId: string, type: string, period: TrendPeriod, compute: () => Promise<T>): Promise<T> {
    const cacheKey = `${type}:${period}`;
    const cached = await this.deps.careerInsightRepository.get(userId, cacheKey);
    if (cached && cached.validUntil && cached.validUntil > new Date()) {
      return cached.data as T;
    }

    const data = await compute();
    await this.deps.careerInsightRepository.upsert({
      userId,
      insightType: cacheKey,
      data,
      validUntil: new Date(Date.now() + CACHE_TTL_MS),
    });
    return data;
  }
}
