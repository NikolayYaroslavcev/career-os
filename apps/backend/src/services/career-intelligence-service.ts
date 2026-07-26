import type { ApplicationRepository, VacancyRepository, VacancySourceRepository, CompanyRepository, Application, Vacancy } from '@careeros/career';
import { createUserId, createVacancyId, createCompanyId, ApplicationStatus, isTerminalStatus } from '@careeros/career';
import type { MatchResultRepository, MatchResult } from '@careeros/ai';
import type { AnalyticsEventRepository, CareerInsightRepository } from '@careeros/database';
import {
  computeFunnel,
  analyzeFailures,
  computeCareerHealthScore,
  computeTimeAnalytics,
  computeMatchAnalytics,
  generateInsights,
  analyzeSuccessPatterns,
  computeTrends,
  analyzeByCountry,
  analyzeByProvider,
  analyzeByRemotePreference,
  analyzeBySalaryRange,
  analyzeByExperienceLevel,
  analyzeByCompany,
  analyzeByIndustry,
  analyzeByCompanySize,
  analyzeByTechnology,
  getDateRangeForPeriod,
  type TrendPeriod,
  type ApplicationFunnel,
  type CareerHealthScore,
  type FailureAnalysis,
  type TimeAnalytics,
  type MatchAnalytics,
  type Insights,
  type PerformanceBreakdown,
  type SuccessPattern,
  type Trends,
  type CareerMetrics,
  type DateRange,
} from '@careeros/analytics';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const INTERVIEW_STATUSES: ReadonlySet<string> = new Set([
  ApplicationStatus.HR_INTERVIEW,
  ApplicationStatus.TECHNICAL_INTERVIEW,
  ApplicationStatus.FINAL_INTERVIEW,
]);
const REACHED_INTERVIEW_STATUSES: ReadonlySet<string> = new Set([
  ApplicationStatus.HR_INTERVIEW,
  ApplicationStatus.TECHNICAL_INTERVIEW,
  ApplicationStatus.FINAL_INTERVIEW,
  ApplicationStatus.OFFER,
]);
const PRE_INTERVIEW_STATUSES: ReadonlySet<string> = new Set([
  ApplicationStatus.SAVED,
  ApplicationStatus.STARTED,
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.WAITING,
]);

/** Plain shape shared across every packages/analytics function that reads applications. */
interface AppRecord {
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Named to match packages/analytics' ApplicationRecord contract; sourced from Application.submittedAt. */
  readonly appliedAt: Date | null;
  readonly vacancyId: string;
  readonly priorStatus?: string | null;
  readonly daysInPriorStage?: number | null;
}

interface MatchRecord {
  readonly vacancyId: string;
  readonly overallScore: number;
  readonly categoryScores: unknown;
  readonly generatedAt: Date;
  readonly reachedInterview?: boolean;
}

export interface CareerIntelligenceDeps {
  readonly applicationRepository: ApplicationRepository;
  readonly vacancyRepository: VacancyRepository;
  readonly vacancySourceRepository: VacancySourceRepository;
  readonly companyRepository: CompanyRepository;
  readonly matchResultRepository: MatchResultRepository;
  readonly analyticsEventRepository: AnalyticsEventRepository;
  readonly careerInsightRepository: CareerInsightRepository;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Status the application held immediately before rejection, when derivable from status-change event history. */
function priorStatusFor(
  applicationId: string,
  history: ReadonlyMap<string, readonly { status: string; occurredAt: Date }[]>,
): { priorStatus: string | null; daysInPriorStage: number | null } {
  const events = history.get(applicationId);
  if (!events || events.length < 2) return { priorStatus: null, daysInPriorStage: null };

  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  if (!last || !prev) return { priorStatus: null, daysInPriorStage: null };

  return { priorStatus: prev.status, daysInPriorStage: daysBetween(prev.occurredAt, last.occurredAt) };
}

function determineReachedInterview(status: string, priorStatus: string | null): boolean | undefined {
  if (REACHED_INTERVIEW_STATUSES.has(status)) return true;
  if (status === ApplicationStatus.REJECTED || status === ApplicationStatus.ARCHIVED) {
    if (priorStatus && REACHED_INTERVIEW_STATUSES.has(priorStatus)) return true;
    if (priorStatus && PRE_INTERVIEW_STATUSES.has(priorStatus)) return false;
    return undefined;
  }
  return undefined;
}

export class CareerIntelligenceService {
  constructor(private readonly deps: CareerIntelligenceDeps) {}

