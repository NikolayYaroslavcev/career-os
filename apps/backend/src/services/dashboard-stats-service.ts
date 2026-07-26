import type { VacancyRepository, ApplicationRepository } from '@careeros/career';
import { createUserId, ApplicationStatus } from '@careeros/career';
import type { MatchResultRepository } from '@careeros/ai';

export interface DashboardStats {
  readonly totalJobs: number;
  readonly newToday: number;
  readonly applicationsThisWeek: number;
  readonly offersCount: number;
  readonly responseRate: number;
  readonly rejectionRate: number;
  readonly averageMatchScore: number;
  readonly highScoreJobs: number;
  readonly pendingApplications: number;
}

export class DashboardStatsService {
  constructor(
    private readonly vacancyRepository: VacancyRepository,
    private readonly applicationRepository: ApplicationRepository,
    private readonly matchResultRepository: MatchResultRepository,
  ) {}

  async getStats(workspaceId: string, userId: string): Promise<DashboardStats> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const brandedUserId = createUserId(userId);

    const [vacancyStats, applications, matchResults] = await Promise.all([
      this.vacancyRepository.getStats(workspaceId),
      this.applicationRepository.findByUserId(brandedUserId),
      this.matchResultRepository.findByUserId(userId),
    ]);

    const applicationsThisWeek = applications.filter(
      (app) => app.createdAt >= startOfWeek,
    ).length;

    const offersCount = applications.filter((app) => app.status === ApplicationStatus.OFFER).length;
    const rejectedCount = applications.filter((app) => app.status === ApplicationStatus.REJECTED).length;
    const appliedCount = applications.filter(
      (app) => app.status !== ApplicationStatus.SAVED && app.status !== ApplicationStatus.ARCHIVED,
    ).length;

    const responseRate = appliedCount > 0
      ? Math.round(((appliedCount - rejectedCount) / appliedCount) * 100)
      : 0;

    const rejectionRate = appliedCount > 0
      ? Math.round((rejectedCount / appliedCount) * 100)
      : 0;

    const averageMatchScore = matchResults.length > 0
      ? Math.round(
          matchResults.reduce((sum: number, mr) => sum + mr.overallScore, 0) / matchResults.length,
        )
      : 0;

    const highScoreJobs = matchResults.filter((mr) => mr.overallScore >= 80).length;

    const pendingApplications = applications.filter(
      (app) => app.status === ApplicationStatus.SUBMITTED || app.status === ApplicationStatus.WAITING,
    ).length;

    return {
      totalJobs: vacancyStats.totalJobs,
      newToday: vacancyStats.newToday,
      applicationsThisWeek,
      offersCount,
      responseRate,
      rejectionRate,
      averageMatchScore,
      highScoreJobs,
      pendingApplications,
    };
  }
}
