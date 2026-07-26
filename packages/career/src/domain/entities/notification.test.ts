import { describe, it, expect } from 'vitest';
import { Notification } from './notification.js';
import { NotificationType } from '../enums/notification-type.js';
import { createUserId, createNotificationId } from '../base/identifier.js';

describe('Notification', () => {
  const userId = createUserId('user-1');
  const notificationId = createNotificationId('notification-1');

  it('should create a notification', () => {
    const notification = Notification.create({
      id: notificationId,
      userId,
      type: NotificationType.FOLLOW_UP_REQUIRED,
      title: 'Follow Up Required',
      message: 'You should follow up with the recruiter',
    });

    expect(notification.id).toBe(notificationId);
    expect(notification.userId).toBe(userId);
    expect(notification.type).toBe(NotificationType.FOLLOW_UP_REQUIRED);
    expect(notification.isRead).toBe(false);
  });

  it('should mark as read', () => {
    const notification = Notification.create({
      id: notificationId,
      userId,
      type: NotificationType.FOLLOW_UP_REQUIRED,
      title: 'Follow Up',
      message: 'Message',
    });

    notification.markAsRead();
    expect(notification.isRead).toBe(true);
    expect(notification.readAt).toBeDefined();
  });

  it('should mark as unread', () => {
    const notification = Notification.create({
      id: notificationId,
      userId,
      type: NotificationType.FOLLOW_UP_REQUIRED,
      title: 'Follow Up',
      message: 'Message',
    });

    notification.markAsRead();
    notification.markAsUnread();

    expect(notification.isRead).toBe(false);
    expect(notification.readAt).toBeUndefined();
  });

  it('should not double-mark as read', () => {
    const notification = Notification.create({
      id: notificationId,
      userId,
      type: NotificationType.FOLLOW_UP_REQUIRED,
      title: 'Follow Up',
      message: 'Message',
    });

    notification.markAsRead();
    const firstReadAt = notification.readAt;

    notification.markAsRead();
    expect(notification.readAt).toBe(firstReadAt);
  });

  it('should store metadata', () => {
    const notification = Notification.create({
      id: notificationId,
      userId,
      type: NotificationType.APPLICATION_STATUS_CHANGED,
      title: 'Status Changed',
      message: 'Your application status changed',
      metadata: { applicationId: 'app-1', newStatus: 'interview' },
    });

    expect(notification.metadata).toEqual({ applicationId: 'app-1', newStatus: 'interview' });
  });
});
