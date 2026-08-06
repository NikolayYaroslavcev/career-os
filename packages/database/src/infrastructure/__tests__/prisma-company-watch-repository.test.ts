import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrismaClient, type MockPrismaClient } from '@careeros/test-utils';
import type { CompanyWatchData } from '@careeros/company-watch';

const mockPrisma = createMockPrismaClient();

vi.mock('../../client.js', () => ({
  get prisma(): MockPrismaClient {
    return mockPrisma;
  },
}));

const { PrismaCompanyWatchRepository } = await import('../prisma-company-watch-repository.js');

describe('PrismaCompanyWatchRepository', () => {
  let prisma: MockPrismaClient;
  let repository: InstanceType<typeof PrismaCompanyWatchRepository>;

  const companyWatch: CompanyWatchData = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Acme Corp',
    aliases: ['Acme', 'Acme Inc'],
    country: 'US',
    languages: ['en'],
    tags: ['fintech', 'remote-first'],
    atsType: 'GREENHOUSE',
    careerUrl: 'https://acme.com/careers',
    atsEndpoint: 'acme',
    pollingInterval: 3600,
    active: true,
    workspaceId: 'workspace-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    consecutiveFailureCount: 0,
    healthStatus: 'ACTIVE',
    priorityScore: 50,
  };

  beforeEach(() => {
    prisma = mockPrisma;
    vi.clearAllMocks();
    repository = new PrismaCompanyWatchRepository();
  });

  it('creates a CompanyWatch row', async () => {
    (prisma.companyWatch.create as ReturnType<typeof vi.fn>).mockResolvedValue(companyWatch);

    const created = await repository.create(companyWatch);

    expect(prisma.companyWatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Acme Corp', atsType: 'GREENHOUSE', workspaceId: 'workspace-1' }),
      })
    );
    expect(created.name).toBe('Acme Corp');
  });

  it('reads a CompanyWatch back by id with every field preserved', async () => {
    (prisma.companyWatch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(companyWatch);

    const found = await repository.findById(companyWatch.id);

    expect(found?.name).toBe('Acme Corp');
    expect(found?.aliases).toEqual(['Acme', 'Acme Inc']);
    expect(found?.atsType).toBe('GREENHOUSE');
    expect(found?.careerUrl).toBe('https://acme.com/careers');
    expect(found?.pollingInterval).toBe(3600);
    expect(found?.active).toBe(true);
    expect(found?.workspaceId).toBe('workspace-1');
  });

  it('returns null when a CompanyWatch is not found', async () => {
    (prisma.companyWatch.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(repository.findById('missing')).resolves.toBeNull();
  });

  it('updates a CompanyWatch row', async () => {
    const updated = { ...companyWatch, active: false };
    (prisma.companyWatch.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const result = await repository.update(updated);

    expect(prisma.companyWatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: companyWatch.id }, data: expect.objectContaining({ active: false }) })
    );
    expect(result.active).toBe(false);
  });

  it('deletes a CompanyWatch row', async () => {
    (prisma.companyWatch.delete as ReturnType<typeof vi.fn>).mockResolvedValue(companyWatch);
    await repository.delete(companyWatch.id);
    expect(prisma.companyWatch.delete).toHaveBeenCalledWith({ where: { id: companyWatch.id } });
  });

  it('lists all CompanyWatch rows for a workspace', async () => {
    (prisma.companyWatch.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([companyWatch]);
    const results = await repository.findAllByWorkspace('workspace-1');
    expect(results).toHaveLength(1);
    expect(prisma.companyWatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'workspace-1' } })
    );
  });

  it('upserts on the (workspaceId, name) unique key', async () => {
    (prisma.companyWatch.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(companyWatch);

    await repository.upsert({
      where: { workspaceId_name: { workspaceId: 'workspace-1', name: 'Acme Corp' } },
      create: { name: 'Acme Corp', atsType: 'GREENHOUSE', careerUrl: 'https://acme.com/careers' },
      update: { active: false },
    });

    expect(prisma.companyWatch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId_name: { workspaceId: 'workspace-1', name: 'Acme Corp' } },
      })
    );
  });
});