  async getOverview(userId: string, period: TrendPeriod = 'all'): Promise<CareerMetrics> {
    const dateRange = getDateRangeForPeriod(period);
    const [applications, matchResults] = await this.fetchApplicationsAndMatches(userId);

    const filteredApps = this.filterByDate(applications, dateRange);
    const filteredMatches = this.filterMatchResultsByDate(matchResults, dateRange);
    const vacancyMap = await this.fetchVacanciesByIds(filteredApps.map((a) => a.vacancyId));

    const applied = filteredApps.filter(
      (a) => a.status !== ApplicationStatus.SAVED && a.status !== ApplicationStatus.ARCHIVED,
    );
    const avgMatchScore = this.averageScore(filteredMatches);

    const respondedApps = filteredApps.filter(
      (a) => a.status !== ApplicationStatus.SAVED && a.status !== ApplicationStatus.STARTED && a.status !== ApplicationStatus.SUBMITTED && a.submittedAt,
    );
    const avgResponseTime = respondedApps.length > 0
      ? Math.round(respondedApps.reduce((s, a) => s + daysBetween(a.submittedAt as Date, a.updatedAt), 0) / respondedApps.length)
      : null;

    const offerApps = filteredApps.filter((a) => a.status === ApplicationStatus.OFFER && a.submittedAt);
    const avgHiringTime = offerApps.length > 0
      ? Math.round(offerApps.reduce((s, a) => s + daysBetween(a.submittedAt as Date, a.updatedAt), 0) / offerApps.length)
      : null;

    const expiredApplications = filteredApps.filter(
      (a) => !isTerminalStatus(a.status as ApplicationStatus) && vacancyMap.get(a.vacancyId)?.isExpired,
    ).length;

    return {
      applicationsSent: applied.length,
      applicationsSaved: filteredApps.filter((a) => a.status === ApplicationStatus.SAVED).length,
      hrInterviews: filteredApps.filter((a) => a.status === ApplicationStatus.HR_INTERVIEW).length,
      technicalInterviews: filteredApps.filter((a) => a.status === ApplicationStatus.TECHNICAL_INTERVIEW).length,
      finalInterviews: filteredApps.filter((a) => a.status === ApplicationStatus.FINAL_INTERVIEW).length,
      offers: filteredApps.filter((a) => a.status === ApplicationStatus.OFFER).length,
      // ApplicationStatus has no ACCEPTED/DECLINED sub-state for an offer today — a domain
      // model gap, not an analytics gap. Revisit once offer outcomes are tracked.
      acceptedOffers: 0,
      rejectedOffers: 0,
      withdrawnApplications: filteredApps.filter((a) => a.status === ApplicationStatus.ARCHIVED).length,
      expiredApplications,
      currentActive: filteredApps.filter(
        (a) => a.status === ApplicationStatus.SUBMITTED || a.status === ApplicationStatus.WAITING,
      ).length,
      avgMatchScore,
      // Salaries span multiple currencies with no FX conversion in scope — averaging them
      // directly would be misleading, so this stays null until currency-normalized.
      avgSalary: null,
      avgResponseTime,
      avgHiringTime,
      period: dateRange,
    };
  }

  async getFunnel(userId: string, period: TrendPeriod = 'all'): Promise<ApplicationFunnel> {
    const dateRange = getDateRangeForPeriod(period);
    const applications = await this.deps.applicationRepository.findByUserId(createUserId(userId));
    const filteredApps = this.filterByDate(applications, dateRange);

    const vacanciesFoundEvents = await this.deps.analyticsEventRepository.countDistinctEntities(
      userId,
      'vacancy_found',
      { since: dateRange.from, until: dateRange.to },
    );
    // Falls back to the applied-set size when no 'vacancy_found' events have been
    // recorded yet (e.g. right after this tracking shipped) so the funnel never shows zero.
    const vacanciesFound = vacanciesFoundEvents > 0 ? vacanciesFoundEvents : filteredApps.length;

    return computeFunnel(filteredApps.map((a) => this.toAppRecord(a)), vacanciesFound, dateRange);
  }

