import type { NotificationId, UserId } from '../base/identifier.js';
import type { Notification } from '../entities/notification.js';

export interface NotificationRepository {
  findById(id: NotificationId): Promise<Notification | null>;
  findByUserId(userId: UserId): Promise<Notification[]>;
  findUnreadByUserId(userId: UserId): Promise<Notification[]>;
  save(notification: Notification): Promise<void>;
  delete(id: NotificationId): Promise<void>;
  markAllAsReadByUserId(userId: UserId): Promise<void>;
  exists(id: NotificationId): Promise<boolean>;
}
