import { describe, it, expect, vi } from 'vitest';
import { ManualDigestScheduler } from '../digest-scheduler.js';
import type { DigestDeliveryService, DigestDeliveryResult } from '../digest-delivery-service.js';

function buildStubDeliveryService(result: DigestDeliveryResult): DigestDeliveryService {
  return { deliverNow: vi.fn().mockResolvedValue(result) } as unknown as DigestDeliveryService;
}

describe('ManualDigestScheduler', () => {
  it('remembers a daily schedule config without executing it (cron infra is deferred)', () => {
    const deliveryService = buildStubDeliveryService({} as DigestDeliveryResult);
    const scheduler = new ManualDigestScheduler(deliveryService);

    scheduler.scheduleDaily({ userId: 'user-1', hourUtc: 7, minuteUtc: 30 });

    expect(scheduler.getScheduledConfigs()).toEqual([{ userId: 'user-1', hourUtc: 7, minuteUtc: 30 }]);
    expect(deliveryService.deliverNow).not.toHaveBeenCalled();
  });

  it('replaces an existing schedule for the same user', () => {
    const deliveryService = buildStubDeliveryService({} as DigestDeliveryResult);
    const scheduler = new ManualDigestScheduler(deliveryService);

    scheduler.scheduleDaily({ userId: 'user-1', hourUtc: 7, minuteUtc: 0 });
    scheduler.scheduleDaily({ userId: 'user-1', hourUtc: 9, minuteUtc: 0 });

    expect(scheduler.getScheduledConfigs()).toEqual([{ userId: 'user-1', hourUtc: 9, minuteUtc: 0 }]);
  });

  it('triggerNow delegates directly to DigestDeliveryService.deliverNow', async () => {
    const expected = { digest: {}, message: 'hi', stats: {}, send: { success: true, messageId: 1 } } as unknown as DigestDeliveryResult;
    const deliveryService = buildStubDeliveryService(expected);
    const scheduler = new ManualDigestScheduler(deliveryService);

    const result = await scheduler.triggerNow({ userId: 'user-1' });

    expect(deliveryService.deliverNow).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(result).toBe(expected);
  });
});
