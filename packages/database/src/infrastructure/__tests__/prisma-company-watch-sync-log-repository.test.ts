import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrismaClient, type MockPrismaClient } from '@careeros/test-utils';
import type { CompanyWatchSyncLogData } from '../prisma-company-watch-sync-log-repository.js';

const mockPrisma = createMockPrismaClient();

vi.mock('../../client.js', () => ({
  get prisma(): MockPrismaClient {
    return mockPrisma;
  },
}));

const { PrismaCompanyWatchSyncLogRepository } = await import('../prisma-company-watch-sync-log-repository.js');

describe('PrismaCompanyWatchSyncLogRepository', () => {
  let prisma: MockPrismaClient;
  let repository: InstanceType<typeof PrismaCompanyWatchSyncLogRepository>;

  const log: CompanyWatchSyncLogData = {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'SUCCESS',
    jobsFound: 12,
    newJobs: 3,
    removedJobs: 1,
    changedJobs: 2,
    durationMs: 4500,
    startedAt: new Date('2024-01-01T00:00:00Z'),
    completedAt: new Date('2024-01-01T00:00:04.5Z'),
    companyWatchId: 'watch-1',
  };

  beforeEach(() => {
    prisma = mockPrisma;
    vi.clearAllMocks();
    repository = new PrismaCompanyWatchSyncLogRepository();
  });

  it('creates a CompanyWatchSyncLog row', async () => {
    (prisma.companyWatchSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...log,
      error: null,
      completedAt: log.completedAt ?? null,
    });

    const created = await repository.create(log);

    expect(prisma.companyWatchSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS', jobsFound: 12, companyWatchId: 'watch-1' }) })
    );
    expect(created.newJobs).toBe(3);
  });

  it('reads a CompanyWatchSyncLog back by id', async () => {
    (prisma.companyWatchSyncLog.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...log,
      error: null,
      completedAt: log.completedAt ?? null,
    });

    const found = await repository.findById(log.id);
    expect(found?.status).toBe('SUCCESS');
    expect(found?.jobsFound).toBe(12);
    expect(found?.durationMs).toBe(4500);
  });

  it('returns null when a CompanyWatchSyncLog is not found', async () => {
    (prisma.companyWatchSyncLog.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(repository.findById('missing')).resolves.toBeNull();
  });

  it('finds the latest sync log for a CompanyWatch ordered by startedAt desc', async () => {
    (prisma.companyWatchSyncLog.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...log,
      error: null,
      completedAt: log.completedAt ?? null,
    });

    const found = await repository.findLatestByCompanyWatch('watch-1');
    expect(prisma.companyWatchSyncLog.findFirst).toHaveBeenCalledWith({
      where: { companyWatchId: 'watch-1' },
      orderBy: { startedAt: 'desc' },
    });
    expect(found?.status).toBe('SUCCESS');
  });

  it('updates a CompanyWatchSyncLog row', async () => {
    const updated = { ...log, status: 'FAILED' as const, error: 'Timeout' };
    (prisma.companyWatchSyncLog.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const result = await repository.update(updated);
    expect(result.status).toBe('FAILED');
    expect(result.error).toBe('Timeout');
  });

  it('deletes a CompanyWatchSyncLog row', async () => {
    (prisma.companyWatchSyncLog.delete as ReturnType<typeof vi.fn>).mockResolvedValue(log);
    await repository.delete(log.id);
    expect(prisma.companyWatchSyncLog.delete).toHaveBeenCalledWith({ where: { id: log.id } });
  });
});
