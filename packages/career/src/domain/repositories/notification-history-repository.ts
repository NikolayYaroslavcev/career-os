import type { UserId } from '../base/identifier.js';

/**
 * Duplicate-notification guard shared by notification-sending features
 * (currently the morning digest). Deliberately narrower than
 * NotificationRepository — it only answers "was this user already notified
 * about this reference on this channel?" so channels can share history
 * without depending on the full Notification aggregate.
 */
export interface NotificationHistoryRepository {
  /** Returns the subset of referenceIds the user has not yet been notified about on the given channel. */
  filterUnnotified(userId: UserId, referenceIds: readonly string[], channel: string): Promise<readonly string[]>;
  recordNotified(userId: UserId, referenceIds: readonly string[], channel: string): Promise<void>;
}
