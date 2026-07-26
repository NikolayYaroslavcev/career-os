import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrismaClient, type MockPrismaClient } from '@careeros/test-utils';
import {
  Vacancy,
  createVacancyId,
  createCompanyId,
  Location,
  Salary,
  Technology,
  ExperienceLevel,
} from '@careeros/career';

const mockPrisma = createMockPrismaClient();

vi.mock('../../client.js', () => ({
  get prisma(): MockPrismaClient {
    return mockPrisma;
  },
}));

const { PrismaVacancyRepository } = await import('../prisma-vacancy-repository.js');
const { VacancyMapper } = await import('../../mappers/vacancy-mapper.js');

describe('PrismaVacancyRepository', () => {
  let prisma: MockPrismaClient;
  let repository: InstanceType<typeof PrismaVacancyRepository>;

  const vacancy = Vacancy.create({
    id: createVacancyId('11111111-1111-4111-8111-111111111111'),
    title: 'Senior Platform Engineer',
    description: 'Own the platform.',
    companyId: createCompanyId('22222222-2222-4222-8222-222222222222'),
    location: Location.create({ city: 'Remote', workMode: 'remote' }),
    experienceLevel: ExperienceLevel.SENIOR,
    employmentType: 'full_time',
    salary: Salary.create(4000, 6000, 'USD', 'monthly'),
    technologies: [Technology.create('go', 'language')],
  });

  beforeEach(() => {
    prisma = mockPrisma;
    vi.clearAllMocks();
    repository = new PrismaVacancyRepository();
  });

  it('inserts a vacancy by upserting the mapped persistence shape', async () => {
    (prisma.vacancy.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await repository.save(vacancy, { workspaceId: 'workspace-1' });

    expect(prisma.vacancy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: vacancy.id },
        create: expect.objectContaining({
          location: 'Remote',
          remote: 'REMOTE',
          experienceLevel: 'senior',
          employmentType: 'full_time',
          salaryMin: 4000,
          salaryMax: 6000,
          currency: 'USD',
          workspaceId: 'workspace-1',
        }),
      })
    );
  });

  it('reads a vacancy back with every mapped field preserved', async () => {
    const persisted = VacancyMapper.toPersistence(vacancy, 'workspace-1');
    (prisma.vacancy.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...persisted,
      id: vacancy.id,
      companyId: vacancy.companyId,
      salaryMin: persisted.salaryMin ?? null,
      salaryMax: persisted.salaryMax ?? null,
      publishedAt: persisted.publishedAt ?? null,
    });

    const found = await repository.findById(vacancy.id);

    expect(found).not.toBeNull();
    expect(found?.title).toBe('Senior Platform Engineer');
    expect(found?.location.city).toBe('Remote');
    expect(found?.location.workMode).toBe('remote');
    expect(found?.experienceLevel).toBe(ExperienceLevel.SENIOR);
    expect(found?.employmentType).toBe('full_time');
    expect(found?.salary?.min).toBe(4000);
    expect(found?.salary?.max).toBe(6000);
    expect(found?.salary?.currency).toBe('USD');
    expect(found?.technologies.map((t) => t.name)).toEqual(['go']);
  });

  it('returns null when a vacancy is not found', async () => {
    (prisma.vacancy.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const found = await repository.findById(createVacancyId('missing'));
    expect(found).toBeNull();
  });

  it('finds an existing vacancy by title and company', async () => {
    const persisted = VacancyMapper.toPersistence(vacancy, 'workspace-1');
    (prisma.vacancy.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...persisted,
      id: vacancy.id,
      companyId: vacancy.companyId,
      salaryMin: persisted.salaryMin ?? null,
      salaryMax: persisted.salaryMax ?? null,
      publishedAt: persisted.publishedAt ?? null,
    });

    const found = await repository.findByTitleAndCompany('Senior Platform Engineer', createCompanyId('22222222-2222-4222-8222-222222222222'));

    expect(found?.id).toBe(vacancy.id);
  });

  it('reports existence based on record count', async () => {
    (prisma.vacancy.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    await expect(repository.exists(vacancy.id)).resolves.toBe(true);
  });
});
