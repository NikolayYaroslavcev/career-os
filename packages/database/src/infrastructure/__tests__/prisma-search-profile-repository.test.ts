import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrismaClient, type MockPrismaClient } from '@careeros/test-utils';
import { SearchProfile, createSearchProfileId, createUserId, ExperienceLevel } from '@careeros/career';

const mockPrisma = createMockPrismaClient();

vi.mock('../../client.js', () => ({
  get prisma(): MockPrismaClient {
    return mockPrisma;
  },
}));

const { PrismaSearchProfileRepository } = await import('../prisma-search-profile-repository.js');
const { SearchProfileMapper } = await import('../../mappers/search-profile-mapper.js');

describe('PrismaSearchProfileRepository', () => {
  let prisma: MockPrismaClient;
  let repository: InstanceType<typeof PrismaSearchProfileRepository>;

  beforeEach(() => {
    prisma = mockPrisma;
    vi.clearAllMocks();
    repository = new PrismaSearchProfileRepository();
  });

  const profile = SearchProfile.create({
    id: createSearchProfileId('11111111-1111-4111-8111-111111111111'),
    userId: createUserId('22222222-2222-4222-8222-222222222222'),
    name: 'Remote Roles',
    experienceLevel: ExperienceLevel.SENIOR,
  });

  it('persists a SearchProfile via upsert', async () => {
    (prisma.searchProfile.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await repository.save(profile, { workspaceId: 'workspace-1' });

    expect(prisma.searchProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: profile.id },
        create: expect.objectContaining({ name: 'Remote Roles', isActive: true, workspaceId: 'workspace-1' }),
      })
    );
  });

  it('returns null when a SearchProfile is not found', async () => {
    (prisma.searchProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const found = await repository.findById(createSearchProfileId('missing'));
    expect(found).toBeNull();
  });

  it('finds the active profile for a user, mapped back to the domain entity', async () => {
    const record = SearchProfileMapper.toPersistence(profile, 'workspace-1');
    (prisma.searchProfile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(record);

    const found = await repository.findActiveByUserId(profile.userId);

    expect(prisma.searchProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: profile.userId, isActive: true } })
    );
    expect(found?.name).toBe('Remote Roles');
    expect(found?.isActive).toBe(true);
  });

  it('reports existence based on record count', async () => {
    (prisma.searchProfile.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    await expect(repository.exists(profile.id)).resolves.toBe(true);
  });
});
