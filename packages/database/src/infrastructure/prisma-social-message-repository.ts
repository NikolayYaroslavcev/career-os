import type { Prisma } from '@prisma/client';
import { prisma } from '../client.js';
import type {
  SocialMessage,
  SocialMessageId,
  SocialMessageRepository,
  UpsertRawSocialMessageInput,
  SocialPlatform,
  MessageProcessingStatus,
} from '@careeros/career';
import { SocialMessageMapper } from '../mappers/social-message-mapper.js';

function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

export class PrismaSocialMessageRepository implements SocialMessageRepository {
  /**
   * Layer 1 is immutable once written — repeated ingestion of the same
   * (platform, sourceId, externalMessageId) is a no-op against rawText/rawHtml/media,
   * so transports can call this on every poll without corrupting history.
   */
  async upsertRaw(input: UpsertRawSocialMessageInput): Promise<SocialMessage> {
    const record = await prisma.socialMessage.upsert({
      where: {
        platform_sourceId_externalMessageId: {
          platform: input.platform,
          sourceId: input.sourceId,
          externalMessageId: input.externalMessageId,
        },
      },
      create: {
        platform: input.platform,
        sourceId: input.sourceId,
        sourceName: input.sourceName ?? null,
        externalMessageId: input.externalMessageId,
        authorUsername: input.authorUsername ?? null,
        publishedAt: input.publishedAt,
        rawText: input.rawText,
        rawHtml: input.rawHtml ?? null,
        media: toJsonInput(input.media),
        links: toJsonInput(input.links ?? []),
        language: input.language ?? null,
        contentHash: input.contentHash,
        transport: input.transport,
      },
      update: {},
    });
    return SocialMessageMapper.toDomain(record);
  }

  async findById(id: SocialMessageId): Promise<SocialMessage | null> {
    const record = await prisma.socialMessage.findUnique({ where: { id } });
    return record ? SocialMessageMapper.toDomain(record) : null;
  }

  async findBySourceAndExternalId(
    platform: SocialPlatform,
    sourceId: string,
    externalMessageId: string
  ): Promise<SocialMessage | null> {
    const record = await prisma.socialMessage.findUnique({
      where: { platform_sourceId_externalMessageId: { platform, sourceId, externalMessageId } },
    });
    return record ? SocialMessageMapper.toDomain(record) : null;
  }

  async findPendingBySource(platform: SocialPlatform, sourceId: string, limit = 50): Promise<SocialMessage[]> {
    const records = await prisma.socialMessage.findMany({
      where: { platform, sourceId, processingStatus: 'PENDING' },
      orderBy: { publishedAt: 'asc' },
      take: limit,
    });
    return records.map(SocialMessageMapper.toDomain);
  }

  async findPending(limit = 100): Promise<SocialMessage[]> {
    const records = await prisma.socialMessage.findMany({
      where: { processingStatus: 'PENDING' },
      orderBy: { publishedAt: 'asc' },
      take: limit,
    });
    return records.map(SocialMessageMapper.toDomain);
  }

  async findLatestBySource(platform: SocialPlatform, sourceId: string): Promise<SocialMessage | null> {
    const record = await prisma.socialMessage.findFirst({
      where: { platform, sourceId },
      orderBy: { publishedAt: 'desc' },
    });
    return record ? SocialMessageMapper.toDomain(record) : null;
  }

  /** Messages published since `since` for a given source — the per-workspace fetch window. */
  async findBySourceSince(
    platform: SocialPlatform,
    sourceId: string,
    since: Date,
    limit = 200
  ): Promise<SocialMessage[]> {
    const records = await prisma.socialMessage.findMany({
      where: { platform, sourceId, publishedAt: { gte: since } },
      orderBy: { publishedAt: 'asc' },
      take: limit,
    });
    return records.map(SocialMessageMapper.toDomain);
  }

  async updateStatus(id: SocialMessageId, status: MessageProcessingStatus, error?: string | null): Promise<void> {
    await prisma.socialMessage.update({
      where: { id },
      data: { processingStatus: status, processingError: error ?? null },
    });
  }

  async countBySource(platform: SocialPlatform, sourceId: string): Promise<number> {
    return prisma.socialMessage.count({ where: { platform, sourceId } });
  }

  async countBySourceAndStatus(
    platform: SocialPlatform,
    sourceId: string,
    status: MessageProcessingStatus
  ): Promise<number> {
    return prisma.socialMessage.count({ where: { platform, sourceId, processingStatus: status } });
  }
}
