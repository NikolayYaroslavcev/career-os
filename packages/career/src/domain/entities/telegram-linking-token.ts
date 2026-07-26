import { AggregateRoot } from '../base/aggregate-root.js';
import type { TelegramLinkingTokenId, UserId } from '../base/identifier.js';

interface TelegramLinkingTokenProps {
  userId: UserId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

/**
 * The one-time code a user generates on the dashboard and redeems via the
 * Telegram bot's `/start <code>`. Only the hash is ever persisted — the
 * plaintext code exists solely in the response returned at generation time
 * and in the Telegram message the user sends back.
 */
export class TelegramLinkingToken extends AggregateRoot<TelegramLinkingTokenId> {
  private props: TelegramLinkingTokenProps;

  private constructor(id: TelegramLinkingTokenId, props: TelegramLinkingTokenProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: TelegramLinkingTokenId;
    userId: UserId;
    tokenHash: string;
    expiresAt: Date;
    createdAt?: Date;
  }): TelegramLinkingToken {
    return new TelegramLinkingToken(params.id, {
      userId: params.userId,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
      createdAt: params.createdAt ?? new Date(),
    });
  }

  static reconstitute(id: TelegramLinkingTokenId, props: TelegramLinkingTokenProps): TelegramLinkingToken {
    return new TelegramLinkingToken(id, props);
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get usedAt(): Date | undefined {
    return this.props.usedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  isUsed(): boolean {
    return this.props.usedAt !== undefined;
  }

  isExpired(now: Date = new Date()): boolean {
    return now.getTime() >= this.props.expiresAt.getTime();
  }

  isValid(now: Date = new Date()): boolean {
    return !this.isUsed() && !this.isExpired(now);
  }

  /** Single-use enforcement: throws if the token was already redeemed or has expired. */
  markUsed(now: Date = new Date()): void {
    if (this.isUsed()) {
      throw new Error('Linking token has already been used');
    }
    if (this.isExpired(now)) {
      throw new Error('Linking token has expired');
    }
    this.props.usedAt = now;
    this.incrementVersion();
  }
}