  async getFailureAnalysis(userId: string, period: TrendPeriod = 'all'): Promise<FailureAnalysis> {
    const dateRange = getDateRangeForPeriod(period);
    const applications = await this.deps.applicationRepository.findByUserId(createUserId(userId));
    const filteredApps = this.filterByDate(applications, dateRange);
    const history = await this.fetchStatusHistory(userId);

    const records = filteredApps.map((a) => this.toAppRecord(a, history));
    return analyzeFailures(records, dateRange);
  }

  async getTimeAnalytics(userId: string, period: TrendPeriod = 'all'): Promise<TimeAnalytics> {
    const dateRange = getDateRangeForPeriod(period);
    const applications = await this.deps.applicationRepository.findByUserId(createUserId(userId));
    const filteredApps = this.filterByDate(applications, dateRange);

    return computeTimeAnalytics(filteredApps.map((a) => this.toAppRecord(a)), dateRange);
  }

  async getMatchAnalytics(userId: string, period: TrendPeriod = 'all'): Promise<MatchAnalytics> {
    const dateRange = getDateRangeForPeriod(period);
    const [applications, matchResults] = await this.fetchApplicationsAndMatches(userId);
    const filteredMatches = this.filterMatchResultsByDate(matchResults, dateRange);
    const history = await this.fetchStatusHistory(userId);

    const records = this.toMatchRecords(filteredMatches, applications, history);
    return computeMatchAnalytics(records, dateRange);
  }

