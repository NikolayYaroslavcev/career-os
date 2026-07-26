import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrismaClient, type MockPrismaClient } from '@careeros/test-utils';
import { createUserId } from '@careeros/career';

const mockPrisma = createMockPrismaClient();

vi.mock('../../client.js', () => ({
  get prisma(): MockPrismaClient {
    return mockPrisma;
  },
}));

const { PrismaNotificationHistoryRepository } = await import('../prisma-notification-history-repository.js');

describe('PrismaNotificationHistoryRepository', () => {
  let prisma: MockPrismaClient;
  let repository: InstanceType<typeof PrismaNotificationHistoryRepository>;

  const userId = createUserId('11111111-1111-4111-8111-111111111111');

  beforeEach(() => {
    prisma = mockPrisma;
    vi.clearAllMocks();
    repository = new PrismaNotificationHistoryRepository();
  });

  it('returns all referenceIds as unnotified when there is no history', async () => {
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await repository.filterUnnotified(userId, ['match-1', 'match-2'], 'telegram');

    expect(result).toEqual(['match-1', 'match-2']);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, channel: 'TELEGRAM', type: 'digest_recommendation_delivered' },
      })
    );
  });

  it('excludes referenceIds already recorded in Notification metadata', async () => {
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { metadata: { referenceId: 'match-1' } },
    ]);

    const result = await repository.filterUnnotified(userId, ['match-1', 'match-2'], 'telegram');

    expect(result).toEqual(['match-2']);
  });

  it('short-circuits without a query when referenceIds is empty', async () => {
    const result = await repository.filterUnnotified(userId, [], 'telegram');

    expect(result).toEqual([]);
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });

  it('records notified referenceIds as Notification rows via createMany', async () => {
    (prisma.notification.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });

    await repository.recordNotified(userId, ['match-1', 'match-2'], 'telegram');

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId, channel: 'TELEGRAM', metadata: { referenceId: 'match-1' } }),
        expect.objectContaining({ userId, channel: 'TELEGRAM', metadata: { referenceId: 'match-2' } }),
      ],
    });
  });

  it('short-circuits recordNotified without a write when referenceIds is empty', async () => {
    await repository.recordNotified(userId, [], 'telegram');

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('rejects an unsupported channel', async () => {
    await expect(repository.filterUnnotified(userId, ['match-1'], 'carrier_pigeon')).rejects.toThrow(
      'Unsupported notification channel'
    );
  });
});
