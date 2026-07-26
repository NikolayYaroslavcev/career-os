import { AggregateRoot } from '../base/aggregate-root.js';
import type { NotificationId, UserId } from '../base/identifier.js';
import { NotificationType } from '../enums/notification-type.js';

interface NotificationProps {
  userId: UserId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  readAt?: Date;
}

export class Notification extends AggregateRoot<NotificationId> {
  private props: NotificationProps;

  private constructor(id: NotificationId, props: NotificationProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: NotificationId;
    userId: UserId;
    type: NotificationType;
    title: string;
    message: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }): Notification {
    const now = new Date();

    return new Notification(params.id, {
      userId: params.userId,
      type: params.type,
      title: params.title.trim(),
      message: params.message.trim(),
      isRead: false,
      actionUrl: params.actionUrl,
      metadata: params.metadata,
      createdAt: now,
    });
  }

  static reconstitute(id: NotificationId, props: NotificationProps): Notification {
    return new Notification(id, props);
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get type(): NotificationType {
    return this.props.type;
  }

  get title(): string {
    return this.props.title;
  }

  get message(): string {
    return this.props.message;
  }

  get isRead(): boolean {
    return this.props.isRead;
  }

  get actionUrl(): string | undefined {
    return this.props.actionUrl;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get readAt(): Date | undefined {
    return this.props.readAt;
  }

  markAsRead(): void {
    if (!this.props.isRead) {
      this.props.isRead = true;
      this.props.readAt = new Date();
    }
  }

  markAsUnread(): void {
    this.props.isRead = false;
    this.props.readAt = undefined;
  }
}
