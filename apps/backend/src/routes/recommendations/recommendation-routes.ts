import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UnauthorizedError, NotFoundError } from '../../middleware/error-handler.js';
import { createUserId, createVacancyId, SourceLifecycleServiceImpl } from '@careeros/career';
import type { VacancyId } from '@careeros/career';
import { computePreferenceBoosts } from '../../services/ranking/preference-boost.js';
import { calculateVacancyQualityScore } from '../../services/ranking/vacancy-quality-score.js';
import { isExcludedCompanyName } from '../../services/excluded-companies.js';

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

    // Candidate pool size: 500 rather than 200. A high-volume broad source
    // (e.g. jobicy) publishes densely enough that a 200-newest window can be
    // ~90% one provider, starving lower-volume-but-relevant sources (habr_career,
    // justjoin_it, telegram) out of ranking entirely. Diagnostics against the
    // real seeker@careeros.test workspace showed 500 stays within ~1 day of
    // the 200-cutoff's freshness (no stale backfill) while roughly tripling
    // both distinct providers represented and post-relevance-floor WARM/HOT
    // results. A provider-balanced (equal-N-per-provider) retrieval was also
    // measured and rejected: it pulled in long-stale listings from
    // rarely-syncing providers and surfaced Proxify-branded postings whose
    // `company` field is "Unknown" (title-only branding), bypassing the
    // company-name exclusion list without any offsetting quality gain over
    // simply widening this window.
    const { vacancies: fetchedVacancies } = await fastify.container.repositories.vacancy.findMany({
      workspaceId,
      limit: 500,
      offset: 0,
      sortBy: 'newest',
      sortOrder: 'desc',
    });

    const vacancies: typeof fetchedVacancies = [];
    for (const vacancy of fetchedVacancies) {
      const company = await fastify.container.repositories.company.findById(vacancy.companyId);
      if (company && isExcludedCompanyName(company.name)) continue;
      vacancies.push(vacancy);
    }

    const providerConfigs = await fastify.container.repositories.providerConfig.findAll();
    const qualityScores = new Map<string, number>();
    for (const config of providerConfigs) {
      if (config.qualityScore !== null && config.qualityScore !== undefined) {
        qualityScores.set(config.providerId, config.qualityScore);
      }
    }

    const vacancyIds = vacancies.map((v) => v.id.toString());
    // Keyed by providerId (e.g. 'telegram', 'hh'), matching qualityScores above
    // (ProviderConfig.qualityScore is also keyed by providerId) — rankVacancies'
    // 4th param looks up providerQualityScores by this map's values, so it must
    // carry providerId, not providerType, or every configured qualityScore is
    // silently missed and a computed fallback is used instead.
    const vacancyProviderTypes = new Map<string, string>();
    for (const vacancyId of vacancyIds) {
      const sources = await fastify.container.repositories.vacancySource.findByVacancyId(
        createVacancyId(vacancyId),
      );
      const [firstSource] = sources;
      if (firstSource) {
        vacancyProviderTypes.set(vacancyId, firstSource.providerId);
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

    // Relevance floor: the candidate pool (up to 200 newest workspace-wide
    // vacancies) is often dominated by one noisy provider, so without this
    // filter the endpoint backfills whatever's left just to fill `limit`,
    // surfacing vacancies with no connection to the profile at all. A
    // vacancy stays eligible if it has *either* signal — a positive role
    // match, or at least one matched technology — so an unrecognized title
    // (e.g. "Product Engineer", "Founding Engineer") with real tech overlap
    // is never dropped just because role classification didn't recognize it.
    const relevant = visible.filter(({ result }) =>
      result.matchedSkills.length > 0 ||
      result.positiveFactors.some((factor) => factor.name === 'Role match'),
    );

    // Sort the full relevant pool before pagination, not after — sorting a
    // page that was already sliced off the score-ordered list would only
    // ever reorder whichever items happened to score highest, silently
    // dropping a freshly-ingested vacancy that scores below the pagination
    // cutoff (e.g. a role mismatched against the active profile) out of a
    // "newest" or "salary" sort no matter how recent it is.
    let orderedVisible = relevant;
    if (query.sortBy === 'newest') {
      orderedVisible = [...relevant].sort((a, b) =>
        (b.vacancy.publishedAt?.getTime() ?? 0) - (a.vacancy.publishedAt?.getTime() ?? 0),
      );
    } else if (query.sortBy === 'salary') {
      orderedVisible = [...relevant].sort((a, b) =>
        (b.vacancy.salary?.max ?? 0) - (a.vacancy.salary?.max ?? 0),
      );
    }

    const total = orderedVisible.length;
    const sorted = orderedVisible.slice(query.offset, query.offset + query.limit);

    const recommendations = await Promise.all(
      sorted.map(async ({ vacancy, result }) => {
        const companies = await fastify.container.repositories.company.findById(vacancy.companyId);
        const sources = await fastify.container.repositories.vacancySource.findByVacancyId(vacancy.id);
        const primarySource = sources.find((s) => s.isPrimary) ?? sources[0];
        const providerId = primarySource?.providerId;
        const providerQuality = providerId ? qualityScores.get(providerId) : undefined;

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
