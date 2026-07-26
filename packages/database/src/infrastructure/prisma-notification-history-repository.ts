import type { NotificationHistoryRepository } from '@careeros/career';
import type { UserId } from '@careeros/career';
import { prisma } from '../client.js';

const NOTIFICATION_TYPE = 'digest_recommendation_delivered';
const RECENT_HISTORY_LIMIT = 500;

type SupportedChannel = 'TELEGRAM' | 'EMAIL' | 'DISCORD' | 'SLACK';

/**
 * Reuses the existing Notification table as a dedup log instead of adding a
 * new one — one row per (user, channel, referenceId) marks "already sent".
 */
export class PrismaNotificationHistoryRepository implements NotificationHistoryRepository {
  async filterUnnotified(
    userId: UserId,
    referenceIds: readonly string[],
    channel: string
  ): Promise<readonly string[]> {
    if (referenceIds.length === 0) return [];

    const records = await prisma.notification.findMany({
      where: { userId, channel: toPrismaChannel(channel), type: NOTIFICATION_TYPE },
      select: { metadata: true },
      orderBy: { sentAt: 'desc' },
      take: RECENT_HISTORY_LIMIT,
    });

    const alreadyNotified = new Set(records.map((record) => extractReferenceId(record.metadata)).filter(isString));

    return referenceIds.filter((id) => !alreadyNotified.has(id));
  }

  async recordNotified(userId: UserId, referenceIds: readonly string[], channel: string): Promise<void> {
    if (referenceIds.length === 0) return;

    await prisma.notification.createMany({
      data: referenceIds.map((referenceId) => ({
        userId,
        channel: toPrismaChannel(channel),
        type: NOTIFICATION_TYPE,
        title: 'Digest recommendation delivered',
        body: referenceId,
        metadata: { referenceId },
      })),
    });
  }
}

function extractReferenceId(metadata: unknown): unknown {
  if (metadata && typeof metadata === 'object' && 'referenceId' in metadata) {
    return (metadata as { referenceId: unknown }).referenceId;
  }
  return undefined;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function toPrismaChannel(channel: string): SupportedChannel {
  const upper = channel.toUpperCase();
  if (upper === 'TELEGRAM' || upper === 'EMAIL' || upper === 'DISCORD' || upper === 'SLACK') {
    return upper;
  }
  throw new Error(`Unsupported notification channel: ${channel}`);
}