  async getCareerHealth(userId: string, period: TrendPeriod = 'all'): Promise<CareerHealthScore> {
    const dateRange = getDateRangeForPeriod(period);
    const [applications, matchResults] = await this.fetchApplicationsAndMatches(userId);

    const filteredApps = this.filterByDate(applications, dateRange);
    const filteredMatches = this.filterMatchResultsByDate(matchResults, dateRange);

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const applicationsThisWeek = filteredApps.filter((a) => a.createdAt >= weekAgo).length;
    const totalInterviews = filteredApps.filter((a) => INTERVIEW_STATUSES.has(a.status)).length;
    const totalOffers = filteredApps.filter((a) => a.status === ApplicationStatus.OFFER).length;
    const avgMatchScore = this.averageScore(filteredMatches);

    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const recentApps = applications.filter((a) => a.createdAt >= monthAgo).length;
    const olderApps = applications.filter(
      (a) => a.createdAt < monthAgo && a.createdAt >= new Date(monthAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
    ).length;
    const trend = olderApps > 0 ? (recentApps - olderApps) / olderApps : 0;

    return computeCareerHealthScore(
      {
        totalApplications: filteredApps.length,
        applicationsThisWeek,
        totalInterviews,
        totalOffers,
        totalRejected: filteredApps.filter((a) => a.status === ApplicationStatus.REJECTED).length,
        avgMatchScore,
        recentActivityTrend: trend,
      },
      dateRange,
    );
  }

  async getPerformanceBreakdowns(userId: string, period: TrendPeriod = 'all'): Promise<readonly PerformanceBreakdown[]> {
    const dateRange = getDateRangeForPeriod(period);
    const [applications, matchResults] = await this.fetchApplicationsAndMatches(userId);
    const filteredApps = this.filterByDate(applications, dateRange);
    const filteredMatches = this.filterMatchResultsByDate(matchResults, dateRange);

    const vacancyMap = await this.fetchVacanciesByIds(filteredApps.map((a) => a.vacancyId));
    const companyMap = await this.fetchCompaniesByIds(
      [...vacancyMap.values()].map((v) => v.companyId),
    );

    const appRecords = filteredApps.map((a) => ({ status: a.status, vacancyId: a.vacancyId }));
    const vacancyRecords = await this.toVacancyRecordMap(vacancyMap);
    const companyRecords = this.toCompanyRecordMap(companyMap);
    const matchRecords = new Map(
      filteredMatches.map((m) => [m.vacancyId, { vacancyId: m.vacancyId, overallScore: m.overallScore }]),
    );

    return [
      analyzeByCountry(appRecords, vacancyRecords, matchRecords, dateRange),
      analyzeByProvider(appRecords, vacancyRecords, matchRecords, dateRange),
      analyzeByRemotePreference(appRecords, vacancyRecords, matchRecords, dateRange),
      analyzeBySalaryRange(appRecords, vacancyRecords, matchRecords, dateRange),
      analyzeByExperienceLevel(appRecords, vacancyRecords, matchRecords, dateRange),
      analyzeByCompany(appRecords, vacancyRecords, companyRecords, matchRecords, dateRange),
      analyzeByIndustry(appRecords, vacancyRecords, companyRecords, matchRecords, dateRange),
      analyzeByCompanySize(appRecords, vacancyRecords, companyRecords, matchRecords, dateRange),
      analyzeByTechnology(appRecords, vacancyRecords, matchRecords, dateRange),
    ];
  }

  async getSuccessPatterns(userId: string, period: TrendPeriod = 'all'): Promise<readonly SuccessPattern[]> {
    const breakdowns = await this.getPerformanceBreakdowns(userId, period);
    return analyzeSuccessPatterns(breakdowns);
  }

  async getTrends(userId: string, period: TrendPeriod = 'all'): Promise<Trends> {
    const dateRange = getDateRangeForPeriod(period);
    const previousRange = this.getPreviousPeriod(dateRange);

    const [applications, matchResults] = await this.fetchApplicationsAndMatches(userId);
    const currentApps = this.filterByDate(applications, dateRange).map((a) => ({
      status: a.status,
      createdAt: a.createdAt,
    }));
    const previousApps = this.filterByDate(applications, previousRange).map((a) => ({
      status: a.status,
      createdAt: a.createdAt,
    }));
    const currentMatches = this.filterMatchResultsByDate(matchResults, dateRange).map((m) => ({
      generatedAt: m.generatedAt,
      overallScore: m.overallScore,
    }));
    const previousMatches = this.filterMatchResultsByDate(matchResults, previousRange).map((m) => ({
      generatedAt: m.generatedAt,
      overallScore: m.overallScore,
    }));

    return computeTrends(currentApps, previousApps, currentMatches, previousMatches, dateRange);
  }

  async getInsights(userId: string, period: TrendPeriod = 'all'): Promise<Insights> {
    const cached = await this.withCache(userId, 'insights', period, () => this.computeInsights(userId, period));
    return this.reviveInsightsDates(cached);
  }

  /** Forces a fresh computation of the (cached) insights for this user/period, bypassing the cache read. */
  async refreshInsights(userId: string, period: TrendPeriod = 'all'): Promise<Insights> {
    const data = await this.computeInsights(userId, period);
    await this.writeCache(userId, 'insights', period, data);
    return data;
  }

  private async computeInsights(userId: string, period: TrendPeriod): Promise<Insights> {
    const dateRange = getDateRangeForPeriod(period);
    const breakdowns = await this.getPerformanceBreakdowns(userId, period);

    const previousRange = this.getPreviousPeriod(dateRange);
    const [currentResponseRate, previousResponseRate] = await Promise.all([
      this.calculateResponseRate(userId, dateRange),
      this.calculateResponseRate(userId, previousRange),
    ]);

    const matchAnalyticsRecords = await this.getMatchCorrelationRecords(userId, dateRange);
    const highMatch = matchAnalyticsRecords.filter((m) => m.overallScore >= 70 && m.reachedInterview !== undefined);
    const lowMatch = matchAnalyticsRecords.filter((m) => m.overallScore < 50 && m.reachedInterview !== undefined);
    const highMatchInterviewRate = this.interviewRate(highMatch);
    const lowMatchInterviewRate = this.interviewRate(lowMatch);

    return generateInsights(breakdowns, currentResponseRate, previousResponseRate, highMatchInterviewRate, lowMatchInterviewRate, dateRange);
  }

  /**
   * A cache hit round-trips through the CareerInsight Json column, which turns Date
   * fields into ISO strings — revive them so callers always get real Date objects,
   * whether the value came from cache or a fresh computation.
   */
  private reviveInsightsDates(insights: Insights): Insights {
    return {
      ...insights,
      generatedAt: new Date(insights.generatedAt),
      period: {
        ...insights.period,
        from: new Date(insights.period.from),
        to: new Date(insights.period.to),
      },
    };
  }

  private interviewRate(records: readonly MatchRecord[]): number {
    if (records.length === 0) return 0;
    const reached = records.filter((m) => m.reachedInterview === true).length;
    return Math.round((reached / records.length) * 100);
  }

  private async getMatchCorrelationRecords(userId: string, dateRange: DateRange): Promise<readonly MatchRecord[]> {
    const [applications, matchResults] = await this.fetchApplicationsAndMatches(userId);
    const filteredMatches = this.filterMatchResultsByDate(matchResults, dateRange);
    const history = await this.fetchStatusHistory(userId);
    return this.toMatchRecords(filteredMatches, applications, history);
  }

  // ---- shared fetch/mapping helpers ----

  private async fetchApplicationsAndMatches(userId: string): Promise<[Application[], readonly MatchResult[]]> {
    return Promise.all([
      this.deps.applicationRepository.findByUserId(createUserId(userId)),
      this.deps.matchResultRepository.findByUserId(userId),
    ]);
  }

  private async fetchVacanciesByIds(vacancyIds: readonly string[]): Promise<Map<string, Vacancy>> {
    const uniqueIds = [...new Set(vacancyIds)];
    const vacancies = await Promise.all(uniqueIds.map((id) => this.deps.vacancyRepository.findById(createVacancyId(id))));
    const map = new Map<string, Vacancy>();
    vacancies.forEach((vacancy, index) => {
      const id = uniqueIds[index];
      if (vacancy && id) map.set(id, vacancy);
    });
    return map;
  }

  private async fetchCompaniesByIds(companyIds: readonly string[]): Promise<Map<string, { id: string; name: string; industry: string | null; size: string | null }>> {
    const uniqueIds = [...new Set(companyIds)];
    const companies = await Promise.all(uniqueIds.map((id) => this.deps.companyRepository.findById(createCompanyId(id))));
    const map = new Map<string, { id: string; name: string; industry: string | null; size: string | null }>();
    companies.forEach((company, index) => {
      const id = uniqueIds[index];
      if (company && id) {
        map.set(id, {
          id: company.id,
          name: company.name,
          industry: company.industry ?? null,
          size: company.size ?? null,
        });
      }
    });
    return map;
  }

  private async toVacancyRecordMap(vacancies: ReadonlyMap<string, Vacancy>): Promise<Map<string, {
    id: string;
    country: string | null;
    city: string | null;
    remote: string;
    salaryMin: number | null;
    salaryMax: number | null;
    currency: string | null;
    experienceLevel: string | null;
    source: string;
    companyId: string;
    technologies: readonly string[];
  }>> {
    const vacancyIds = [...vacancies.keys()].map((id) => createVacancyId(id));
    const sourcesByVacancyId = await this.deps.vacancySourceRepository.findByVacancyIds(vacancyIds);

    const map = new Map<string, {
      id: string;
      country: string | null;
      city: string | null;
      remote: string;
      salaryMin: number | null;
      salaryMax: number | null;
      currency: string | null;
      experienceLevel: string | null;
      source: string;
      companyId: string;
      technologies: readonly string[];
    }>();
    for (const [id, v] of vacancies) {
      const sources = sourcesByVacancyId.get(id) ?? [];
      const primarySource = sources.find((s) => s.isPrimary) ?? sources[0];
      map.set(id, {
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

  private toCompanyRecordMap(companies: ReadonlyMap<string, { id: string; name: string; industry: string | null; size: string | null }>): Map<string, { id: string; name: string; industry: string | null; size: string | null }> {
    return new Map(companies);
  }

  private toAppRecord(
    application: Application,
    history?: ReadonlyMap<string, readonly { status: string; occurredAt: Date }[]>,
  ): AppRecord {
    const { priorStatus, daysInPriorStage } = history
      ? priorStatusFor(application.id, history)
      : { priorStatus: null, daysInPriorStage: null };

    return {
      status: application.status,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      appliedAt: application.submittedAt ?? null,
      vacancyId: application.vacancyId,
      priorStatus,
      daysInPriorStage,
    };
  }

  private toMatchRecords(
    matchResults: readonly MatchResult[],
    applications: readonly Application[],
    history: ReadonlyMap<string, readonly { status: string; occurredAt: Date }[]>,
  ): readonly MatchRecord[] {
    const applicationByVacancyId = new Map<string, Application>(applications.map((a) => [a.vacancyId as string, a]));

    return matchResults.map((m) => {
      const application = applicationByVacancyId.get(m.vacancyId);
      let reachedInterview: boolean | undefined;
      if (application) {
        const { priorStatus } = priorStatusFor(application.id, history);
        reachedInterview = determineReachedInterview(application.status, priorStatus);
      }

      return {
        vacancyId: m.vacancyId,
        overallScore: m.overallScore,
        categoryScores: m.categoryScores,
        generatedAt: m.generatedAt,
        reachedInterview,
      };
    });
  }

  private async fetchStatusHistory(userId: string): Promise<Map<string, { status: string; occurredAt: Date }[]>> {
    const events = await this.deps.analyticsEventRepository.findByUserId(userId, {
      eventType: 'status_changed',
      limit: 5000,
    });

    const map = new Map<string, { status: string; occurredAt: Date }[]>();
    for (const event of events) {
      const to = event.metadata.to;
      if (typeof to !== 'string') continue;
      const list = map.get(event.entityId) ?? [];
      list.push({ status: to, occurredAt: event.occurredAt });
      map.set(event.entityId, list);
    }
    return map;
  }

  private averageScore(matchResults: readonly MatchResult[]): number {
    return matchResults.length > 0
      ? Math.round(matchResults.reduce((s, m) => s + m.overallScore, 0) / matchResults.length)
      : 0;
  }

  private filterByDate<T extends { createdAt: Date }>(items: readonly T[], dateRange: DateRange): T[] {
    return items.filter((item) => item.createdAt >= dateRange.from && item.createdAt <= dateRange.to);
  }

  private filterMatchResultsByDate(items: readonly MatchResult[], dateRange: DateRange): readonly MatchResult[] {
    return items.filter((item) => item.generatedAt >= dateRange.from && item.generatedAt <= dateRange.to);
  }

  private async calculateResponseRate(userId: string, dateRange: DateRange): Promise<number> {
    const applications = await this.deps.applicationRepository.findByUserId(createUserId(userId));
    const filtered = this.filterByDate(applications, dateRange);

    const applied = filtered.filter(
      (a) => a.status !== ApplicationStatus.SAVED && a.status !== ApplicationStatus.ARCHIVED,
    );
    const responded = applied.filter(
      (a) => a.status !== ApplicationStatus.SUBMITTED && a.status !== ApplicationStatus.WAITING,
    );

    return applied.length > 0 ? Math.round((responded.length / applied.length) * 100) : 0;
  }

  private getPreviousPeriod(dateRange: DateRange): DateRange {
    const duration = dateRange.to.getTime() - dateRange.from.getTime();
    return {
      from: new Date(dateRange.from.getTime() - duration),
      to: dateRange.from,
      label: 'previous',
    };
  }

  // ---- caching (CareerInsight-backed) ----

  private async withCache<T>(userId: string, type: string, period: TrendPeriod, compute: () => Promise<T>): Promise<T> {
    const cacheKey = `${type}:${period}`;
    const cached = await this.deps.careerInsightRepository.get(userId, cacheKey);
    if (cached && cached.validUntil && cached.validUntil > new Date()) {
      return cached.data as T;
    }

    const data = await compute();
    await this.writeCache(userId, type, period, data);
    return data;
  }

  private async writeCache<T>(userId: string, type: string, period: TrendPeriod, data: T): Promise<void> {
    await this.deps.careerInsightRepository.upsert({
      userId,
      insightType: `${type}:${period}`,
      data,
      validUntil: new Date(Date.now() + CACHE_TTL_MS),
    });
  }
}
