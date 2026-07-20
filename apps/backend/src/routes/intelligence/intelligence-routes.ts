import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Vacancy } from '@careeros/career';
import { createUserId } from '@careeros/career';
import type { Recommendation } from '../../services/recommendation-service.js';
import type { IntelligenceWorkflowResult } from '../../services/intelligence-workflow-service.js';
import { NotFoundError, UnauthorizedError, AppError } from '../../middleware/error-handler.js';
import { NoActiveSearchProfileError, NoResumeFoundError } from '../../services/intelligence-workflow-service.js';

const runWorkflowSchema = z.object({
  searchProfileId: z.string().uuid().optional(),
  providerId: z.string().optional(),
});

const statusSchema = z.object({
  searchProfileId: z.string().uuid(),
  vacancyIds: z.array(z.string().uuid()).min(1).max(200),
});

const createFromRecommendationSchema = z.object({
  vacancyId: z.string().uuid(),
  matchResultId: z.string().uuid().optional(),
  resumeId: z.string().uuid().optional(),
});

function requireUserId(request: { user?: { id: string } }): string {
  if (!request.user) {
    throw new UnauthorizedError('User not authenticated');
  }
  return request.user.id;
}

async function getWorkspaceId(fastify: FastifyInstance, userId: string): Promise<string> {
  const user = await fastify.container.repositories.user.findById(createUserId(userId));
  if (!user || user.workspaceIds.length === 0) {
    throw new NotFoundError('User workspace');
  }
  const workspaceId = user.workspaceIds[0];
  if (!workspaceId) {
    throw new NotFoundError('User workspace');
  }
  return workspaceId;
}

function serializeVacancySummary(vacancy: Vacancy) {
  return {
    id: vacancy.id,
    title: vacancy.title,
    companyId: vacancy.companyId,
    source: vacancy.source,
    sourceUrl: vacancy.sourceUrl?.value ?? null,
    location: vacancy.location.toString(),
    remote: vacancy.location.workMode.toUpperCase(),
    salaryMin: vacancy.salary?.min ?? null,
    salaryMax: vacancy.salary?.max ?? null,
    currency: vacancy.salary?.currency ?? null,
    publishedAt: vacancy.publishedAt ? vacancy.publishedAt.toISOString() : null,
  };
}

function serializeRecommendation(recommendation: Recommendation) {
  return {
    matchResultId: recommendation.matchResultId,
    vacancy: serializeVacancySummary(recommendation.vacancy),
    // overallScore is 0-100 internally; the dashboard displays score * 100 as a percentage.
    score: recommendation.score / 100,
    confidence: recommendation.confidence,
    recommendation: recommendation.recommendation,
    summary: recommendation.summary,
    strengths: recommendation.strengths,
    weaknesses: recommendation.weaknesses,
    requiredSkills: recommendation.requiredSkills,
    missingSkills: recommendation.missingSkills,
    seniorityEstimation: recommendation.seniorityEstimation,
    remotePolicy: recommendation.remotePolicy,
    salaryObservations: recommendation.salaryObservations,
    reasoning: recommendation.reasoning,
    generatedAt: recommendation.generatedAt.toISOString(),
    matchingAlgorithmVersion: recommendation.matchingAlgorithmVersion,
  };
}

/**
 * Merges the search result's vacancy list with its (possibly partial)
 * recommendations into one per-vacancy status the dashboard can render
 * immediately: 'matched' (has a score), 'pending' (queued for background AI
 * analysis), or 'skipped' (triage-rejected, or AI disabled — will never get
 * a score for this snapshot).
 */
