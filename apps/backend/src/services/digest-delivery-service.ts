import { createUserId } from '@careeros/career';
import type { NotificationHistoryRepository, TelegramConnectionRepository } from '@careeros/career';
import type { MetricsCollector, Logger } from '@careeros/providers';
import type { TelegramClient, TelegramSendResult } from '@careeros/telegram';
import { MorningDigestService, DIGEST_CHANNEL_TELEGRAM, type MorningDigestParams, type MorningDigestStats } from './morning-digest-service.js';
import type { Digest } from './digest-builder.js';
import type { DigestFormatter } from './digest-formatter.js';

export type DigestDeliveryParams = MorningDigestParams;

export interface DigestDeliveryResult {
  readonly digest: Digest;
  readonly message: string;
  readonly stats: MorningDigestStats;
  readonly send: TelegramSendResult;
}

export class TelegramNotLinkedError extends Error {
  constructor(userId: string) {
    super(`No active Telegram connection for user ${userId}`);
    this.name = 'TelegramNotLinkedError';
  }
}

/** Only the lookup DigestDeliveryService needs — keeps it decoupled from the full repository's write methods. */
export type TelegramDestinationResolver = Pick<TelegramConnectionRepository, 'findByUserId'>;

/**
 * The one place digest generation meets Telegram: resolves the delivery chat
 * from the user's TelegramConnection, builds the digest, formats it, sends
 * it, and records delivery — so MorningDigestService, DigestBuilder and
 * TelegramAdapter can each stay ignorant of the other two, and callers never
 * pass a chatId by hand.
 */
export class DigestDeliveryService {
  constructor(
    private readonly morningDigestService: MorningDigestService,
    private readonly formatter: DigestFormatter<string>,
    private readonly telegramClient: TelegramClient,
    private readonly telegramConnectionRepository: TelegramDestinationResolver,
    private readonly notificationHistoryRepository: NotificationHistoryRepository,
    private readonly metrics: MetricsCollector,
    private readonly logger: Logger
  ) {}

  async deliverNow(params: DigestDeliveryParams): Promise<DigestDeliveryResult> {
    const userId = createUserId(params.userId);
    const connection = await this.telegramConnectionRepository.findByUserId(userId);
    if (!connection || !connection.isActive) {
      throw new TelegramNotLinkedError(params.userId);
    }

    const { digest, recommendations, stats } = await this.morningDigestService.generate(params);
    const message = this.formatter.format(digest);
    const channel = params.channel ?? DIGEST_CHANNEL_TELEGRAM;

    const startedAt = Date.now();
    const send = await this.telegramClient.send(connection.telegramChatId, message);
    const durationMs = Date.now() - startedAt;
    this.metrics.recordHistogram('careeros.digest.telegram_delivery_duration_ms', durationMs);

    if (send.success) {
      this.metrics.incrementCounter('careeros.digest.telegram_delivery_success');
      if (recommendations.length > 0) {
        await this.notificationHistoryRepository.recordNotified(
          userId,
          recommendations.map((recommendation) => recommendation.matchResultId),
          channel
        );
      }
      this.logger.info('Morning digest delivered', {
        userId: params.userId,
        recommendationCount: recommendations.length,
      });
    } else {
      this.metrics.incrementCounter('careeros.digest.telegram_delivery_failure');
      this.logger.error('Morning digest delivery failed', undefined, {
        userId: params.userId,
        error: send.error,
      });
    }

    return { digest, message, stats, send };
  }
}
