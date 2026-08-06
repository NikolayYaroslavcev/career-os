import { SocialMessage, createSocialMessageId } from '@careeros/career';
import type { SocialPlatform, TransportType, MessageProcessingStatus } from '@careeros/career';

interface PrismaSocialMessage {
  id: string;
  platform: string;
  sourceId: string;
  sourceName: string | null;
  externalMessageId: string;
  authorUsername: string | null;
  publishedAt: Date;
  rawText: string;
  rawHtml: string | null;
  media: unknown;
  links: unknown;
  language: string | null;
  contentHash: string;
  processingStatus: string;
  processingError: string | null;
  transport: string;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class SocialMessageMapper {
  static toDomain(record: PrismaSocialMessage): SocialMessage {
    return SocialMessage.reconstitute(createSocialMessageId(record.id), {
      platform: record.platform as SocialPlatform,
      sourceId: record.sourceId,
      sourceName: record.sourceName ?? undefined,
      externalMessageId: record.externalMessageId,
      authorUsername: record.authorUsername ?? undefined,
      publishedAt: record.publishedAt,
      rawText: record.rawText,
      rawHtml: record.rawHtml ?? undefined,
      media: record.media ?? undefined,
      links: (record.links as string[]) ?? [],
      language: record.language ?? undefined,
      contentHash: record.contentHash,
      processingStatus: record.processingStatus as MessageProcessingStatus,
      processingError: record.processingError ?? undefined,
      transport: record.transport as TransportType,
      fetchedAt: record.fetchedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
