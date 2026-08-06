import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import {
  Vacancy,
  Source,
  Location,
  ExperienceLevel,
  ProviderType,
  VacancySource,
  createVacancyId,
  createCompanyId,
  createVacancySourceId,
} from '@careeros/career';
import { vacancyRoutes } from '../vacancies/vacancy-routes.js';
import type { Container } from '../../container.js';

function createMockContainer(): Container {
  return {
    repositories: {
      user: {
        findById: vi.fn().mockResolvedValue({
          id: 'user-1',
          workspaceIds: ['ws-1'],
        }),
      },
      vacancy: {
        findMany: vi.fn().mockResolvedValue({ vacancies: [], total: 0 }),
        findById: vi.fn().mockResolvedValue(null),
        findByIdForWorkspace: vi.fn().mockResolvedValue(null),
        getStats: vi.fn().mockResolvedValue({
          totalJobs: 42,
          newToday: 5,
          sources: [{ source: 'greenhouse', count: 20 }, { source: 'remotive', count: 22 }],
          totalSources: 2,
          lastSyncAt: new Date('2024-01-15'),
        }),
      },
      company: { findById: vi.fn().mockResolvedValue(null) },
      vacancySource: {
        findByProviderAndExternalId: vi.fn().mockResolvedValue(null),
        findByVacancyId: vi.fn().mockResolvedValue([]),
      },
      application: {
        findByUserIdAndVacancyId: vi.fn().mockResolvedValue(null),
        findByVacancyId: vi.fn().mockResolvedValue([]),
      },
    },
    providerRegistry: {
      getAll: vi.fn().mockReturnValue([
        { info: { id: 'greenhouse' } },
        { info: { id: 'remotive' } },
        { info: { id: 'hh' } },
      ]),
    },
    services: {},
  } as unknown as Container;
}

