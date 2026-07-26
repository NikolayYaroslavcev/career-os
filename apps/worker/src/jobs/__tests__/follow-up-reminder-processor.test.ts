import { describe, it, expect, vi } from 'vitest';
import type { Job } from 'bullmq';
import type { FollowUpReminderService, FollowUpReminderStats } from '@careeros/notifications';
import { createFollowUpReminderJobHandler } from '../follow-up-reminder-processor.js';

describe('createFollowUpReminderJobHandler', () => {
  it('delegates to FollowUpReminderService.processDue and returns its stats', async () => {
    const stats: FollowUpReminderStats = { due: 3, sent: 2, skipped: 1, failed: 0 };
    const processDue = vi.fn().mockResolvedValue(stats);
    const service = { processDue } as unknown as FollowUpReminderService;

    const handler = createFollowUpReminderJobHandler(service);
    const result = await handler({} as Job);

    expect(processDue).toHaveBeenCalledTimes(1);
    expect(result).toEqual(stats);
  });
});
