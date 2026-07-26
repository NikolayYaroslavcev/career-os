import type { FeedbackId, UserId, VacancyId } from '../base/identifier.js';
import type { Feedback } from '../entities/feedback.js';

export interface FeedbackRepository {
  findById(id: FeedbackId): Promise<Feedback | null>;
  findByUserId(userId: UserId): Promise<Feedback[]>;
  findByVacancyId(vacancyId: VacancyId): Promise<Feedback[]>;
  findByUserIdAndVacancyId(userId: UserId, vacancyId: VacancyId): Promise<Feedback | null>;
  save(feedback: Feedback): Promise<void>;
  delete(id: FeedbackId): Promise<void>;
  exists(id: FeedbackId): Promise<boolean>;
}
