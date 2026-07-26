import { describe, it, expect, beforeEach } from 'vitest';
import { Vacancy, createVacancyId, createCompanyId, Location, Salary, ExperienceLevel } from '@careeros/career';
import { InMemoryVacancyRepository } from '../in-memory-repositories.js';

describe('InMemoryVacancyRepository.findMany', () => {
  let repository: InMemoryVacancyRepository;
  const companyId = createCompanyId('11111111-1111-4111-8111-111111111111');

  function buildVacancy(params: {
    id: string;
    title: string;
    description?: string;
    workMode?: 'remote' | 'hybrid' | 'onsite';
    city?: string;
    salary?: [number, number];
    publishedAt?: Date;
  }): Vacancy {
    const now = new Date();
    return Vacancy.reconstitute(createVacancyId(params.id), {
      title: params.title,
      description: params.description ?? 'A great role',
      companyId,
      location: Location.create({ city: params.city, workMode: params.workMode ?? 'remote' }),
      experienceLevel: ExperienceLevel.MIDDLE,
      technologies: [],
      requirements: [],
      responsibilities: [],
      salary: params.salary ? Salary.create(params.salary[0], params.salary[1], 'USD', 'yearly') : undefined,
      isActive: true,
      publishedAt: params.publishedAt ?? now,
      createdAt: now,
      updatedAt: now,
    });
  }

  beforeEach(async () => {
    repository = new InMemoryVacancyRepository();
    await repository.save(
      buildVacancy({ id: 'v-1', title: 'Senior Backend Engineer', workMode: 'remote', salary: [120_000, 160_000], publishedAt: new Date('2026-01-03') }),
      { workspaceId: 'workspace-1' }
    );
    await repository.save(
      buildVacancy({ id: 'v-2', title: 'Frontend Engineer', workMode: 'hybrid', city: 'Berlin', salary: [80_000, 100_000], publishedAt: new Date('2026-01-02') }),
      { workspaceId: 'workspace-1' }
    );
    await repository.save(
      buildVacancy({ id: 'v-3', title: 'Data Analyst', description: 'Work with backend datasets', workMode: 'onsite', city: 'Berlin', publishedAt: new Date('2026-01-01') }),
      { workspaceId: 'workspace-1' }
    );
  });

  const workspaceId = 'workspace-1';

  it('returns all vacancies newest-published-first when no filters are given', async () => {
    const result = await repository.findMany({ workspaceId, limit: 20, offset: 0 });
    expect(result.total).toBe(3);
    expect(result.vacancies.map((v) => v.id)).toEqual(['v-1', 'v-2', 'v-3']);
  });

  it('filters by free-text query against title and description', async () => {
    const result = await repository.findMany({ workspaceId, query: 'backend', limit: 20, offset: 0 });
    expect(result.vacancies.map((v) => v.id).sort()).toEqual(['v-1', 'v-3']);
  });

  it('filters by location', async () => {
    const result = await repository.findMany({ workspaceId, location: 'berlin', limit: 20, offset: 0 });
    expect(result.vacancies.map((v) => v.id).sort()).toEqual(['v-2', 'v-3']);
  });

  it('filters by remote work mode', async () => {
    const result = await repository.findMany({ workspaceId, remote: 'remote', limit: 20, offset: 0 });
    expect(result.vacancies.map((v) => v.id)).toEqual(['v-1']);
  });

  it('filters by salary range overlap', async () => {
    const result = await repository.findMany({ workspaceId, salaryMin: 90_000, limit: 20, offset: 0 });
    expect(result.vacancies.map((v) => v.id).sort()).toEqual(['v-1', 'v-2']);
  });

  it('paginates results while keeping the correct total', async () => {
    const page1 = await repository.findMany({ workspaceId, limit: 2, offset: 0 });
    expect(page1.vacancies.map((v) => v.id)).toEqual(['v-1', 'v-2']);
    expect(page1.total).toBe(3);

    const page2 = await repository.findMany({ workspaceId, limit: 2, offset: 2 });
    expect(page2.vacancies.map((v) => v.id)).toEqual(['v-3']);
    expect(page2.total).toBe(3);
  });

  it('excludes vacancies belonging to a different workspace', async () => {
    const result = await repository.findMany({ workspaceId: 'workspace-2', limit: 20, offset: 0 });
    expect(result.total).toBe(0);
    expect(result.vacancies).toEqual([]);
  });
});
