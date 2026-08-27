import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Vacancy, VacancySourceEntity, ExperienceLevel, ProviderType, VacancySource } from '@careeros/career';
import { createVacancyId, createUserId, SourceLifecycleServiceImpl } from '@careeros/career';
import type { InteractionAction } from '@careeros/career';
import { UnauthorizedError, NotFoundError } from '../../middleware/error-handler.js';
import { isNonVacancyContentShape } from '../../services/non-vacancy-content.js';
import { isExcludedCompanyName } from '../../services/excluded-companies.js';

const sourceLifecycleService = new SourceLifecycleServiceImpl();

const remoteValues = ['onsite', 'remote', 'hybrid', 'unknown'] as const;
const sortFields = ['newest', 'salary', 'relevance', 'company', 'title'] as const;
const sortOrders = ['asc', 'desc'] as const;

const listVacanciesSchema = z.object({
  query: z.string().optional(),
  location: z.string().optional(),
  remote: z.enum(remoteValues).optional(),
  salaryMin: z.coerce.number().optional(),
  salaryMax: z.coerce.number().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  experienceLevel: z.string().optional(),
  employmentType: z.string().optional(),
  technology: z.string().optional(),
  publishedAfter: z.coerce.date().optional(),
  publishedBefore: z.coerce.date().optional(),
  sortBy: z.enum(sortFields).default('newest'),
  sortOrder: z.enum(sortOrders).default('desc'),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

interface CompanyInfo { id: string; name: string; website: string | null }

interface VacancySourceDTO {
  id: string;
  providerId: VacancySource;
  providerType: ProviderType;
  sourceUrl: string | null;
  isPrimary: boolean;
  discoveredAt: string;
}

function serializeVacancySummary(
  vacancy: Vacancy,
  company: CompanyInfo | null,
  sources: VacancySourceEntity[],
): {
  id: string;
  title: string;
  company: string;
  companyId: string;
  location: string;
  remote: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  url: string | null;
  applyUrl: string | null;
  source: VacancySource | null;
  sources: VacancySourceDTO[];
  experienceLevel: ExperienceLevel;
  employmentType: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  technologies: string[];
} {
  const primarySource = sources.find((s) => s.isPrimary) ?? sources[0];
  return {
    id: vacancy.id,
    title: vacancy.title,
    company: company?.name ?? 'Unknown',
    companyId: vacancy.companyId,
    location: vacancy.location.toString(),
    remote: vacancy.location.workMode.toUpperCase(),
    salaryMin: vacancy.salary?.min ?? null,
    salaryMax: vacancy.salary?.max ?? null,
    currency: vacancy.salary?.currency ?? null,
    url: primarySource?.sourceUrl ?? null,
    applyUrl: sourceLifecycleService.computePrimaryApplyUrl(sources) ?? null,
    source: primarySource?.providerId ?? null,
    sources: sources.map((s) => ({
      id: s.id,
      providerId: s.providerId,
      providerType: s.providerType,
      sourceUrl: s.sourceUrl ?? null,
      isPrimary: s.isPrimary,
      discoveredAt: s.discoveredAt.toISOString(),
    })),
    experienceLevel: vacancy.experienceLevel,
    employmentType: vacancy.employmentType ?? null,
    publishedAt: vacancy.publishedAt ? vacancy.publishedAt.toISOString() : null,
    fetchedAt: vacancy.createdAt.toISOString(),
    technologies: vacancy.technologies.map((t) => t.name),
  };
}

function serializeVacancyDetail(
  vacancy: Vacancy,
  company: CompanyInfo | null,
  sources: VacancySourceEntity[],
): {
  id: string;
  title: string;
  description: string;
  company: CompanyInfo | null;
  companyId: string;
  location: string;
  remote: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  requirements: string[];
  technologies: string[];
  url: string | null;
  applyUrl: string | null;
  source: VacancySource | null;
  sources: (VacancySourceDTO & { lastSeenAt: string })[];
  experienceLevel: ExperienceLevel;
  employmentType: string | null;
  publishedAt: string | null;
  fetchedAt: string;
} {
  const primarySource = sources.find((s) => s.isPrimary) ?? sources[0];
  return {
    id: vacancy.id,
    title: vacancy.title,
    description: vacancy.description,
    company: company
      ? { id: company.id, name: company.name, website: company.website }
      : null,
    companyId: vacancy.companyId,
    location: vacancy.location.toString(),
    remote: vacancy.location.workMode.toUpperCase(),
    salaryMin: vacancy.salary?.min ?? null,
    salaryMax: vacancy.salary?.max ?? null,
    currency: vacancy.salary?.currency ?? null,
    requirements: [...vacancy.requirements],
    technologies: vacancy.technologies.map((t) => t.name),
    url: primarySource?.sourceUrl ?? null,
    applyUrl: sourceLifecycleService.computePrimaryApplyUrl(sources) ?? null,
    source: primarySource?.providerId ?? null,
    sources: sources.map((s) => ({
      id: s.id,
      providerId: s.providerId,
      providerType: s.providerType,
      sourceUrl: s.sourceUrl ?? null,
      isPrimary: s.isPrimary,
      discoveredAt: s.discoveredAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
    })),
    experienceLevel: vacancy.experienceLevel,
    employmentType: vacancy.employmentType ?? null,
    publishedAt: vacancy.publishedAt ? vacancy.publishedAt.toISOString() : null,
    fetchedAt: vacancy.createdAt.toISOString(),
  };
}

interface BatchCompanyLookup {
  findCompaniesForVacancies(companyIds: readonly string[]): Promise<Map<string, CompanyInfo>>;
}

function hasBatchCompanyLookup(repo: unknown): repo is BatchCompanyLookup {
  return typeof (repo as Partial<BatchCompanyLookup>).findCompaniesForVacancies === 'function';
}

async function batchFindCompanies(fastify: FastifyInstance, vacancies: readonly Vacancy[]): Promise<Map<string, CompanyInfo>> {
  const repo = fastify.container.repositories.vacancy;
  const companyIds = [...new Set(vacancies.map((v) => v.companyId))];
  if (hasBatchCompanyLookup(repo)) {
    return repo.findCompaniesForVacancies(companyIds);
  }
  const companies = await Promise.all(
    companyIds.map(async (id) => [id, await fastify.container.repositories.company.findById(id)] as const)
  );
  const byId = new Map<string, CompanyInfo>();
  for (const [id, company] of companies) {
    if (company) byId.set(id, { id: company.id, name: company.name, website: company.website?.value ?? null });
  }
  return byId;
}

async function batchFindSources(fastify: FastifyInstance, vacancyIds: readonly string[]): Promise<Map<string, VacancySourceEntity[]>> {
  const repo = fastify.container.repositories.vacancySource;
  const byId = new Map<string, VacancySourceEntity[]>();
  const results = await Promise.all(
    vacancyIds.map(async (id) => [id, await repo.findByVacancyId(createVacancyId(id))] as const)
  );
  for (const [id, sources] of results) {
    byId.set(id, sources);
  }
  return byId;
}

function requireUserId(request: { user?: { id: string } }): string {
  if (!request.user) throw new UnauthorizedError('User not authenticated');
  return request.user.id;
}

async function getWorkspaceId(fastify: FastifyInstance, userId: string): Promise<string> {
  const user = await fastify.container.repositories.user.findById(createUserId(userId));
  if (!user) throw new NotFoundError('User workspace');
  const [workspaceId] = user.workspaceIds;
  if (!workspaceId) throw new NotFoundError('User workspace');
  return workspaceId;
}

export async function vacancyRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const query = listVacanciesSchema.parse(request.query ?? {});

    const { vacancies, total } = await fastify.container.repositories.vacancy.findMany({
      workspaceId,
      query: query.query,
      location: query.location,
      remote: query.remote,
      salaryMin: query.salaryMin,
      salaryMax: query.salaryMax,
      company: query.company,
      source: query.source,
      experienceLevel: query.experienceLevel,
      employmentType: query.employmentType,
      technology: query.technology,
      publishedAfter: query.publishedAfter,
      publishedBefore: query.publishedBefore,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      limit: query.limit,
      offset: query.offset,
    });

    const visibleVacancies = vacancies.filter((vacancy) => !isNonVacancyContentShape(vacancy));
    const companiesById = await batchFindCompanies(fastify, visibleVacancies);
    const nonExcludedVacancies = visibleVacancies.filter(
      (vacancy) => !isExcludedCompanyName(companiesById.get(vacancy.companyId)?.name)
    );
    const hiddenCount = vacancies.length - nonExcludedVacancies.length;
    const sourcesById = await batchFindSources(fastify, nonExcludedVacancies.map((v) => v.id));

    return reply.send({
      vacancies: nonExcludedVacancies.map((vacancy) =>
        serializeVacancySummary(vacancy, companiesById.get(vacancy.companyId) ?? null, sourcesById.get(vacancy.id) ?? [])
      ),
      total: Math.max(0, total - hiddenCount),
      limit: query.limit,
      offset: query.offset,
    });
  });

  fastify.get('/stats', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);

    const stats = await fastify.container.repositories.vacancy.getStats(workspaceId);
    return reply.send({
      totalJobs: stats.totalJobs,
      newToday: stats.newToday,
      providers: stats.sources,
      totalProviders: fastify.container.providerRegistry.getAll().length,
      lastSyncAt: stats.lastSyncAt,
    });
  });

  fastify.get('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const params = request.params as { id: string };
    const vacancy = await fastify.container.repositories.vacancy.findByIdForWorkspace(
      createVacancyId(params.id),
      workspaceId
    );
    if (!vacancy) throw new NotFoundError(`Vacancy '${params.id}' not found`);
    if (isNonVacancyContentShape(vacancy)) throw new NotFoundError(`Vacancy '${params.id}' not found`);

    const companiesById = await batchFindCompanies(fastify, [vacancy]);
    const sources = await fastify.container.repositories.vacancySource.findByVacancyId(vacancy.id);

    return reply.send(serializeVacancyDetail(vacancy, companiesById.get(vacancy.companyId) ?? null, sources));
  });

  fastify.post('/by-url', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const body = request.body as { url?: string };
    if (!body?.url) {
      return reply.status(400).send({ error: 'url is required' });
    }

    async function respondForVacancy(vacancyId: ReturnType<typeof createVacancyId>): Promise<FastifyReply> {
      const vacancy = await fastify.container.repositories.vacancy.findByIdForWorkspace(vacancyId, workspaceId);
      if (!vacancy) {
        return reply.send({ exists: false });
      }
      const application = await fastify.container.repositories.application.findByUserIdAndVacancyId(
        createUserId(userId),
        vacancy.id
      );
      return reply.send({
        exists: true,
        vacancyId: vacancy.id,
        applicationId: application?.id ?? null,
        applicationStatus: application?.status ?? null,
      });
    }

    const sources = await fastify.container.repositories.vacancySource.findByProviderAndExternalId(
      'manual' as never,
      body.url,
      workspaceId
    );

    if (!sources) {
      const vacancySources = await fastify.container.repositories.vacancySource.findByVacancyId(
        createVacancyId('')
      );
      const found = vacancySources.find((s) => s.sourceUrl === body.url);
      if (!found) {
        return reply.send({ exists: false });
      }
      return respondForVacancy(found.vacancyId);
    }

    return respondForVacancy(sources.vacancyId);
  });

  fastify.post('/search', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const body = listVacanciesSchema.parse(request.body ?? {});

    const { vacancies, total } = await fastify.container.repositories.vacancy.findMany({
      workspaceId,
      query: body.query,
      location: body.location,
      remote: body.remote,
      salaryMin: body.salaryMin,
      salaryMax: body.salaryMax,
      company: body.company,
      source: body.source,
      experienceLevel: body.experienceLevel,
      employmentType: body.employmentType,
      technology: body.technology,
      publishedAfter: body.publishedAfter,
      publishedBefore: body.publishedBefore,
      sortBy: body.sortBy,
      sortOrder: body.sortOrder,
      limit: body.limit,
      offset: body.offset,
    });

    const visibleVacancies = vacancies.filter((vacancy) => !isNonVacancyContentShape(vacancy));
    const companiesById = await batchFindCompanies(fastify, visibleVacancies);
    const nonExcludedVacancies = visibleVacancies.filter(
      (vacancy) => !isExcludedCompanyName(companiesById.get(vacancy.companyId)?.name)
    );
    const hiddenCount = vacancies.length - nonExcludedVacancies.length;
    const sourcesById = await batchFindSources(fastify, nonExcludedVacancies.map((v) => v.id));

    return reply.send({
      vacancies: nonExcludedVacancies.map((vacancy) =>
        serializeVacancySummary(vacancy, companiesById.get(vacancy.companyId) ?? null, sourcesById.get(vacancy.id) ?? [])
      ),
      total: Math.max(0, total - hiddenCount),
      limit: body.limit,
      offset: body.offset,
    });
  });

  fastify.post('/:id/view', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const { id: vacancyId } = request.params as { id: string };

    const vacancy = await fastify.container.repositories.vacancy.findByIdForWorkspace(
      createVacancyId(vacancyId),
      workspaceId
    );
    if (!vacancy) throw new NotFoundError(`Vacancy '${vacancyId}' not found`);

    await fastify.container.repositories.userVacancyInteraction.record({
      userId: createUserId(userId),
      vacancyId: createVacancyId(vacancyId),
      action: 'VIEW' as InteractionAction,
    });

    return reply.status(201).send({ success: true });
  });

  fastify.post('/:id/save', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const { id: vacancyId } = request.params as { id: string };

    const vacancy = await fastify.container.repositories.vacancy.findByIdForWorkspace(
      createVacancyId(vacancyId),
      workspaceId
    );
    if (!vacancy) throw new NotFoundError(`Vacancy '${vacancyId}' not found`);

    await fastify.container.repositories.userVacancyInteraction.record({
      userId: createUserId(userId),
      vacancyId: createVacancyId(vacancyId),
      action: 'SAVE' as InteractionAction,
    });

    return reply.status(201).send({ success: true });
  });

  fastify.post('/:id/hide', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const { id: vacancyId } = request.params as { id: string };

    const vacancy = await fastify.container.repositories.vacancy.findByIdForWorkspace(
      createVacancyId(vacancyId),
      workspaceId
    );
    if (!vacancy) throw new NotFoundError(`Vacancy '${vacancyId}' not found`);

    await fastify.container.repositories.userVacancyInteraction.record({
      userId: createUserId(userId),
      vacancyId: createVacancyId(vacancyId),
      action: 'HIDE' as InteractionAction,
    });

    return reply.status(201).send({ success: true });
  });

  fastify.get('/:id/interactions', async (request, reply) => {
    const userId = requireUserId(request);
    const { id: vacancyId } = request.params as { id: string };

    const interactions = await fastify.container.repositories.userVacancyInteraction.findByUserIdAndVacancyId(
      createUserId(userId),
      createVacancyId(vacancyId),
    );

    return reply.send({ interactions });
  });
}
