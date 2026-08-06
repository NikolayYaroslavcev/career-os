import type { SocialMessageId } from '../base/identifier.js';
import type { SocialMessage } from '../entities/social-message.js';
import type { SocialPlatform } from '../enums/social-platform.js';
import type { MessageProcessingStatus } from '../enums/message-processing-status.js';

export interface UpsertRawSocialMessageInput {
  platform: SocialPlatform;
  sourceId: string;
  sourceName?: string;
  externalMessageId: string;
  authorUsername?: string;
  publishedAt: Date;
  rawText: string;
  rawHtml?: string;
  media?: unknown;
  links?: readonly string[];
  language?: string;
  contentHash: string;
  transport: SocialMessage['transport'];
}

export interface SocialMessageRepository {
  /**
   * Layer 1 ingestion is idempotent on (platform, sourceId, externalMessageId) —
   * repeated polls of the same message are a no-op against already-written content.
   */
  upsertRaw(input: UpsertRawSocialMessageInput): Promise<SocialMessage>;
  findById(id: SocialMessageId): Promise<SocialMessage | null>;
  findBySourceAndExternalId(
    platform: SocialPlatform,
    sourceId: string,
    externalMessageId: string
  ): Promise<SocialMessage | null>;
  findPendingBySource(platform: SocialPlatform, sourceId: string, limit?: number): Promise<SocialMessage[]>;
  findPending(limit?: number): Promise<SocialMessage[]>;
  /**
   * Most recently published message for a source, used to derive an
   * incremental fetch cursor (`{ since: latest.publishedAt }`) — platform-
   * parametrized rather than Telegram-specific, so any SocialPlatform can
   * reuse it for the same purpose.
   */
  findLatestBySource(platform: SocialPlatform, sourceId: string): Promise<SocialMessage | null>;
  /** Messages published since `since` for a given source — the per-workspace fetch window. */
  findBySourceSince(
    platform: SocialPlatform,
    sourceId: string,
    since: Date,
    limit?: number
  ): Promise<SocialMessage[]>;
  updateStatus(id: SocialMessageId, status: MessageProcessingStatus, error?: string | null): Promise<void>;
  countBySource(platform: SocialPlatform, sourceId: string): Promise<number>;
  countBySourceAndStatus(platform: SocialPlatform, sourceId: string, status: MessageProcessingStatus): Promise<number>;
}
