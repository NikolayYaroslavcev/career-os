import { AggregateRoot } from '../base/aggregate-root.js';
import type { TelegramConnectionId, UserId } from '../base/identifier.js';
import { TelegramConnectionStatus } from '../enums/telegram-connection-status.js';

interface TelegramConnectionProps {
  userId: UserId;
  telegramChatId: string;
  telegramUsername?: string;
  status: TelegramConnectionStatus;
  verifiedAt: Date;
  createdAt: Date;
}

/**
 * A verified link between a CareerOS user and a Telegram chat. Deliberately
 * kept off the User aggregate — Telegram is one of several notification
 * channels a user may have, not an identity property of the user.
 */
export class TelegramConnection extends AggregateRoot<TelegramConnectionId> {
  private props: TelegramConnectionProps;

  private constructor(id: TelegramConnectionId, props: TelegramConnectionProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: TelegramConnectionId;
    userId: UserId;
    telegramChatId: string;
    telegramUsername?: string;
    verifiedAt?: Date;
  }): TelegramConnection {
    const telegramChatId = params.telegramChatId.trim();
    if (telegramChatId.length === 0) {
      throw new Error('telegramChatId cannot be empty');
    }

    const now = params.verifiedAt ?? new Date();

    return new TelegramConnection(params.id, {
      userId: params.userId,
      telegramChatId,
      telegramUsername: params.telegramUsername?.trim() || undefined,
      status: TelegramConnectionStatus.ACTIVE,
      verifiedAt: now,
      createdAt: now,
    });
  }

  static reconstitute(id: TelegramConnectionId, props: TelegramConnectionProps): TelegramConnection {
    return new TelegramConnection(id, props);
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get telegramChatId(): string {
    return this.props.telegramChatId;
  }

  get telegramUsername(): string | undefined {
    return this.props.telegramUsername;
  }

  get status(): TelegramConnectionStatus {
    return this.props.status;
  }

  get isActive(): boolean {
    return this.props.status === TelegramConnectionStatus.ACTIVE;
  }

  get verifiedAt(): Date {
    return this.props.verifiedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Re-points an existing connection at a new chat/username (re-linking), re-activating it if it had been revoked. */
  reverify(telegramChatId: string, telegramUsername?: string): void {
    const trimmed = telegramChatId.trim();
    if (trimmed.length === 0) {
      throw new Error('telegramChatId cannot be empty');
    }

    this.props.telegramChatId = trimmed;
    this.props.telegramUsername = telegramUsername?.trim() || undefined;
    this.props.status = TelegramConnectionStatus.ACTIVE;
    this.props.verifiedAt = new Date();
    this.incrementVersion();
  }

  revoke(): void {
    this.props.status = TelegramConnectionStatus.REVOKED;
    this.incrementVersion();
  }
}
