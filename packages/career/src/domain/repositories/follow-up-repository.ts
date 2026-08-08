import type { FollowUpId, ApplicationId, UserId } from '../base/identifier.js';
import type { FollowUp } from '../entities/follow-up.js';
import type { FollowUpStatus } from '../enums/follow-up-status.js';

export interface FollowUpRepository {
  findById(id: FollowUpId): Promise<FollowUp | null>;
  findByApplicationId(applicationId: ApplicationId): Promise<FollowUp[]>;
  /** All follow-ups across every application owned by this user — joins through Application. Backs the /follow-ups dashboard and digest. */
  findByUserId(userId: UserId): Promise<FollowUp[]>;
  /** Same join as findByUserId, filtered to the given statuses at the DB level — for callers that only need e.g. pending/snoozed ids, not every follow-up's full row. */
  findByUserIdAndStatuses(userId: UserId, statuses: readonly FollowUpStatus[]): Promise<FollowUp[]>;
  findDue(before: Date): Promise<FollowUp[]>;
  save(followUp: FollowUp): Promise<void>;
  delete(id: FollowUpId): Promise<void>;
}