function serializeSearchResult(result: IntelligenceWorkflowResult) {
  const recommendationByVacancyId = new Map(result.recommendations.map((rec) => [rec.vacancy.id, rec]));
  const pendingIds = new Set(result.pendingVacancyIds);

  const vacancies = result.vacancies.map((vacancy) => {
    const recommendation = recommendationByVacancyId.get(vacancy.id);
    const status = recommendation ? 'matched' : pendingIds.has(vacancy.id) ? 'pending' : 'skipped';
    return {
      status,
      vacancy: serializeVacancySummary(vacancy),
      recommendation: recommendation ? serializeRecommendation(recommendation) : null,
    };
  });

  const averageScore =
    result.recommendations.length > 0
      ? result.recommendations.reduce((sum, r) => sum + r.score, 0) / result.recommendations.length / 100
      : 0;

  return {
    searchProfileId: result.searchProfileId,
    vacancies,
    stats: {
      totalVacancies: result.stats.providerSearch.fetched,
      matchedVacancies: result.recommendations.length,
      pendingVacancies: result.pendingVacancyIds.length,
      averageScore,
    },
    aiEnabled: result.aiEnabled,
  };
}

export async function intelligenceRoutes(fastify: FastifyInstance) {
  fastify.post('/search', async (request, reply) => {
    const userId = requireUserId(request);
    const body = runWorkflowSchema.parse(request.body ?? {});
    const startedAt = Date.now();

    try {
      const result = await fastify.container.services.intelligenceWorkflow.run({
        userId,
        searchProfileId: body.searchProfileId,
        providerId: body.providerId,
      });

      const response = serializeSearchResult(result);
      fastify.log.info(
        { userId, searchProfileId: body.searchProfileId, durationMs: Date.now() - startedAt, status: 200 },
        'HTTP response returned'
      );
      return reply.send(response);
    } catch (error) {
      if (error instanceof NoActiveSearchProfileError) {
        throw new AppError(
          404,
          'Create your search profile before finding vacancies',
          'NO_ACTIVE_SEARCH_PROFILE'
        );
      }
      if (error instanceof NoResumeFoundError) {
        throw new AppError(
          404,
          'Upload your resume before running intelligence search',
          'NO_RESUME_FOUND'
        );
      }
      throw error;
    }
  });

  // Polling endpoint for vacancies reported as 'pending' by /search: reports
  // which of the given IDs now have a MatchResult (worker finished). Never
  // calls AI itself — cheap, cache-only lookup.
  fastify.post('/status', async (request, reply) => {
    const userId = requireUserId(request);
    const body = statusSchema.parse(request.body);

    try {
      const result = await fastify.container.services.intelligenceWorkflow.getMatchStatus({
        userId,
        searchProfileId: body.searchProfileId,
        vacancyIds: body.vacancyIds,
      });

      const recommendationByVacancyId = new Map<string, Recommendation>(
        result.recommendations.map((rec) => [rec.vacancy.id, rec])
      );
      const pendingIds = new Set(result.pendingVacancyIds);

      return reply.send({
        vacancies: body.vacancyIds.map((vacancyId) => {
          const recommendation = recommendationByVacancyId.get(vacancyId);
          const status = recommendation ? 'matched' : pendingIds.has(vacancyId) ? 'pending' : 'skipped';
          return {
            vacancyId,
            status,
            recommendation: recommendation ? serializeRecommendation(recommendation) : null,
          };
        }),
      });
    } catch (error) {
      if (error instanceof NoActiveSearchProfileError) {
        throw new AppError(404, 'Search profile not found', 'NO_ACTIVE_SEARCH_PROFILE');
      }
      if (error instanceof NoResumeFoundError) {
        throw new AppError(404, 'Upload your resume before running intelligence search', 'NO_RESUME_FOUND');
      }
      throw error;
    }
  });

  fastify.post('/applications', async (request, reply) => {
    const userId = requireUserId(request);
    const body = createFromRecommendationSchema.parse(request.body);
    const workspaceId = await getWorkspaceId(fastify, userId);

    const application = await fastify.container.services.applicationCreation.createFromIds({
      userId,
      vacancyId: body.vacancyId,
      matchResultId: body.matchResultId,
      resumeId: body.resumeId,
      workspaceId,
    });

    return reply.status(201).send({
      id: application.id,
      vacancyId: application.vacancyId,
      matchResultId: application.matchResultId ?? null,
      status: application.status,
      createdAt: application.createdAt.toISOString(),
    });
  });
}
