import type { Application, ApplicationService } from '@careeros/career';
import { createResumeId, createUserId, createVacancyId } from '@careeros/career';
import type { AnalyticsEventRepository } from '@careeros/database';
import type { Recommendation } from './recommendation-service.js';

export class ApplicationAlreadyExistsError extends Error {
  constructor(userId: string, vacancyId: string) {
    super(`Application already exists for user '${userId}' and vacancy '${vacancyId}'`);
    this.name = 'ApplicationAlreadyExistsError';
  }
}

export class ApplicationCreationService {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly analyticsEventRepository?: AnalyticsEventRepository,
  ) {}

  /** Create an Application directly from a Recommendation object (in-process callers, e.g. the demo script). */
  async createFromRecommendation(params: {
    userId: string;
    recommendation: Recommendation;
    resumeId?: string;
    workspaceId?: string;
  }): Promise<Application> {
    return this.createFromIds({
      userId: params.userId,
      vacancyId: params.recommendation.vacancy.id,
      matchResultId: params.recommendation.matchResultId,
      resumeId: params.resumeId,
      workspaceId: params.workspaceId,
    });
  }

  /** Create an Application from raw identifiers, e.g. as supplied by an HTTP request body. */
  async createFromIds(params: {
    userId: string;
    vacancyId: string;
    matchResultId?: string;
    resumeId?: string;
    workspaceId?: string;
  }): Promise<Application> {
    const application = await this.applicationService.createApplication({
      userId: createUserId(params.userId),
      vacancyId: createVacancyId(params.vacancyId),
      resumeId: params.resumeId ? createResumeId(params.resumeId) : undefined,
      matchResultId: params.matchResultId,
      workspaceId: params.workspaceId,
    });

    await this.analyticsEventRepository?.record({
      userId: params.userId,
      eventType: 'application_saved',
      entityType: 'application',
      entityId: application.id,
      metadata: { vacancyId: params.vacancyId },
    });

    return application;
  }
}
