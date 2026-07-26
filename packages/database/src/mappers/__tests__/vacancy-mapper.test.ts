import { describe, it, expect } from 'vitest';
import {
  Vacancy,
  createVacancyId,
  createCompanyId,
  Location,
  Salary,
  Technology,
  ExperienceLevel,
} from '@careeros/career';
import { VacancyMapper } from '../vacancy-mapper.js';

describe('VacancyMapper', () => {
  function buildVacancy(): Vacancy {
    return Vacancy.create({
      id: createVacancyId('11111111-1111-4111-8111-111111111111'),
      title: 'Senior Backend Engineer',
      description: 'Build scalable backend systems.',
      companyId: createCompanyId('22222222-2222-4222-8222-222222222222'),
      location: Location.create({ city: 'Berlin', country: 'Germany', workMode: 'remote' }),
      experienceLevel: ExperienceLevel.SENIOR,
      employmentType: 'full_time',
      salary: Salary.create(90000, 130000, 'USD', 'yearly'),
      technologies: [Technology.create('typescript', 'language'), Technology.create('postgresql', 'database')],
      requirements: ['5+ years backend experience'],
    });
  }

  it('round-trips every mapped field through toPersistence -> toDomain', () => {
    const vacancy = buildVacancy();

    const persisted = VacancyMapper.toPersistence(vacancy, 'workspace-1');

    expect(persisted.location).toBe('Berlin');
    expect(persisted.remote).toBe('REMOTE');
    expect(persisted.experienceLevel).toBe('senior');
    expect(persisted.employmentType).toBe('full_time');
    expect(persisted.salaryMin).toBe(90000);
    expect(persisted.salaryMax).toBe(130000);
    expect(persisted.currency).toBe('USD');
    expect(persisted.workspaceId).toBe('workspace-1');
    expect(persisted.technologies).toEqual(['typescript', 'postgresql']);
    expect(persisted.metadata).toEqual({ technologies: ['typescript', 'postgresql'] });

    const record = {
      ...persisted,
      id: vacancy.id,
      location: persisted.location ?? null,
      salaryMin: persisted.salaryMin ?? null,
      salaryMax: persisted.salaryMax ?? null,
      publishedAt: persisted.publishedAt ?? null,
      companyId: vacancy.companyId,
    };

    const roundTripped = VacancyMapper.toDomain(record);

    expect(roundTripped.location.city).toBe('Berlin');
    expect(roundTripped.location.workMode).toBe('remote');
    expect(roundTripped.experienceLevel).toBe(ExperienceLevel.SENIOR);
    expect(roundTripped.employmentType).toBe('full_time');
    expect(roundTripped.salary?.min).toBe(90000);
    expect(roundTripped.salary?.max).toBe(130000);
    expect(roundTripped.salary?.currency).toBe('USD');
    expect(roundTripped.technologies.map((t) => t.name)).toEqual(['typescript', 'postgresql']);
  });

  it('falls back to an undefined salary when neither salaryMin nor salaryMax is set', () => {
    const vacancy = Vacancy.create({
      id: createVacancyId('33333333-3333-4333-8333-333333333333'),
      title: 'Support Engineer',
      description: 'Help customers.',
      companyId: createCompanyId('44444444-4444-4444-8444-444444444444'),
      location: Location.create({ workMode: 'onsite' }),
      experienceLevel: ExperienceLevel.JUNIOR,
    });

    const persisted = VacancyMapper.toPersistence(vacancy, 'workspace-1');
    expect(persisted.salaryMin).toBeUndefined();
    expect(persisted.salaryMax).toBeUndefined();

    const roundTripped = VacancyMapper.toDomain({
      ...persisted,
      id: vacancy.id,
      location: persisted.location ?? null,
      salaryMin: null,
      salaryMax: null,
      publishedAt: null,
      companyId: vacancy.companyId,
    });

    expect(roundTripped.salary).toBeUndefined();
    expect(roundTripped.employmentType).toBeUndefined();
  });

  it('defaults an unknown persisted experienceLevel to MIDDLE', () => {
    const record = {
      id: '66666666-6666-4666-8666-666666666666',
      title: 'Legacy Vacancy',
      description: 'desc',
      requirements: [],
      technologies: [],
      experienceLevel: 'not-a-real-level',
      employmentType: null,
      salaryMin: null,
      salaryMax: null,
      currency: 'USD',
      location: null,
      remote: 'onsite',
      publishedAt: null,
      fetchedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      companyId: 'company-1',
      metadata: null,
    };

    const domain = VacancyMapper.toDomain(record);
    expect(domain.experienceLevel).toBe(ExperienceLevel.MIDDLE);
  });

  it('reads technologies from the technologies column', () => {
    const record = {
      id: '77777777-7777-4777-8777-777777777777',
      title: 'Frontend Dev',
      description: 'Build UIs',
      requirements: [],
      technologies: ['react', 'typescript', 'css'],
      experienceLevel: 'middle',
      employmentType: null,
      salaryMin: null,
      salaryMax: null,
      currency: 'USD',
      location: null,
      remote: 'remote',
      publishedAt: null,
      fetchedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      companyId: 'company-1',
      metadata: null,
    };

    const domain = VacancyMapper.toDomain(record);
    expect(domain.technologies.map((t) => t.name)).toEqual(['react', 'typescript', 'css']);
  });

  it('falls back to metadata.technologies when technologies column is empty', () => {
    const record = {
      id: '88888888-8888-4888-8888-888888888888',
      title: 'Old Vacancy',
      description: 'Legacy',
      requirements: [],
      technologies: [],
      experienceLevel: 'senior',
      employmentType: null,
      salaryMin: null,
      salaryMax: null,
      currency: 'USD',
      location: null,
      remote: 'hybrid',
      publishedAt: null,
      fetchedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      companyId: 'company-1',
      metadata: { technologies: ['python', 'django'] },
    };

    const domain = VacancyMapper.toDomain(record);
    expect(domain.technologies.map((t) => t.name)).toEqual(['python', 'django']);
  });

  it('handles empty technologies correctly', () => {
    const record = {
      id: '99999999-9999-4999-8999-999999999999',
      title: 'Empty Tech',
      description: 'No tech',
      requirements: [],
      technologies: [],
      experienceLevel: 'junior',
      employmentType: null,
      salaryMin: null,
      salaryMax: null,
      currency: 'USD',
      location: null,
      remote: 'onsite',
      publishedAt: null,
      fetchedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      companyId: 'company-1',
      metadata: null,
    };

    const domain = VacancyMapper.toDomain(record);
    expect(domain.technologies).toEqual([]);
  });

  it('persists technologies to both column and metadata', () => {
    const vacancy = Vacancy.create({
      id: createVacancyId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      title: 'DevOps Engineer',
      description: 'Manage infrastructure',
      companyId: createCompanyId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      location: Location.create({ workMode: 'remote' }),
      experienceLevel: ExperienceLevel.MIDDLE,
      technologies: [
        Technology.create('docker', 'tool'),
        Technology.create('kubernetes', 'tool'),
        Technology.create('terraform', 'tool'),
      ],
    });

    const persisted = VacancyMapper.toPersistence(vacancy, 'ws-1');

    expect(persisted.technologies).toEqual(['docker', 'kubernetes', 'terraform']);
    expect(persisted.metadata).toEqual({ technologies: ['docker', 'kubernetes', 'terraform'] });
  });
});
