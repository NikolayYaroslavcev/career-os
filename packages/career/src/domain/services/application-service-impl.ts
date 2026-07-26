import type { ApplicationService } from '@careeros/career';
import type { Application } from '@careeros/career';
import type { ApplicationId, UserId, VacancyId, ResumeId, RecruiterId } from '@careeros/career';
import type { ApplicationStatus } from '@careeros/career';
import type { ApplicationRepository } from '@careeros/career';
import { Application as ApplicationEntity } from '@careeros/career';
import { createApplicationId } from '@careeros/career';

export class ApplicationServiceImpl implements ApplicationService {
  constructor(private readonly applicationRepository: ApplicationRepository) {}

  async createApplication(params: {
    userId: UserId;
    vacancyId: VacancyId;
    resumeId?: ResumeId;
    matchResultId?: string;
    workspaceId?: string;
  }): Promise<Application> {
    const applicationId = createApplicationId(crypto.randomUUID());

    const application = ApplicationEntity.create({
      id: applicationId,
      userId: params.userId,
      vacancyId: params.vacancyId,
      resumeId: params.resumeId,
      matchResultId: params.matchResultId,
    });

    await this.applicationRepository.save(application, { workspaceId: params.workspaceId });

    return application;
  }

  async getById(applicationId: ApplicationId): Promise<Application | null> {
    return this.applicationRepository.findById(applicationId);
  }

  async changeStatus(
    applicationId: ApplicationId,
    newStatus: ApplicationStatus
  ): Promise<void> {
    const application = await this.getOrThrow(applicationId);
    application.changeStatus(newStatus);
    await this.applicationRepository.save(application);
  }

  async addNote(applicationId: ApplicationId, content: string): Promise<void> {
    const application = await this.getOrThrow(applicationId);
    application.addNote(content);
    await this.applicationRepository.save(application);
  }

  async assignRecruiter(applicationId: ApplicationId, recruiterId: RecruiterId): Promise<void> {
    const application = await this.getOrThrow(applicationId);
    application.assignRecruiter(recruiterId);
    await this.applicationRepository.save(application);
  }

  private async getOrThrow(applicationId: ApplicationId): Promise<Application> {
    const application = await this.applicationRepository.findById(applicationId);

    if (!application) {
      throw new Error('Application not found');
    }

    return application;
  }
}
