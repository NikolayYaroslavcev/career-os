import type { InterviewId, ApplicationId } from '../base/identifier.js';
import type { Interview } from '../entities/interview.js';

export interface InterviewRepository {
  findById(id: InterviewId): Promise<Interview | null>;
  findByApplicationId(applicationId: ApplicationId): Promise<Interview[]>;
  findUpcomingByApplicationId(applicationId: ApplicationId): Promise<Interview[]>;
  save(interview: Interview): Promise<void>;
  delete(id: InterviewId): Promise<void>;
  exists(id: InterviewId): Promise<boolean>;
}
