import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Vacancy,
  Source as VacancySourceEntity,
  createVacancyId,
  createVacancySourceId,
  createCompanyId,
  Location,
  Salary,
  Technology,
  ExperienceLevel,
} from '@careeros/career';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

runIf('Vacancy persistence (real Postgres)', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let PrismaVacancyRepository: typeof import('../infrastructure/prisma-vacancy-repository.js').PrismaVacancyRepository;
  let PrismaVacancySourceRepository: typeof import('../infrastructure/prisma-vacancy-source-repository.js').PrismaVacancySourceRepository;
  let workspaceId: string;
  let companyId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../client.js'));
    ({ PrismaVacancyRepository } = await import('../infrastructure/prisma-vacancy-repository.js'));
    ({ PrismaVacancySourceRepository } = await import('../infrastructure/prisma-vacancy-source-repository.js'));

    const workspace = await prisma.workspace.create({ data: { name: `integration-test-${crypto.randomUUID()}` } });
    workspaceId = workspace.id;
    const company = await prisma.company.create({ data: { name: 'Integration Test Co', workspaceId } });
    companyId = company.id;
  });

  afterAll(async () => {
    await prisma.workspace.delete({ where: { id: workspaceId } });
  });

  it('inserts a vacancy with a source, reads it back, and preserves every mapped field', async () => {
    const vacancyRepo = new PrismaVacancyRepository();
    const sourceRepo = new PrismaVacancySourceRepository();

    const vacancy = Vacancy.create({
      id: createVacancyId(crypto.randomUUID()),
      title: 'Senior Platform Engineer',
      description: 'Own our platform end to end.',
      companyId: createCompanyId(companyId),
      location: Location.create({ city: 'Berlin', country: 'Germany', workMode: 'remote' }),
      experienceLevel: ExperienceLevel.SENIOR,
      employmentType: 'full_time',
      salary: Salary.create(95000, 140000, 'USD', 'yearly'),
      technologies: [Technology.create('typescript', 'language'), Technology.create('kubernetes', 'tool')],
      requirements: ['5+ years platform engineering'],
    });

    await vacancyRepo.save(vacancy, { workspaceId });

    const source = VacancySourceEntity.create({
      id: createVacancySourceId(crypto.randomUUID()),
      vacancyId: vacancy.id,
      providerType: 'ATS',
      providerId: 'greenhouse',
      externalId: `integration-${crypto.randomUUID()}`,
      sourceUrl: 'https://boards.greenhouse.io/acme/jobs/integration-test',
      isPrimary: true,
    });

    await sourceRepo.save(source, { workspaceId });

    const found = await vacancyRepo.findById(vacancy.id);

    expect(found).not.toBeNull();
    expect(found?.title).toBe('Senior Platform Engineer');
    expect(found?.location.city).toBe('Berlin');
    expect(found?.location.workMode).toBe('remote');
    expect(found?.experienceLevel).toBe(ExperienceLevel.SENIOR);
    expect(found?.employmentType).toBe('full_time');
    expect(found?.salary?.min).toBe(95000);
    expect(found?.salary?.max).toBe(140000);
    expect(found?.salary?.currency).toBe('USD');
    expect(found?.technologies.map((t) => t.name).sort()).toEqual(['kubernetes', 'typescript']);

    const sources = await sourceRepo.findByVacancyId(vacancy.id);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.sourceUrl).toBe('https://boards.greenhouse.io/acme/jobs/integration-test');
    expect(sources[0]?.providerId).toBe('greenhouse');
    expect(sources[0]?.isPrimary).toBe(true);

    await prisma.vacancy.delete({ where: { id: vacancy.id } });
  });

  it('supports multiple sources for the same vacancy', async () => {
    const vacancyRepo = new PrismaVacancyRepository();
    const sourceRepo = new PrismaVacancySourceRepository();

    const vacancy = Vacancy.create({
      id: createVacancyId(crypto.randomUUID()),
      title: 'Multi-Source Vacancy',
      description: 'A job from multiple providers.',
      companyId: createCompanyId(companyId),
      location: Location.create({ workMode: 'remote' }),
      experienceLevel: ExperienceLevel.MIDDLE,
    });

    await vacancyRepo.save(vacancy, { workspaceId });

    const source1 = VacancySourceEntity.create({
      id: createVacancySourceId(crypto.randomUUID()),
      vacancyId: vacancy.id,
      providerType: 'ATS',
      providerId: 'greenhouse',
      externalId: 'gh-123',
      sourceUrl: 'https://boards.greenhouse.io/acme/jobs/123',
      isPrimary: true,
    });

    const source2 = VacancySourceEntity.create({
      id: createVacancySourceId(crypto.randomUUID()),
      vacancyId: vacancy.id,
      providerType: 'JOB_BOARD',
      providerId: 'hh',
      externalId: 'hh-456',
      sourceUrl: 'https://hh.ru/vacancy/456',
      isPrimary: false,
    });

    await sourceRepo.save(source1, { workspaceId });
    await sourceRepo.save(source2, { workspaceId });

    const sources = await sourceRepo.findByVacancyId(vacancy.id);
    expect(sources).toHaveLength(2);

    const primary = sources.find((s) => s.isPrimary);
    expect(primary?.providerId).toBe('greenhouse');

    const secondary = sources.find((s) => !s.isPrimary);
    expect(secondary?.providerId).toBe('hh');

    await prisma.vacancy.delete({ where: { id: vacancy.id } });
  });

  it('finds vacancy by provider and external id via VacancySource', async () => {
    const vacancyRepo = new PrismaVacancyRepository();
    const sourceRepo = new PrismaVacancySourceRepository();

    const vacancy = Vacancy.create({
      id: createVacancyId(crypto.randomUUID()),
      title: 'Find By Source Vacancy',
      description: 'desc',
      companyId: createCompanyId(companyId),
      location: Location.create({ workMode: 'remote' }),
      experienceLevel: ExperienceLevel.MIDDLE,
    });

    await vacancyRepo.save(vacancy, { workspaceId });

    const source = VacancySourceEntity.create({
      id: createVacancySourceId(crypto.randomUUID()),
      vacancyId: vacancy.id,
      providerType: 'ATS',
      providerId: 'lever',
      externalId: 'lever-789',
      isPrimary: true,
    });

    await sourceRepo.save(source, { workspaceId });

    const found = await sourceRepo.findByProviderAndExternalId('lever', 'lever-789', workspaceId);
    expect(found).not.toBeNull();
    expect(found?.vacancyId).toBe(vacancy.id);

    await prisma.vacancy.delete({ where: { id: vacancy.id } });
  });

  it('scopes findByProviderAndExternalId to the requesting workspace, so a second workspace can import the same external listing independently', async () => {
    const vacancyRepo = new PrismaVacancyRepository();
    const sourceRepo = new PrismaVacancySourceRepository();

    const otherWorkspace = await prisma.workspace.create({
      data: { name: `integration-test-other-${crypto.randomUUID()}` },
    });
    const otherCompany = await prisma.company.create({
      data: { name: 'Other Workspace Co', workspaceId: otherWorkspace.id },
    });

    const sharedExternalId = `shared-${crypto.randomUUID()}`;

    const vacancyA = Vacancy.create({
      id: createVacancyId(crypto.randomUUID()),
      title: 'Shared Listing (Workspace A)',
      description: 'desc',
      companyId: createCompanyId(companyId),
      location: Location.create({ workMode: 'remote' }),
      experienceLevel: ExperienceLevel.MIDDLE,
    });
    await vacancyRepo.save(vacancyA, { workspaceId });
    await sourceRepo.save(
      VacancySourceEntity.create({
        id: createVacancySourceId(crypto.randomUUID()),
        vacancyId: vacancyA.id,
        providerType: 'ATS',
        providerId: 'lever',
        externalId: sharedExternalId,
        isPrimary: true,
      }),
      { workspaceId }
    );

    // Workspace B has never seen this externalId before — it must be able to
    // import its own copy, not be blocked because workspace A already has one.
    const foundInOtherWorkspace = await sourceRepo.findByProviderAndExternalId(
      'lever',
      sharedExternalId,
      otherWorkspace.id
    );
    expect(foundInOtherWorkspace).toBeNull();

    const vacancyB = Vacancy.create({
      id: createVacancyId(crypto.randomUUID()),
      title: 'Shared Listing (Workspace B)',
      description: 'desc',
      companyId: createCompanyId(otherCompany.id),
      location: Location.create({ workMode: 'remote' }),
      experienceLevel: ExperienceLevel.MIDDLE,
    });
    await vacancyRepo.save(vacancyB, { workspaceId: otherWorkspace.id });
    await sourceRepo.save(
      VacancySourceEntity.create({
        id: createVacancySourceId(crypto.randomUUID()),
        vacancyId: vacancyB.id,
        providerType: 'ATS',
        providerId: 'lever',
        externalId: sharedExternalId,
        isPrimary: true,
      }),
      { workspaceId: otherWorkspace.id }
    );

    const foundInWorkspaceA = await sourceRepo.findByProviderAndExternalId('lever', sharedExternalId, workspaceId);
    expect(foundInWorkspaceA?.vacancyId).toBe(vacancyA.id);

    const foundInWorkspaceB = await sourceRepo.findByProviderAndExternalId(
      'lever',
      sharedExternalId,
      otherWorkspace.id
    );
    expect(foundInWorkspaceB?.vacancyId).toBe(vacancyB.id);

    await prisma.vacancy.delete({ where: { id: vacancyA.id } });
    await prisma.vacancy.delete({ where: { id: vacancyB.id } });
    await prisma.company.delete({ where: { id: otherCompany.id } });
    await prisma.workspace.delete({ where: { id: otherWorkspace.id } });
  });
});
