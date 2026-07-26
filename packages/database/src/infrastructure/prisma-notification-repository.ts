import type { NotificationRepository } from '@careeros/career';
import type { NotificationId, UserId } from '@careeros/career';
import type { Notification } from '@careeros/career';

export class PrismaNotificationRepository implements NotificationRepository {
  async findById(_id: NotificationId): Promise<Notification | null> {
    // Notification entity not fully implemented in domain
    return null;
  }

  async findByUserId(_userId: UserId): Promise<Notification[]> {
    // Notification entity not fully implemented in domain
    return [];
  }

  async findUnreadByUserId(_userId: UserId): Promise<Notification[]> {
    // Notification entity not fully implemented in domain
    return [];
  }

  async save(_notification: Notification): Promise<void> {
    // Notification entity not fully implemented in domain
  }

  async delete(_id: NotificationId): Promise<void> {
    // Notification entity not fully implemented in domain
  }

  async markAllAsReadByUserId(_userId: UserId): Promise<void> {
    // Notification entity not fully implemented in domain
  }

  async exists(_id: NotificationId): Promise<boolean> {
    return false;
  }
}
