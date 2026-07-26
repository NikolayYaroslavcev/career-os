import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UnauthorizedError, NotFoundError } from '../../middleware/error-handler.js';
import { VacancyNotFoundError } from '../../services/resume-version-intelligence-service.js';
import type { Resume, ResumeListCriteria, ResumeVersionStatus } from '@careeros/career';

const periodSchema = z.object({
  period: z.enum(['7d', '30d', '90d', '180d', '365d', 'all']).optional().default('all'),
});

const resumeVersionListQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'archived']).optional(),
  tag: z.string().optional(),
});

const resumeCompareQuerySchema = z.object({
  resumeIdA: z.string(),
  resumeIdB: z.string(),
  period: z.enum(['7d', '30d', '90d', '180d', '365d', 'all']).optional().default('all'),
});

function requireUserId(request: { user?: { id: string } }): string {
  if (!request.user) {
    throw new UnauthorizedError('User not authenticated');
  }
  return request.user.id;
}

function serializeResumeVersion(resume: Resume): {
  id: string;
  title: string;
  description: string;
  language: string | null;
  tags: string[];
  status: ResumeVersionStatus;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: resume.id,
    title: resume.title,
    description: resume.description,
    language: resume.language ?? null,
    tags: [...resume.tags],
    status: resume.status,
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
  };
}

export async function careerIntelligenceRoutes(fastify: FastifyInstance): Promise<void> {
  const service = (): typeof fastify.container.services.careerIntelligence => fastify.container.services.careerIntelligence;
  const resumeVersionService = (): typeof fastify.container.services.resumeVersionIntelligence => fastify.container.services.resumeVersionIntelligence;

  fastify.get('/overview', async (request, reply) => {
    const userId = requireUserId(request);
    const { period } = periodSchema.parse(request.query);
    return reply.send(await service().getOverview(userId, period));
  });

  fastify.get('/funnel', async (request, reply) => {
    const userId = requireUserId(request);
    const { period } = periodSchema.parse(request.query);
    return reply.send(await service().getFunnel(userId, period));
  });

  fastify.get('/failure-analysis', async (request, reply) => {
    const userId = requireUserId(request);
    const { period } = periodSchema.parse(request.query);
    return reply.send(await service().getFailureAnalysis(userId, period));
  });

  fastify.get('/time-analytics', async (request, reply) => {
    const userId = requireUserId(request);
    const { period } = periodSchema.parse(request.query);
    return reply.send(await service().getTimeAnalytics(userId, period));
  });

  fastify.get('/match-analytics', async (request, reply) => {
    const userId = requireUserId(request);
    const { period } = periodSchema.parse(request.query);
    return reply.send(await service().getMatchAnalytics(userId, period));
  });

  fastify.get('/health', async (request, reply) => {
    const userId = requireUserId(request);
    const { period } = periodSchema.parse(request.query);
    return reply.send(await service().getCareerHealth(userId, period));
  });

  fastify.get('/performance-breakdowns', async (request, reply) => {
    const userId = requireUserId(request);
    const { period } = periodSchema.parse(request.query);
    return reply.send({ breakdowns: await service().getPerformanceBreakdowns(userId, period) });
  });

  fastify.get('/success-patterns', async (request, reply) => {
    const userId = requireUserId(request);
    const { period } = periodSchema.parse(request.query);
    return reply.send({ patterns: await service().getSuccessPatterns(userId, period) });
  });

  fastify.get('/trends', async (request, reply) => {
    const userId = requireUserId(request);
    const { period } = periodSchema.parse(request.query);
    return reply.send(await service().getTrends(userId, period));
  });

  fastify.get('/insights', async (request, reply) => {
    const userId = requireUserId(request);
    const { period } = periodSchema.parse(request.query);
    return reply.send(await service().getInsights(userId, period));
  });

  fastify.post('/refresh', async (request, reply) => {
    const userId = requireUserId(request);
    const { period } = periodSchema.parse(request.query);
    return reply.send(await service().refreshInsights(userId, period));
  });

  // ---- Resume Version Intelligence ----

  fastify.get('/resume-versions', async (request, reply) => {
    const userId = requireUserId(request);
    const query = resumeVersionListQuerySchema.parse(request.query);
    const criteria: ResumeListCriteria = {
      status: query.status as ResumeVersionStatus | undefined,
      tag: query.tag,
    };
    const versions = await resumeVersionService().listVersions(userId, criteria);
    return reply.send({ versions: versions.map(serializeResumeVersion), total: versions.length });
  });

  fastify.get('/resume-versions/performance', async (request, reply) => {
    const userId = requireUserId(request);
    const { period } = periodSchema.parse(request.query);
    return reply.send({ performance: await resumeVersionService().getAllVersionsPerformance(userId, period) });
  });

  fastify.get('/resume-versions/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params as { id: string };
    const resume = await resumeVersionService().getVersion(userId, id);
    if (!resume) {
      throw new NotFoundError(`Resume version '${id}' not found`);
    }
    return reply.send(serializeResumeVersion(resume));
  });

  fastify.get('/resume-versions/:id/performance', async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params as { id: string };
    const { period } = periodSchema.parse(request.query);

    const resume = await resumeVersionService().getVersion(userId, id);
    if (!resume) {
      throw new NotFoundError(`Resume version '${id}' not found`);
    }

    const [performance, breakdowns, insights] = await Promise.all([
      resumeVersionService().getVersionPerformance(userId, id, period),
      resumeVersionService().getVersionBreakdowns(userId, id, period),
      resumeVersionService().getVersionInsights(userId, id, period),
    ]);

    return reply.send({ performance, breakdowns, insights });
  });

  fastify.get('/resume-compare', async (request, reply) => {
    const userId = requireUserId(request);
    const { resumeIdA, resumeIdB, period } = resumeCompareQuerySchema.parse(request.query);

    const [versionA, versionB] = await Promise.all([
      resumeVersionService().getVersion(userId, resumeIdA),
      resumeVersionService().getVersion(userId, resumeIdB),
    ]);
    if (!versionA) throw new NotFoundError(`Resume version '${resumeIdA}' not found`);
    if (!versionB) throw new NotFoundError(`Resume version '${resumeIdB}' not found`);

    return reply.send(await resumeVersionService().compareVersions(userId, resumeIdA, resumeIdB, period));
  });

  fastify.get('/resume-recommendation/:vacancyId', async (request, reply) => {
    const userId = requireUserId(request);
    const { vacancyId } = request.params as { vacancyId: string };
    try {
      return reply.send(await resumeVersionService().recommendForVacancy(userId, vacancyId));
    } catch (error) {
      if (error instanceof VacancyNotFoundError) {
        throw new NotFoundError(error.message);
      }
      throw error;
    }
  });
}
