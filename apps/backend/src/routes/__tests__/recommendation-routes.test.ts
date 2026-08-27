import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import {
  Vacancy,
  SearchProfile,
  ExperienceLevel,
  Location,
  Technology,
  UserRole,
  Source,
  createVacancyId,
  createVacancySourceId,
  createCompanyId,
  createSearchProfileId,
  createUserId,
} from '@careeros/career';
import { recommendationRoutes } from '../recommendations/recommendation-routes.js';
import { errorHandler } from '../../middleware/error-handler.js';

function createVacancy(id: string, title: string, companyId = 'company-1'): Vacancy {
  return Vacancy.create({
    id: createVacancyId(id),
    title,
    description: 'A great job',
    companyId: createCompanyId(companyId),
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
      request.user = { id: 'user-1', email: 'user-1@example.com', role: UserRole.JOB_SEEKER };
    });
  });

  it('sortBy=newest surfaces a freshly-ingested vacancy even when it scores below the pagination cutoff', async () => {
    // Regression coverage: the route used to slice the score-ordered pool
    // down to `limit` items *before* applying the newest/salary sort, so a
    // brand-new vacancy that scores below the cutoff (e.g. mismatched
    // against the active profile) could never surface via "newest" no
    // matter how recent it was. Two well-matched vacancies outscore a
    // poorly-matched one; with limit=2 the mismatched vacancy must still
    // appear first once genuinely sorted by publishedAt across the whole
    // pool, not just re-sorted within whichever page score-order picked.
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const strongMatchOld = Vacancy.reconstitute(createVacancyId('v-old-match'), {
      title: 'Senior Frontend Developer',
      description: 'A great frontend role',
      companyId: createCompanyId('company-1'),
      location: Location.create({ city: 'Remote', country: 'Remote', workMode: 'remote', isRelocationPossible: false }),
      experienceLevel: ExperienceLevel.SENIOR,
      technologies: [Technology.create('TypeScript', 'language')],
      requirements: [],
      responsibilities: [],
      isActive: true,
      publishedAt: new Date(now - 10 * day),
      createdAt: new Date(now - 10 * day),
      updatedAt: new Date(now - 10 * day),
    });
    const strongMatchNewer = Vacancy.reconstitute(createVacancyId('v-newer-match'), {
      title: 'Senior Frontend Developer',
      description: 'Another great frontend role',
      companyId: createCompanyId('company-1'),
      location: Location.create({ city: 'Remote', country: 'Remote', workMode: 'remote', isRelocationPossible: false }),
      experienceLevel: ExperienceLevel.SENIOR,
      technologies: [Technology.create('TypeScript', 'language')],
      requirements: [],
      responsibilities: [],
      isActive: true,
      publishedAt: new Date(now - 5 * day),
      createdAt: new Date(now - 5 * day),
      updatedAt: new Date(now - 5 * day),
    });
    const mismatchedFresh = Vacancy.reconstitute(createVacancyId('v-fresh-mismatch'), {
      title: 'Warehouse Coordinator',
      // Title has no role match at all, but keeps one matched technology so
      // it still clears the relevance floor (role-OR-tech relevance) — the
      // point of this fixture is a vacancy that scores low but is not
      // *entirely* irrelevant, since fully irrelevant vacancies are now
      // filtered before pagination rather than surfaced via "newest" sort.
      description: 'Minimal overlap with the active profile',
      companyId: createCompanyId('company-1'),
      location: Location.create({ city: 'Remote', country: 'Remote', workMode: 'remote', isRelocationPossible: false }),
      experienceLevel: ExperienceLevel.JUNIOR,
      technologies: [Technology.create('TypeScript', 'language')],
      requirements: [],
      responsibilities: [],
      isActive: true,
      publishedAt: new Date(now),
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });

    const container = {
      repositories: {
        user: {
          findById: vi.fn().mockResolvedValue({ id: 'user-1', workspaceIds: ['ws-1'] }),
        },
        searchProfile: {
          findByUserId: vi.fn().mockResolvedValue([createSearchProfile()]),
        },
        vacancy: {
          findMany: vi.fn().mockResolvedValue({
            vacancies: [strongMatchOld, strongMatchNewer, mismatchedFresh],
            total: 3,
          }),
          findByIdForWorkspace: vi.fn().mockResolvedValue(null),
        },
        providerConfig: {
          findAll: vi.fn().mockResolvedValue([]),
        },
        vacancySource: {
          findByVacancyId: vi.fn().mockResolvedValue([]),
        },
        company: {
          findById: vi.fn().mockResolvedValue({ name: 'Acme' }),
        },
        userVacancyInteraction: {
          findByUserId: vi.fn().mockResolvedValue([]),
        },
      },
    };
    app.decorate('container', container);
    await app.register(recommendationRoutes);

    const response = await app.inject({ method: 'GET', url: '/?sortBy=newest&limit=2' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const titles = body.recommendations.map((r: { vacancy: { title: string } }) => r.vacancy.title);
    expect(body.total).toBe(3);
    expect(titles).toEqual(['Warehouse Coordinator', 'Senior Frontend Developer']);
  });

  it('fetches a 500-vacancy candidate pool, not 200, so a high-volume provider cannot starve out lower-volume ones', async () => {
    // Regression coverage for the candidate-pool-size fix: diagnostics against
    // the real seeker@careeros.test workspace showed jobicy alone occupying
    // ~65% of a newest-200 window, pushing habr_career/justjoin_it/telegram
    // vacancies past the cutoff before ranking ever saw them. This pins the
    // fetched window size itself, since none of the other tests here would
    // catch a silent revert back to 200 — they all pass a small fixed vacancy
    // list through the mock regardless of what limit was requested.
    const container = createMockContainer([]);
    app.decorate('container', container);
    await app.register(recommendationRoutes);

    await app.inject({ method: 'GET', url: '/' });

    const vacancyRepo = container.repositories.vacancy as { findMany: ReturnType<typeof vi.fn> };
    expect(vacancyRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 500, offset: 0, sortBy: 'newest', sortOrder: 'desc' }),
    );
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

  it('excludes vacancies from companies on the exclusion list (e.g. Lemon.io)', async () => {
    // Regression coverage for the reported Lemon.io leak: the company-name
    // exclusion mechanism (built for Proxify) filters recommendations by
    // resolving each vacancy's company via `company.findById`, so this test
    // mocks that lookup per-companyId rather than reusing createMockContainer's
    // single fixed company mock.
    const legitVacancy = createVacancy('v-legit', 'Senior React Developer', 'company-1');
    const lemonVacancy = createVacancy('v-lemon', 'Senior React Full-stack Developer', 'company-lemon');

    const container = {
      repositories: {
        user: {
          findById: vi.fn().mockResolvedValue({ id: 'user-1', workspaceIds: ['ws-1'] }),
        },
        searchProfile: {
          findByUserId: vi.fn().mockResolvedValue([createSearchProfile()]),
        },
        vacancy: {
          findMany: vi.fn().mockResolvedValue({ vacancies: [legitVacancy, lemonVacancy], total: 2 }),
          findByIdForWorkspace: vi.fn().mockResolvedValue(null),
        },
        providerConfig: {
          findAll: vi.fn().mockResolvedValue([]),
        },
        vacancySource: {
          findByVacancyId: vi.fn().mockResolvedValue([]),
        },
        company: {
          findById: vi.fn().mockImplementation((companyId: { toString(): string }) =>
            Promise.resolve(companyId.toString() === 'company-1' ? { name: 'Real Employer' } : { name: 'Lemon.io' }),
          ),
        },
        userVacancyInteraction: {
          findByUserId: vi.fn().mockResolvedValue([]),
        },
      },
    };
    app.decorate('container', container);
    await app.register(recommendationRoutes);

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const titles = body.recommendations.map((r: { vacancy: { title: string } }) => r.vacancy.title);
    expect(titles).toContain('Senior React Developer');
    expect(titles).not.toContain('Senior React Full-stack Developer');
    expect(body.total).toBe(1);
  });

  it('excludes vacancies the user has already applied to instead of boosting them', async () => {
    const container = createMockContainer([{ action: 'APPLY', vacancyId: 'v-hidden' }]);
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

  describe('Provider quality score lookup', () => {
    // Regression coverage for the providerId/providerType key-mismatch bug:
    // ProviderConfig.qualityScore is keyed by providerId ('telegram', 'hh', ...),
    // but the route used to build its vacancy->key map from providerType
    // ('COMMUNITY', 'JOB_BOARD', ...), so every configured qualityScore was
    // silently missed and a computed fallback was used instead. These
    // vacancies are identical in every ranking input except their source, so
    // any score/qualityScore difference below can only come from the
    // provider-quality lookup actually resolving each vacancy's real providerId.
    function createSourcedVacancy(id: string, providerId: string, providerType: 'COMMUNITY' | 'JOB_BOARD' | 'ATS'): {
      vacancy: Vacancy;
      source: Source;
    } {
      const vacancy = Vacancy.create({
        id: createVacancyId(id),
        title: 'Frontend Developer',
        description: 'A great frontend role',
        companyId: createCompanyId('company-1'),
        location: Location.create({ city: 'Remote', country: 'Remote', workMode: 'remote', isRelocationPossible: false }),
        experienceLevel: ExperienceLevel.SENIOR,
        technologies: [Technology.create('TypeScript', 'language')],
        requirements: [],
      });
      const source = Source.create({
        id: createVacancySourceId(`${id}-source`),
        vacancyId: vacancy.id,
        providerType,
        providerId: providerId as never,
        externalId: `${id}-ext`,
        isPrimary: true,
      });
      return { vacancy, source };
    }

    function createProviderQualityContainer(
      vacancies: Vacancy[],
      sourcesByVacancyId: Record<string, Source[]>,
      providerConfigs: Array<{ providerId: string; qualityScore: number }>,
    ): { repositories: Record<string, unknown> } {
      return {
        repositories: {
          user: {
            findById: vi.fn().mockResolvedValue({ id: 'user-1', workspaceIds: ['ws-1'] }),
          },
          searchProfile: {
            findByUserId: vi.fn().mockResolvedValue([createSearchProfile()]),
          },
          vacancy: {
            findMany: vi.fn().mockResolvedValue({ vacancies, total: vacancies.length }),
            findByIdForWorkspace: vi.fn().mockResolvedValue(null),
          },
          providerConfig: {
            findAll: vi.fn().mockResolvedValue(providerConfigs),
          },
          vacancySource: {
            findByVacancyId: vi.fn(async (vacancyId: { toString(): string }) => sourcesByVacancyId[vacancyId.toString()] ?? []),
          },
          company: {
            findById: vi.fn().mockResolvedValue({ name: 'Acme' }),
          },
          userVacancyInteraction: {
            findByUserId: vi.fn().mockResolvedValue([]),
          },
        },
      };
    }

    it('applies a configured qualityScore keyed by providerId=telegram, not providerType=COMMUNITY', async () => {
      const { vacancy: telegramVacancy, source: telegramSource } = createSourcedVacancy('v-telegram', 'telegram', 'COMMUNITY');
      const { vacancy: hhVacancy, source: hhSource } = createSourcedVacancy('v-hh', 'hh', 'JOB_BOARD');

      const container = createProviderQualityContainer(
        [telegramVacancy, hhVacancy],
        { 'v-telegram': [telegramSource], 'v-hh': [hhSource] },
        [
          { providerId: 'telegram', qualityScore: 70 },
          { providerId: 'hh', qualityScore: 20 },
        ],
      );
      app.decorate('container', container);
      await app.register(recommendationRoutes);

      const response = await app.inject({ method: 'GET', url: '/' });
      expect(response.statusCode).toBe(200);
      const body = response.json();

      const byId = (id: string) =>
        body.recommendations.find((r: { vacancy: { id: string } }) => r.vacancy.id === id);
      const telegramRec = byId('v-telegram');
      const hhRec = byId('v-hh');

      expect(telegramRec).toBeDefined();
      expect(hhRec).toBeDefined();
      // Only the configured providerId quality score (70 vs 20) differs between
      // these two otherwise-identical vacancies, so telegram must score higher
      // on both the displayed qualityScore and the overall ranking score.
      expect(telegramRec.qualityScore).toBeGreaterThan(hhRec.qualityScore);
      expect(telegramRec.score).toBeGreaterThan(hhRec.score);
    });

    it('continues to apply configured qualityScore for other providerIds (hh, greenhouse)', async () => {
      const { vacancy: greenhouseVacancy, source: greenhouseSource } = createSourcedVacancy('v-greenhouse', 'greenhouse', 'ATS');
      const { vacancy: hhVacancy, source: hhSource } = createSourcedVacancy('v-hh2', 'hh', 'JOB_BOARD');

      const container = createProviderQualityContainer(
        [greenhouseVacancy, hhVacancy],
        { 'v-greenhouse': [greenhouseSource], 'v-hh2': [hhSource] },
        [
          { providerId: 'greenhouse', qualityScore: 90 },
          { providerId: 'hh', qualityScore: 20 },
        ],
      );
      app.decorate('container', container);
      await app.register(recommendationRoutes);

      const response = await app.inject({ method: 'GET', url: '/' });
      expect(response.statusCode).toBe(200);
      const body = response.json();

      const byId = (id: string) =>
        body.recommendations.find((r: { vacancy: { id: string } }) => r.vacancy.id === id);
      const greenhouseRec = byId('v-greenhouse');
      const hhRec = byId('v-hh2');

      expect(greenhouseRec.qualityScore).toBeGreaterThan(hhRec.qualityScore);
    });
  });

  describe('Relevance floor', () => {
    // Regression coverage: the candidate pool (up to 200 newest workspace-wide
    // vacancies) can be dominated by a noisy provider, so without a relevance
    // floor the endpoint backfilled whatever was left just to fill `limit`,
    // surfacing vacancies with no connection to the active profile at all.
    // These tests pin the floor to role/technology relevance signals rather
    // than the total-score tier, so it can't be satisfied by accident via a
    // scoring-weight tweak elsewhere.
    const frontendTechProfile = SearchProfile.create({
      id: createSearchProfileId('profile-tech'),
      userId: createUserId('user-1'),
      name: 'Frontend',
      desiredPositions: ['Frontend Developer'],
      desiredTechnologies: [Technology.create('TypeScript', 'language'), Technology.create('React', 'framework')],
      experienceLevel: ExperienceLevel.SENIOR,
      isRemoteOnly: true,
    });

    function relevantVacancy(id: string, publishedAt = new Date()): Vacancy {
      return Vacancy.reconstitute(createVacancyId(id), {
        title: `Senior Frontend Developer ${id}`,
        description: 'A great frontend role',
        companyId: createCompanyId('company-1'),
        location: Location.create({ city: 'Remote', country: 'Remote', workMode: 'remote', isRelocationPossible: false }),
        experienceLevel: ExperienceLevel.SENIOR,
        technologies: [Technology.create('TypeScript', 'language'), Technology.create('React', 'framework')],
        requirements: [],
        responsibilities: [],
        isActive: true,
        publishedAt,
        createdAt: publishedAt,
        updatedAt: publishedAt,
      });
    }

    // No role match (title matches no known category) and no technology
    // overlap at all — the plainest case the floor exists to catch.
    function noSignalVacancy(id: string): Vacancy {
      return Vacancy.reconstitute(createVacancyId(id), {
        title: `Warehouse Associate ${id}`,
        description: 'Physical inventory work, no tech involved',
        companyId: createCompanyId('company-1'),
        location: Location.create({ city: 'Nowhere', country: 'Nowhere', workMode: 'onsite', isRelocationPossible: false }),
        experienceLevel: ExperienceLevel.JUNIOR,
        technologies: [],
        requirements: [],
        responsibilities: [],
        isActive: true,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Same "no role, no technology" gap as noSignalVacancy, but every other
    // scoring input is maxed out (exact experience match, desired remote
    // mode, no salary preference to fail against). Proves the floor is a
    // role/technology signal check, not just a low-total-score cutoff — a
    // vacancy can't buy its way past the floor with unrelated factors.
    function highSecondaryScoreNoSignalVacancy(id: string): Vacancy {
      return Vacancy.reconstitute(createVacancyId(id), {
        title: `Chief of Staff to the COO ${id}`,
        description: 'Executive operations role with no engineering scope',
        companyId: createCompanyId('company-1'),
        location: Location.create({ city: 'Remote', country: 'Remote', workMode: 'remote', isRelocationPossible: false }),
        experienceLevel: ExperienceLevel.SENIOR,
        technologies: [],
        requirements: [],
        responsibilities: [],
        isActive: true,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    function createContainerWithVacancies(
      vacancies: Vacancy[],
      searchProfile: SearchProfile = frontendTechProfile,
    ): { repositories: Record<string, unknown> } {
      return {
        repositories: {
          user: {
            findById: vi.fn().mockResolvedValue({ id: 'user-1', workspaceIds: ['ws-1'] }),
          },
          searchProfile: {
            findByUserId: vi.fn().mockResolvedValue([searchProfile]),
          },
          vacancy: {
            findMany: vi.fn().mockResolvedValue({ vacancies, total: vacancies.length }),
            findByIdForWorkspace: vi.fn().mockResolvedValue(null),
          },
          providerConfig: {
            findAll: vi.fn().mockResolvedValue([]),
          },
          vacancySource: {
            findByVacancyId: vi.fn().mockResolvedValue([]),
          },
          company: {
            findById: vi.fn().mockResolvedValue({ name: 'Acme' }),
          },
          userVacancyInteraction: {
            findByUserId: vi.fn().mockResolvedValue([]),
          },
        },
      };
    }

    it('returns all candidates when every candidate is relevant', async () => {
      const vacancies = Array.from({ length: 20 }, (_, i) => relevantVacancy(`v-rel-${i}`));
      const container = createContainerWithVacancies(vacancies);
      app.decorate('container', container);
      await app.register(recommendationRoutes);

      const response = await app.inject({ method: 'GET', url: '/?limit=20' });
      const body = response.json();

      expect(body.recommendations).toHaveLength(20);
      expect(body.total).toBe(20);
    });

    it('returns fewer than limit rather than backfilling with REJECT-tier vacancies', async () => {
      const relevant = Array.from({ length: 7 }, (_, i) => relevantVacancy(`v-rel-${i}`));
      const irrelevant = Array.from({ length: 13 }, (_, i) => noSignalVacancy(`v-none-${i}`));
      const container = createContainerWithVacancies([...relevant, ...irrelevant]);
      app.decorate('container', container);
      await app.register(recommendationRoutes);

      const response = await app.inject({ method: 'GET', url: '/?limit=20' });
      const body = response.json();

      expect(body.recommendations).toHaveLength(7);
      expect(body.total).toBe(7);
      const ids = body.recommendations.map((r: { vacancy: { id: string } }) => r.vacancy.id);
      expect(ids.every((id: string) => id.startsWith('v-rel-'))).toBe(true);
    });

    it('does not use high-secondary-score, role/tech-irrelevant vacancies as padding', async () => {
      const relevant = Array.from({ length: 7 }, (_, i) => relevantVacancy(`v-rel-${i}`));
      const padding = Array.from({ length: 13 }, (_, i) => highSecondaryScoreNoSignalVacancy(`v-pad-${i}`));
      const container = createContainerWithVacancies([...relevant, ...padding]);
      app.decorate('container', container);
      await app.register(recommendationRoutes);

      const response = await app.inject({ method: 'GET', url: '/?limit=20' });
      const body = response.json();

      expect(body.recommendations).toHaveLength(7);
      expect(body.total).toBe(7);
      const titles = body.recommendations.map((r: { vacancy: { title: string } }) => r.vacancy.title);
      expect(titles.some((t: string) => t.includes('Chief of Staff'))).toBe(false);
    });

    it('keeps a Product Engineer vacancy with strong technology overlap despite an unrecognized role', async () => {
      const productEngineer = Vacancy.reconstitute(createVacancyId('v-product-eng'), {
        title: 'Product Engineer',
        description: 'Own the full product surface end to end',
        companyId: createCompanyId('company-1'),
        location: Location.create({ city: 'Remote', country: 'Remote', workMode: 'remote', isRelocationPossible: false }),
        experienceLevel: ExperienceLevel.SENIOR,
        technologies: [Technology.create('TypeScript', 'language'), Technology.create('React', 'framework')],
        requirements: [],
        responsibilities: [],
        isActive: true,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const container = createContainerWithVacancies([productEngineer]);
      app.decorate('container', container);
      await app.register(recommendationRoutes);

      const response = await app.inject({ method: 'GET', url: '/' });
      const body = response.json();

      expect(body.total).toBe(1);
      expect(body.recommendations[0].vacancy.title).toBe('Product Engineer');
    });

    it('keeps a Founding Engineer vacancy with strong technology overlap despite an unrecognized role', async () => {
      const foundingEngineer = Vacancy.reconstitute(createVacancyId('v-founding-eng'), {
        title: 'Founding Engineer',
        description: 'Early hire building the core product',
        companyId: createCompanyId('company-1'),
        location: Location.create({ city: 'Remote', country: 'Remote', workMode: 'remote', isRelocationPossible: false }),
        experienceLevel: ExperienceLevel.SENIOR,
        technologies: [Technology.create('TypeScript', 'language'), Technology.create('React', 'framework')],
        requirements: [],
        responsibilities: [],
        isActive: true,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const container = createContainerWithVacancies([foundingEngineer]);
      app.decorate('container', container);
      await app.register(recommendationRoutes);

      const response = await app.inject({ method: 'GET', url: '/' });
      const body = response.json();

      expect(body.total).toBe(1);
      expect(body.recommendations[0].vacancy.title).toBe('Founding Engineer');
    });

    it('excludes a vacancy with neither role nor technology relevance', async () => {
      const container = createContainerWithVacancies([relevantVacancy('v-rel-0'), noSignalVacancy('v-none-0')]);
      app.decorate('container', container);
      await app.register(recommendationRoutes);

      const response = await app.inject({ method: 'GET', url: '/' });
      const body = response.json();

      expect(body.total).toBe(1);
      const titles = body.recommendations.map((r: { vacancy: { title: string } }) => r.vacancy.title);
      expect(titles).toEqual(['Senior Frontend Developer v-rel-0']);
    });

    it('orders the relevant pool by score under sortBy=score', async () => {
      const strong = relevantVacancy('v-strong');
      const weak = Vacancy.reconstitute(createVacancyId('v-weak'), {
        title: 'Frontend Developer v-weak',
        description: 'Partial overlap only',
        companyId: createCompanyId('company-1'),
        location: Location.create({ city: 'Remote', country: 'Remote', workMode: 'onsite', isRelocationPossible: false }),
        experienceLevel: ExperienceLevel.JUNIOR,
        technologies: [Technology.create('TypeScript', 'language')],
        requirements: [],
        responsibilities: [],
        isActive: true,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const padding = noSignalVacancy('v-pad');
      const container = createContainerWithVacancies([weak, padding, strong]);
      app.decorate('container', container);
      await app.register(recommendationRoutes);

      const response = await app.inject({ method: 'GET', url: '/?sortBy=score' });
      const body = response.json();

      expect(body.total).toBe(2);
      const ids = body.recommendations.map((r: { vacancy: { id: string } }) => r.vacancy.id);
      expect(ids).toEqual(['v-strong', 'v-weak']);
      expect(body.recommendations[0].score).toBeGreaterThanOrEqual(body.recommendations[1].score);
    });

    it('orders the relevant pool by publishedAt under sortBy=newest, excluding irrelevant vacancies regardless of recency', async () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const older = relevantVacancy('v-older', new Date(now - 5 * day));
      const newer = relevantVacancy('v-newer', new Date(now - 1 * day));
      const freshButIrrelevant = highSecondaryScoreNoSignalVacancy('v-fresh-irrelevant');
      const container = createContainerWithVacancies([older, newer, freshButIrrelevant]);
      app.decorate('container', container);
      await app.register(recommendationRoutes);

      const response = await app.inject({ method: 'GET', url: '/?sortBy=newest' });
      const body = response.json();

      expect(body.total).toBe(2);
      const ids = body.recommendations.map((r: { vacancy: { id: string } }) => r.vacancy.id);
      expect(ids).toEqual(['v-newer', 'v-older']);
    });

    it('paginates the relevant pool without overlap and reports total against the filtered set', async () => {
      const relevant = Array.from({ length: 7 }, (_, i) => relevantVacancy(`v-rel-${i}`));
      const irrelevant = Array.from({ length: 13 }, (_, i) => noSignalVacancy(`v-none-${i}`));
      const container = createContainerWithVacancies([...relevant, ...irrelevant]);
      app.decorate('container', container);
      await app.register(recommendationRoutes);

      const firstPage = (await app.inject({ method: 'GET', url: '/?offset=0&limit=5' })).json();
      const secondPage = (await app.inject({ method: 'GET', url: '/?offset=5&limit=5' })).json();

      expect(firstPage.total).toBe(7);
      expect(secondPage.total).toBe(7);
      expect(firstPage.recommendations).toHaveLength(5);
      expect(secondPage.recommendations).toHaveLength(2);

      const firstIds = firstPage.recommendations.map((r: { vacancy: { id: string } }) => r.vacancy.id);
      const secondIds = secondPage.recommendations.map((r: { vacancy: { id: string } }) => r.vacancy.id);
      const overlap = firstIds.filter((id: string) => secondIds.includes(id));

      expect(overlap).toHaveLength(0);
      expect(new Set([...firstIds, ...secondIds]).size).toBe(7);
      expect([...firstIds, ...secondIds].every((id: string) => id.startsWith('v-rel-'))).toBe(true);
    });
  });
});
