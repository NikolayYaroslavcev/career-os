import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrismaClient, type MockPrismaClient } from '@careeros/test-utils';

const mockPrisma = createMockPrismaClient();

vi.mock('../../client.js', () => ({
  get prisma(): MockPrismaClient {
    return mockPrisma;
  },
}));

const { PrismaRefreshTokenRepository } = await import('../prisma-refresh-token-repository.js');

describe('PrismaRefreshTokenRepository', () => {
  let prisma: MockPrismaClient;
  let repository: InstanceType<typeof PrismaRefreshTokenRepository>;

  const record = {
    id: 'rt-1',
    userId: 'user-1',
    token: 'refresh-token-value',
    expiresAt: new Date('2026-08-09'),
    createdAt: new Date('2026-08-02'),
  };

  beforeEach(() => {
    prisma = mockPrisma;
    vi.clearAllMocks();
    repository = new PrismaRefreshTokenRepository();
  });

  it('creates a refresh token record with the exact fields provided', async () => {
    (prisma.refreshToken.create as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await repository.create(record);

    expect(prisma.refreshToken.create).toHaveBeenCalledWith({ data: record });
  });

  it('finds a refresh token by its token value', async () => {
    (prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const found = await repository.findByToken('refresh-token-value');

    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({ where: { token: 'refresh-token-value' } });
    expect(found).toEqual(record);
  });

  it('returns null when no refresh token matches', async () => {
    (prisma.refreshToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const found = await repository.findByToken('missing-token');

    expect(found).toBeNull();
  });

  it('deletes a refresh token by its token value (single-session logout)', async () => {
    (prisma.refreshToken.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await repository.delete('refresh-token-value');

    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { token: 'refresh-token-value' } });
  });

  it('deletes every refresh token for a user (logout-all / multiple active sessions)', async () => {
    (prisma.refreshToken.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 });

    await repository.deleteAllForUser('user-1');

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('deletes only tokens whose expiresAt is in the past', async () => {
    (prisma.refreshToken.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });

    await repository.deleteExpired();

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });
});
