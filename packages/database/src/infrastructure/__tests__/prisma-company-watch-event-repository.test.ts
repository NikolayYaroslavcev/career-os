import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrismaClient, type MockPrismaClient } from '@careeros/test-utils';
import type { CompanyWatchEventData } from '../prisma-company-watch-event-repository.js';

const mockPrisma = createMockPrismaClient();

vi.mock('../../client.js', () => ({
  get prisma(): MockPrismaClient {
    return mockPrisma;
  },
}));

const { PrismaCompanyWatchEventRepository } = await import('../prisma-company-watch-event-repository.js');

describe('PrismaCompanyWatchEventRepository', () => {
  let prisma: MockPrismaClient;
  let repository: InstanceType<typeof PrismaCompanyWatchEventRepository>;

  const event: CompanyWatchEventData = {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'NEW_JOB',
    externalId: 'ext-1',
    title: 'Senior Engineer',
    description: 'A new role appeared.',
    url: 'https://acme.com/careers/senior-engineer',
    location: 'Remote',
    salary: { min: 90000, max: 130000, currency: 'USD' },
    technologies: ['typescript'],
    publishedAt: new Date('2024-01-01'),
    detectedAt: new Date('2024-01-02'),
    processed: false,
    companyWatchId: 'watch-1',
  };

  beforeEach(() => {
    prisma = mockPrisma;
    vi.clearAllMocks();
    repository = new PrismaCompanyWatchEventRepository();
  });

  it('creates a CompanyWatchEvent row preserving the salary JSON payload', async () => {
    (prisma.companyWatchEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...event,
      externalId: event.externalId ?? null,
      title: event.title ?? null,
      description: event.description ?? null,
      url: event.url ?? null,
      location: event.location ?? null,
      publishedAt: event.publishedAt ?? null,
      notifiedAt: null,
      metadata: null,
    });

    const created = await repository.create(event);

    expect(prisma.companyWatchEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'NEW_JOB', companyWatchId: 'watch-1', salary: event.salary }),
      })
    );
    expect(created.salary).toEqual({ min: 90000, max: 130000, currency: 'USD' });
    expect(created.type).toBe('NEW_JOB');
  });

  it('reads a CompanyWatchEvent back by id', async () => {
    (prisma.companyWatchEvent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...event,
      externalId: event.externalId ?? null,
      title: event.title ?? null,
      description: event.description ?? null,
      url: event.url ?? null,
      location: event.location ?? null,
      publishedAt: event.publishedAt ?? null,
      notifiedAt: null,
      metadata: null,
    });

    const found = await repository.findById(event.id);
    expect(found?.title).toBe('Senior Engineer');
    expect(found?.technologies).toEqual(['typescript']);
  });

  it('returns null when a CompanyWatchEvent is not found', async () => {
    (prisma.companyWatchEvent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(repository.findById('missing')).resolves.toBeNull();
  });

  it('marks an event processed via update', async () => {
    (prisma.companyWatchEvent.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...event,
      externalId: event.externalId ?? null,
      title: event.title ?? null,
      description: event.description ?? null,
      url: event.url ?? null,
      location: event.location ?? null,
      publishedAt: event.publishedAt ?? null,
      processed: true,
      notifiedAt: new Date('2024-01-03'),
      metadata: null,
    });

    const updated = await repository.update({ ...event, processed: true, notifiedAt: new Date('2024-01-03') });
    expect(updated.processed).toBe(true);
  });

  it('deletes a CompanyWatchEvent row', async () => {
    (prisma.companyWatchEvent.delete as ReturnType<typeof vi.fn>).mockResolvedValue(event);
    await repository.delete(event.id);
    expect(prisma.companyWatchEvent.delete).toHaveBeenCalledWith({ where: { id: event.id } });
  });

  it('lists events for a CompanyWatch ordered by detectedAt', async () => {
    (prisma.companyWatchEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...event, externalId: null, title: null, description: null, url: null, location: null, publishedAt: null, notifiedAt: null, metadata: null },
    ]);

    const results = await repository.findAllByCompanyWatch('watch-1');
    expect(results).toHaveLength(1);
    expect(prisma.companyWatchEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyWatchId: 'watch-1' }, orderBy: { detectedAt: 'desc' } })
    );
  });
});
