import type { FeedbackRepository } from '@careeros/career';
import type { FeedbackId, UserId, VacancyId } from '@careeros/career';
import type { Feedback } from '@careeros/career';

export class PrismaFeedbackRepository implements FeedbackRepository {
  async findById(_id: FeedbackId): Promise<Feedback | null> {
    // Feedback entity not fully implemented in domain
    return null;
  }

  async findByUserId(_userId: UserId): Promise<Feedback[]> {
    // Feedback entity not fully implemented in domain
    return [];
  }

  async findByVacancyId(_vacancyId: VacancyId): Promise<Feedback[]> {
    // Feedback entity not fully implemented in domain
    return [];
  }

  async findByUserIdAndVacancyId(
    _userId: UserId,
    _vacancyId: VacancyId
  ): Promise<Feedback | null> {
    // Feedback entity not fully implemented in domain
    return null;
  }

  async save(_feedback: Feedback): Promise<void> {
    // Feedback entity not fully implemented in domain
  }

  async delete(_id: FeedbackId): Promise<void> {
    // Feedback entity not fully implemented in domain
  }

  async exists(_id: FeedbackId): Promise<boolean> {
    return false;
  }
}
