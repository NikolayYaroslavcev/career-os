import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UnauthorizedError, NotFoundError } from '../../middleware/error-handler.js';
import { createUserId, createVacancyId, SourceLifecycleServiceImpl } from '@careeros/career';
import type { VacancyId } from '@careeros/career';
import { computePreferenceBoosts } from '../../services/ranking/preference-boost.js';
import { calculateVacancyQualityScore } from '../../services/ranking/vacancy-quality-score.js';

const sourceLifecycleService = new SourceLifecycleServiceImpl();

const recommendationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(['score', 'newest', 'salary']).default('score'),
});

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

export async function recommendationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const query = recommendationsQuerySchema.parse(request.query ?? {});

    const searchProfiles = await fastify.container.repositories.searchProfile.findByUserId(
      createUserId(userId),
    );

    const activeProfile = searchProfiles.find((p) => p.isActive);
    if (!activeProfile) {
      return reply.send({
        recommendations: [],
        total: 0,
        limit: query.limit,
        offset: query.offset,
      });
    }

    const { vacancies } = await fastify.container.repositories.vacancy.findMany({
      workspaceId,
      limit: 200,
      offset: 0,
      sortBy: 'newest',
      sortOrder: 'desc',
    });

    const providerConfigs = await fastify.container.repositories.providerConfig.findAll();
    const qualityScores = new Map<string, number>();
    for (const config of providerConfigs) {
      if (config.qualityScore !== null && config.qualityScore !== undefined) {
        qualityScores.set(config.providerId, config.qualityScore);
      }
    }

    const vacancyIds = vacancies.map((v) => v.id.toString());
    const vacancyProviderTypes = new Map<string, string>();
    for (const vacancyId of vacancyIds) {
      const sources = await fastify.container.repositories.vacancySource.findByVacancyId(
        createVacancyId(vacancyId),
      );
      const [firstSource] = sources;
      if (firstSource) {
        vacancyProviderTypes.set(vacancyId, firstSource.providerType);
      }
    }

    const { VacancyRankingService } = await import('../../services/ranking/vacancy-ranking-service.js');
    const rankingService = new VacancyRankingService();

    const vacancyLookup = async (vacancyId: VacancyId): ReturnType<typeof fastify.container.repositories.vacancy.findByIdForWorkspace> => {
      return fastify.container.repositories.vacancy.findByIdForWorkspace(vacancyId, workspaceId);
    };

    const preferenceBoosts = await computePreferenceBoosts(
      createUserId(userId),
      fastify.container.repositories.userVacancyInteraction,
      vacancyLookup,
    );

    const interactions = await fastify.container.repositories.userVacancyInteraction.findByUserId(
      createUserId(userId),
    );

    const interactionData = interactions.map((i) => ({
      action: i.action,
      vacancyId: i.vacancyId as string,
    }));

    const ranked = rankingService.rankVacancies(
      vacancies,
      activeProfile,
      qualityScores,
      vacancyProviderTypes,
      preferenceBoosts,
      interactionData,
    );

    const excludedVacancyIds = new Set(
      interactions
        .filter((i) => i.action === 'HIDE' || i.action === 'APPLY')
        .map((i) => i.vacancyId as string),
    );
    const visible = ranked.filter(({ vacancy }) => !excludedVacancyIds.has(vacancy.id.toString()));

    const total = visible.length;
    const paginated = visible.slice(query.offset, query.offset + query.limit);

    let sorted = paginated;
    if (query.sortBy === 'newest') {
      sorted = [...paginated].sort((a, b) =>
        (b.vacancy.publishedAt?.getTime() ?? 0) - (a.vacancy.publishedAt?.getTime() ?? 0),
      );
    } else if (query.sortBy === 'salary') {
      sorted = [...paginated].sort((a, b) =>
        (b.vacancy.salary?.max ?? 0) - (a.vacancy.salary?.max ?? 0),
      );
    }

    const recommendations = await Promise.all(
      sorted.map(async ({ vacancy, result }) => {
        const companies = await fastify.container.repositories.company.findById(vacancy.companyId);
        const sources = await fastify.container.repositories.vacancySource.findByVacancyId(vacancy.id);
        const primarySource = sources.find((s) => s.isPrimary) ?? sources[0];
        const providerType = primarySource?.providerType;
        const providerQuality = providerType ? qualityScores.get(providerType) : undefined;

        const qualityScore = calculateVacancyQualityScore(vacancy, primarySource?.applyUrl ?? undefined, providerQuality);

        return {
          vacancy: {
            id: vacancy.id,
            title: vacancy.title,
            company: companies?.name ?? 'Unknown',
            companyId: vacancy.companyId,
            location: vacancy.location.toString(),
            remote: vacancy.location.workMode.toUpperCase(),
            salaryMin: vacancy.salary?.min ?? null,
            salaryMax: vacancy.salary?.max ?? null,
            currency: vacancy.salary?.currency ?? null,
            technologies: vacancy.technologies.map((t) => t.name),
            publishedAt: vacancy.publishedAt?.toISOString() ?? null,
            sourceUrl: primarySource?.sourceUrl ?? null,
            applyUrl: sourceLifecycleService.computePrimaryApplyUrl(sources) ?? null,
          },
          score: result.score,
          tier: result.tier,
          matchedSkills: result.matchedSkills,
          missingSkills: result.missingSkills,
          reasons: result.reasons,
          qualityScore: qualityScore.total,
          explanation: result.explanation,
        };
      }),
    );

    return reply.send({
      recommendations,
      total,
      limit: query.limit,
      offset: query.offset,
    });
  });
}
