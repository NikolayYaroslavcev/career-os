import type { Job } from 'bullmq';
import type { FollowUpReminderService, FollowUpReminderStats } from '@careeros/notifications';

/**
 * Processes one recurring "sweep due follow-ups" job (EPIC-08 reminder
 * worker): delegates straight to FollowUpReminderService.processDue(), the
 * same sweep apps/backend's demo:follow-up-reminder script triggers by hand.
 */
export function createFollowUpReminderJobHandler(followUpReminderService: FollowUpReminderService) {
  return async (_job: Job): Promise<FollowUpReminderStats> => followUpReminderService.processDue();
}
