import type { Application } from '../entities/application.js';
import type { ApplicationId, UserId, VacancyId, ResumeId, RecruiterId } from '../base/identifier.js';
import type { ApplicationStatus } from '../enums/application-status.js';

export interface ApplicationService {
  createApplication(params: {
    userId: UserId;
    vacancyId: VacancyId;
    resumeId?: ResumeId;
    matchResultId?: string;
    workspaceId?: string;
  }): Promise<Application>;

  getById(applicationId: ApplicationId): Promise<Application | null>;

  changeStatus(applicationId: ApplicationId, newStatus: ApplicationStatus): Promise<void>;

  addNote(applicationId: ApplicationId, content: string): Promise<void>;

  assignRecruiter(applicationId: ApplicationId, recruiterId: RecruiterId): Promise<void>;
}
