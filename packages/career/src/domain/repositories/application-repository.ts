import type { ApplicationId, UserId, VacancyId } from '../base/identifier.js';
import type { Application } from '../entities/application.js';
import type { ApplicationStatus } from '../enums/application-status.js';

export interface SaveApplicationOptions {
  workspaceId?: string;
}

export interface ApplicationRepository {
  findById(id: ApplicationId): Promise<Application | null>;
  findByUserId(userId: UserId): Promise<Application[]>;
  findByUserIdAndStatus(userId: UserId, status: ApplicationStatus): Promise<Application[]>;
  findByVacancyId(vacancyId: VacancyId): Promise<Application[]>;
  findByUserIdAndVacancyId(userId: UserId, vacancyId: VacancyId): Promise<Application | null>;
  save(application: Application, options?: SaveApplicationOptions): Promise<void>;
  delete(id: ApplicationId): Promise<void>;
  exists(id: ApplicationId): Promise<boolean>;
}