describe('Vacancy Routes', () => {
  let app: ReturnType<typeof Fastify>;
  let container: ReturnType<typeof createMockContainer>;

  beforeEach(async () => {
    container = createMockContainer();
    app = Fastify();
    app.decorate('container', container);
    // Simulate auth middleware by adding user to request
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-1', email: 'user-1@example.com' };
    });
    await app.register(vacancyRoutes, { prefix: '/api/v1/vacancies' });
    await app.ready();
  });

  it('GET / returns vacancies list', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/vacancies',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.vacancies).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('GET / hides persisted non-vacancy rows like resume entries from the catalog', async () => {
    const fakeVacancy = Vacancy.create({
      id: createVacancyId('vacancy-1'),
      title: 'Резюме',
      description: 'Frontend developer with React and TypeScript',
      companyId: createCompanyId('company-1'),
      location: Location.create({ workMode: 'remote' }),
      experienceLevel: ExperienceLevel.SENIOR,
    });

    container.repositories.vacancy.findMany = vi.fn().mockResolvedValue({
      vacancies: [fakeVacancy],
      total: 1,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/vacancies',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.vacancies).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('GET / returns vacancies with filters', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/vacancies?query=react&remote=remote&sortBy=newest',
    });

    expect(response.statusCode).toBe(200);
    expect(container.repositories.vacancy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'react',
        remote: 'remote',
        sortBy: 'newest',
      })
    );
  });

  it('GET /stats returns dashboard stats', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/vacancies/stats',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.totalJobs).toBe(42);
    expect(body.newToday).toBe(5);
    expect(body.providers).toHaveLength(2);
  });

  it('POST /search supports all filter parameters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/vacancies/search',
      payload: {
        query: 'python',
        company: 'Google',
        experienceLevel: 'senior',
        employmentType: 'full_time',
        salaryMin: 100000,
        sortBy: 'salary',
        sortOrder: 'desc',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(container.repositories.vacancy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'python',
        company: 'Google',
        experienceLevel: 'senior',
        employmentType: 'full_time',
        salaryMin: 100000,
        sortBy: 'salary',
        sortOrder: 'desc',
      })
    );
  });

  it('GET / scopes findMany to the caller workspace', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/vacancies' });

    expect(container.repositories.vacancy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1' })
    );
  });

  it('POST /search scopes findMany to the caller workspace', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/vacancies/search', payload: {} });

    expect(container.repositories.vacancy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1' })
    );
  });

  it('GET /:id looks up the vacancy scoped to the caller workspace, not by bare id', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/vacancies/some-vacancy-id' });

    expect(container.repositories.vacancy.findByIdForWorkspace).toHaveBeenCalledWith(
      'some-vacancy-id',
      'ws-1'
    );
    expect(container.repositories.vacancy.findById).not.toHaveBeenCalled();
    // findByIdForWorkspace resolves null (vacancy belongs to another workspace, or doesn't exist) -> 404, never leaks existence
    expect(response.statusCode).toBe(404);
  });

  it('POST /by-url looks up the caller-scoped application, never another user\'s', async () => {
    container.repositories.vacancy.findByIdForWorkspace = vi.fn().mockResolvedValue({
      id: 'vacancy-1',
      companyId: 'company-1',
    });
    container.repositories.vacancySource.findByProviderAndExternalId = vi
      .fn()
      .mockResolvedValue({ vacancyId: 'vacancy-1' });
    container.repositories.application.findByVacancyId = vi
      .fn()
      .mockResolvedValue([{ id: 'someone-elses-application', userId: 'other-user' }]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/vacancies/by-url',
      payload: { url: 'https://example.com/job/1' },
    });

    expect(response.statusCode).toBe(200);
    expect(container.repositories.application.findByUserIdAndVacancyId).toHaveBeenCalledWith('user-1', 'vacancy-1');
    expect(container.repositories.application.findByVacancyId).not.toHaveBeenCalled();
    const body = JSON.parse(response.payload);
    expect(body.applicationId).toBeNull();
  });

  it('POST /search forwards the source filter to findMany (contract: FE VacancyListParams.source must reach the repository)', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/vacancies/search',
      payload: { source: 'linkedin' },
    });

    expect(container.repositories.vacancy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'linkedin' })
    );
  });

  it('GET / forwards the source query param to findMany', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/vacancies?source=hh' });

    expect(container.repositories.vacancy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'hh' })
    );
  });

  it('GET /:id returns a `source` (primary provider id) and `sources` array, matching the dashboard VacancyDetail contract', async () => {
    const vacancy = Vacancy.create({
      id: createVacancyId('vacancy-1'),
      title: 'Senior Engineer',
      description: 'A great role',
      companyId: createCompanyId('company-1'),
      location: Location.create({ workMode: 'remote' }),
      experienceLevel: ExperienceLevel.SENIOR,
    });

    const source = Source.create({
      id: createVacancySourceId('source-1'),
      vacancyId: vacancy.id,
      providerType: ProviderType.JOB_BOARD,
      providerId: VacancySource.LINKEDIN,
      externalId: 'ext-1',
      sourceUrl: 'https://linkedin.com/jobs/1',
      isPrimary: true,
    });

    container.repositories.vacancy.findByIdForWorkspace = vi.fn().mockResolvedValue(vacancy);
    container.repositories.vacancySource.findByVacancyId = vi.fn().mockResolvedValue([source]);

    const response = await app.inject({ method: 'GET', url: '/api/v1/vacancies/vacancy-1' });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    // This is exactly the bug class the audit was hunting for: the backend must never
    // send only `sources` (array) while the frontend reads a singular `source` string.
    expect(body.source).toBe('linkedin');
    expect(body.sources).toEqual([
      expect.objectContaining({ id: 'source-1', providerId: 'linkedin', isPrimary: true }),
    ]);
  });

  it('GET /:id returns 404 for persisted non-vacancy rows like resume entries', async () => {
    const fakeVacancy = Vacancy.create({
      id: createVacancyId('vacancy-resume'),
      title: 'Резюме',
      description: 'Frontend developer with React and TypeScript',
      companyId: createCompanyId('company-1'),
      location: Location.create({ workMode: 'remote' }),
      experienceLevel: ExperienceLevel.SENIOR,
    });

    container.repositories.vacancy.findByIdForWorkspace = vi.fn().mockResolvedValue(fakeVacancy);

    const response = await app.inject({ method: 'GET', url: '/api/v1/vacancies/vacancy-resume' });

    expect(response.statusCode).toBe(404);
  });
});
