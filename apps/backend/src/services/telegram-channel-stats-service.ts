import type { TelegramChannelStatsData, UpsertTelegramChannelStatsInput } from '@careeros/database';

interface TelegramChannelStatsRepo {
  upsert(channelId: string, data: UpsertTelegramChannelStatsInput): Promise<TelegramChannelStatsData>;
  computeChannelMetrics(channelUsername: string): Promise<UpsertTelegramChannelStatsInput>;
}

/**
 * A channel needs at least this many messages in the observed window before
 * its activity score counts toward the full 20% weight below — avoids a
 * brand-new or low-volume channel's one lucky/unlucky message swinging the
 * score as hard as an established channel's real track record.
 */
const ACTIVITY_CEILING_MESSAGES = 20;

/**
 * Deterministic 0-100 per-channel quality score, no AI. Mirrors the
 * weighted-average shape ProviderManagementService.calculateProviderQuality()
 * already uses for provider-level scores. A channel with zero messages
 * scores 0 — an unambiguous signal for the retirement-candidate list (see
 * ADR-032 addendum on channel tiers; auto-cleanup itself stays manual).
 */
export function computeChannelQualityScore(stats: UpsertTelegramChannelStatsInput): number {
  if (stats.totalMessages === 0) return 0;

  const extractionSuccessScore = stats.successRate;
  const uniqueVacancyScore = 1 - stats.duplicateRate;
  const spamScore = 1 - stats.spamRate;
  const activityScore = Math.min(stats.totalMessages / ACTIVITY_CEILING_MESSAGES, 1);

  const weighted =
    extractionSuccessScore * 0.35 +
    uniqueVacancyScore * 0.25 +
    spamScore * 0.2 +
    activityScore * 0.2;

  return Math.round(Math.max(0, Math.min(1, weighted)) * 100);
}

export class TelegramChannelStatsService {
  constructor(private readonly statsRepo: TelegramChannelStatsRepo) {}

  async computeAndPersist(channelUsername: string, channelId: string): Promise<TelegramChannelStatsData> {
    const metrics = await this.statsRepo.computeChannelMetrics(channelUsername);
    return this.statsRepo.upsert(channelId, metrics);
  }

  async computeAndPersistAll(channels: readonly { username: string; id: string }[]): Promise<void> {
    for (const channel of channels) {
      await this.computeAndPersist(channel.username, channel.id);
    }
  }
}
