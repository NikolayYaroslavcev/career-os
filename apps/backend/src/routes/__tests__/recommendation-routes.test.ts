import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import {
  Vacancy,
  SearchProfile,
  ExperienceLevel,
  Location,
  Technology,
  createVacancyId,
  createCompanyId,
  createSearchProfileId,
  createUserId,
} from '@careeros/career';
import { recommendationRoutes } from '../recommendations/recommendation-routes.js';
import { errorHandler } from '../../middleware/error-handler.js';

function createVacancy(id: string, title: string): Vacancy {
  return Vacancy.create({
    id: createVacancyId(id),
    title,
    description: 'A great job',
    companyId: createCompanyId('company-1'),
    location: Location.create({ city: 'Remote', country: 'Remote', workMode: 'remote', isRelocationPossible: false }),
    experienceLevel: ExperienceLevel.SENIOR,
    technologies: [Technology.create('TypeScript', 'language')],
    requirements: [],
  });
}

function createSearchProfile(): SearchProfile {
  return SearchProfile.create({
    id: createSearchProfileId('profile-1'),
    userId: createUserId('user-1'),
    name: 'Frontend',
    desiredPositions: ['Frontend Developer'],
    desiredTechnologies: [Technology.create('TypeScript', 'language')],
    experienceLevel: ExperienceLevel.SENIOR,
    isRemoteOnly: true,
  });
}

function createMockContainer(interactions: Array<{ action: string; vacancyId: string }>): {
  repositories: Record<string, unknown>;
} {
  const visibleVacancy = createVacancy('v-visible', 'Visible Job');
  const hiddenVacancy = createVacancy('v-hidden', 'Senior Frontend Developer - Brankas');

  return {
    repositories: {
      user: {
        findById: vi.fn().mockResolvedValue({ id: 'user-1', workspaceIds: ['ws-1'] }),
      },
      searchProfile: {
        findByUserId: vi.fn().mockResolvedValue([createSearchProfile()]),
      },
      vacancy: {
        findMany: vi.fn().mockResolvedValue({ vacancies: [visibleVacancy, hiddenVacancy], total: 2 }),
        findByIdForWorkspace: vi.fn().mockResolvedValue(null),
      },
      providerConfig: {
        findAll: vi.fn().mockResolvedValue([]),
      },
      vacancySource: {
        findByVacancyId: vi.fn().mockResolvedValue([]),
      },
      company: {
        findById: vi.fn().mockResolvedValue({ name: 'Brankas' }),
      },
      userVacancyInteraction: {
        findByUserId: vi.fn().mockResolvedValue(interactions),
      },
    },
  };
}

describe('Recommendation Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    app.setErrorHandler(errorHandler);
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-1', email: 'user-1@example.com' };
    });
  });

  it('excludes vacancies the user has explicitly hidden', async () => {
    const container = createMockContainer([{ action: 'HIDE', vacancyId: 'v-hidden' }]);
    app.decorate('container', container);
    await app.register(recommendationRoutes);

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const titles = body.recommendations.map((r: { vacancy: { title: string } }) => r.vacancy.title);
    expect(titles).toContain('Visible Job');
    expect(titles).not.toContain('Senior Frontend Developer - Brankas');
    expect(body.total).toBe(1);
  });

  it('includes all vacancies when none are hidden', async () => {
    const container = createMockContainer([]);
    app.decorate('container', container);
    await app.register(recommendationRoutes);

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(2);
  });
});
