import { AggregateRoot } from '../base/aggregate-root.js';
import type { SocialMessageId } from '../base/identifier.js';
import type { SocialPlatform } from '../enums/social-platform.js';
import type { TransportType } from '../enums/transport-type.js';
import type { MessageProcessingStatus } from '../enums/message-processing-status.js';

export interface SocialMessageProps {
  platform: SocialPlatform;
  /**
   * Platform-native identifier of the source the message came from (a Telegram
   * channel username today; a Discord channel ID, a subreddit, etc. tomorrow).
   * Deliberately not a foreign key to any platform-specific config table —
   * SocialMessage must stay constructible for a platform that has no such
   * table yet.
   */
  sourceId: string;
  sourceName?: string;
  externalMessageId: string;
  authorUsername?: string;
  publishedAt: Date;
  rawText: string;
  rawHtml?: string;
  media?: unknown;
  links: readonly string[];
  language?: string;
  contentHash: string;
  processingStatus: MessageProcessingStatus;
  processingError?: string;
  transport: TransportType;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class SocialMessage extends AggregateRoot<SocialMessageId> {
  private props: SocialMessageProps;

  private constructor(id: SocialMessageId, props: SocialMessageProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: SocialMessageId;
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
    transport: TransportType;
  }): SocialMessage {
    const now = new Date();
    return new SocialMessage(params.id, {
      platform: params.platform,
      sourceId: params.sourceId,
      sourceName: params.sourceName,
      externalMessageId: params.externalMessageId,
      authorUsername: params.authorUsername,
      publishedAt: params.publishedAt,
      rawText: params.rawText,
      rawHtml: params.rawHtml,
      media: params.media,
      links: params.links ?? [],
      language: params.language,
      contentHash: params.contentHash,
      processingStatus: 'PENDING',
      transport: params.transport,
      fetchedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: SocialMessageId, props: SocialMessageProps): SocialMessage {
    return new SocialMessage(id, props);
  }

  get platform(): SocialPlatform {
    return this.props.platform;
  }

  get sourceId(): string {
    return this.props.sourceId;
  }

  get sourceName(): string | undefined {
    return this.props.sourceName;
  }

  get externalMessageId(): string {
    return this.props.externalMessageId;
  }

  get authorUsername(): string | undefined {
    return this.props.authorUsername;
  }

  get publishedAt(): Date {
    return this.props.publishedAt;
  }

  get rawText(): string {
    return this.props.rawText;
  }

  get rawHtml(): string | undefined {
    return this.props.rawHtml;
  }

  get media(): unknown {
    return this.props.media;
  }

  get links(): readonly string[] {
    return this.props.links;
  }

  get language(): string | undefined {
    return this.props.language;
  }

  get contentHash(): string {
    return this.props.contentHash;
  }

  get processingStatus(): MessageProcessingStatus {
    return this.props.processingStatus;
  }

  get processingError(): string | undefined {
    return this.props.processingError;
  }

  get transport(): TransportType {
    return this.props.transport;
  }

  get fetchedAt(): Date {
    return this.props.fetchedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  markStatus(status: MessageProcessingStatus, error?: string): void {
    this.props.processingStatus = status;
    this.props.processingError = error;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}
