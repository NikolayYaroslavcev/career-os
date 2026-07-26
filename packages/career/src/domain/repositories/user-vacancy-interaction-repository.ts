import type { UserId, VacancyId } from '../base/identifier.js';

export type InteractionAction = 'VIEW' | 'SAVE' | 'APPLY' | 'HIDE' | 'IGNORE';

export interface UserVacancyInteractionData {
  readonly id: string;
  readonly userId: UserId;
  readonly vacancyId: VacancyId;
  readonly action: InteractionAction;
  readonly createdAt: Date;
}

export interface UserVacancyInteractionRepository {
  record(input: { userId: UserId; vacancyId: VacancyId; action: InteractionAction }): Promise<void>;
  findByUserId(userId: UserId, options?: { action?: InteractionAction; since?: Date; limit?: number }): Promise<UserVacancyInteractionData[]>;
  findByUserIdAndVacancyId(userId: UserId, vacancyId: VacancyId): Promise<UserVacancyInteractionData[]>;
  countByAction(userId: UserId, action: InteractionAction, options?: { since?: Date }): Promise<number>;
  getTechnologiesFromInteractedVacancies(userId: UserId, action: InteractionAction, options?: { since?: Date; limit?: number }): Promise<string[]>;
}
