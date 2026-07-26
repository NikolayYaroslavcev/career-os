import type { ApplicationRepository, FollowUpRepository, TelegramConnectionRepository } from '@careeros/career';
import type { MetricsCollector, Logger } from '@careeros/providers';
import type { TelegramClient } from '@careeros/telegram';
import { buildDefaultFollowUpMessage } from './follow-up-message.js';

export interface FollowUpReminderStats {
  readonly due: number;
  readonly sent: number;
  readonly skipped: number;
  readonly failed: number;
}

/** Only the lookup this service needs — keeps it decoupled from the full repository's write methods. */
export type TelegramDestinationResolver = Pick<TelegramConnectionRepository, 'findByUserId'>;

/**
 * Sweeps due FollowUps and delivers each one over Telegram (the only channel
 * wired up in this MVP — email is future work per ADR-017). Lives in
 * packages/notifications (rather than an app's services folder) so both
 * apps/backend (manual/API trigger) and apps/worker (the recurring
 * BullMQ sweep, EPIC-08) can run the exact same sweep logic.
 */
export class FollowUpReminderService {
  constructor(
    private readonly followUpRepository: FollowUpRepository,
    private readonly applicationRepository: ApplicationRepository,
    private readonly telegramConnectionRepository: TelegramDestinationResolver,
    private readonly telegramClient: TelegramClient,
    private readonly metrics: MetricsCollector,
    private readonly logger: Logger
  ) {}

  async processDue(before: Date = new Date()): Promise<FollowUpReminderStats> {
    const due = await this.followUpRepository.findDue(before);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const followUp of due) {
      const application = await this.applicationRepository.findById(followUp.applicationId);
      if (!application) {
        skipped += 1;
        continue;
      }

      const connection = await this.telegramConnectionRepository.findByUserId(application.userId);
      if (!connection || !connection.isActive) {
        skipped += 1;
        continue;
      }

      const text = followUp.message ?? buildDefaultFollowUpMessage({});
      const result = await this.telegramClient.send(connection.telegramChatId, `⏰ Follow-up reminder\n\n${text}`);

      if (result.success) {
        followUp.markSent();
        await this.followUpRepository.save(followUp);
        sent += 1;
        this.metrics.incrementCounter('careeros.follow_up.reminder_sent');
      } else {
        failed += 1;
        this.metrics.incrementCounter('careeros.follow_up.reminder_failed');
        this.logger.error('Follow-up reminder delivery failed', undefined, {
          followUpId: followUp.id,
          applicationId: followUp.applicationId,
          error: result.error,
        });
      }
    }

    this.logger.info('Follow-up reminder sweep completed', { due: due.length, sent, skipped, failed });

    return { due: due.length, sent, skipped, failed };
  }
}
