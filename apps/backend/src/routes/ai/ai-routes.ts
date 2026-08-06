import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createUserId, createVacancyId, createSearchProfileId, createResumeId } from '@careeros/career';
import { UnauthorizedError, NotFoundError } from '../../middleware/error-handler.js';

function requireUserId(request: { user?: { id: string } }): string {
  if (!request.user) {
    throw new UnauthorizedError('User not authenticated');
  }
  return request.user.id;
}

// AI Action schemas
const analyzeVacancySchema = z.object({
  vacancyId: z.string().uuid(),
  searchProfileId: z.string().uuid(),
});

const tailorResumeSchema = z.object({
  vacancyId: z.string().uuid(),
  resumeId: z.string().uuid(),
  forceRegenerate: z.boolean().optional(),
});

const coverLetterSchema = z.object({
  vacancyId: z.string().uuid(),
  resumeId: z.string().uuid(),
});

const interviewPrepSchema = z.object({
  vacancyId: z.string().uuid(),
  interviewType: z.enum(['HR', 'TECHNICAL', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'CODING', 'CULTURAL', 'FINAL']),
});

const salaryAnalysisSchema = z.object({
  jobTitle: z.string().min(1),
  location: z.string().min(1),
  technologies: z.array(z.string()).optional().default([]),
  experienceLevel: z.string().min(1),
  companySize: z.string().optional(),
  industry: z.string().optional(),
});

const companyAnalysisSchema = z.object({
  companyName: z.string().min(1),
  industry: z.string().optional(),
  size: z.string().optional(),
  website: z.string().url().optional(),
  technologies: z.array(z.string()).optional(),
});

const resumeImprovementSchema = z.object({
  resumeId: z.string().uuid(),
  targetRole: z.string().optional(),
  targetTechnologies: z.array(z.string()).optional(),
});

const careerAdviceSchema = z.object({
  question: z.string().min(1),
  currentRole: z.string().optional(),
  experience: z.string().optional(),
  skills: z.array(z.string()).optional(),
  goals: z.string().optional(),
});

// Job management schemas
const jobQuerySchema = z.object({
  feature: z.string().optional(),
  status: z.string().optional(),
  vacancyId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

// Usage schemas
const usagePeriodSchema = z.object({
  period: z.enum(['today', 'week', 'month']).optional().default('month'),
});

// Budget schemas
const updateBudgetSchema = z.object({
  period: z.enum(['DAILY', 'MONTHLY']),
  maxTokens: z.number().optional(),
  maxCost: z.number().optional(),
  maxRequestsPerFeature: z.record(z.number()).optional(),
  isEnabled: z.boolean().optional(),
});

// Mode schema
const updateModeSchema = z.object({
  mode: z.enum(['manual', 'smart', 'automatic']),
});

// Provider config schema
const providerConfigSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().optional(),
});

export async function aiRoutes(fastify: FastifyInstance): Promise<void> {
  // ===== AI Actions =====

  // Analyze Vacancy
  fastify.post('/analyze-vacancy', async (request, reply) => {
    const userId = requireUserId(request);
    const body = analyzeVacancySchema.parse(request.body);

    const orchestrator = fastify.container.aiOrchestrator;
    const vacancyRepo = fastify.container.repositories.vacancy;
    const searchProfileRepo = fastify.container.repositories.searchProfile;
    const resumeRepo = fastify.container.repositories.resume;
    const companyRepo = fastify.container.repositories.company;

    // Load entities
    const [vacancy, profile] = await Promise.all([
      vacancyRepo.findById(createVacancyId(body.vacancyId)),
      searchProfileRepo.findById(createSearchProfileId(body.searchProfileId)),
    ]);

    if (!vacancy) throw new NotFoundError('Vacancy');
    if (!profile) throw new NotFoundError('Search Profile');

    const [resume, company] = await Promise.all([
      resumeRepo.findDefaultByUserId(createUserId(userId)),
      companyRepo.findById(vacancy.companyId),
    ]);

    const inputHash = `${vacancy.id}:${profile.id}:${vacancy.updatedAt.getTime()}`;

    const result = await orchestrator.execute({
      feature: 'analyze_vacancy',
      userId,
      input: {
        vacancyId: vacancy.id,
        vacancyTitle: vacancy.title,
        vacancyDescription: vacancy.description,
        companyName: company?.name ?? 'Unknown',
        technologies: vacancy.requirements,
        experienceLevel: vacancy.experienceLevel,
        location: vacancy.location.toString(),
        searchProfileId: profile.id,
        desiredPositions: profile.desiredPositions,
        desiredTechnologies: profile.desiredTechnologies.map((t) => t.name),
        desiredExperienceLevel: profile.experienceLevel,
        isRemoteOnly: profile.isRemoteOnly,
        desiredLocations: profile.desiredLocations.map((l) => l.toString()),
        resume: resume ? {
          summary: resume.summary,
          skills: resume.skills.map((s) => s.name),
          technologies: resume.technologies.map((t) => t.name),
          yearsOfExperience: resume.totalYearsOfExperience,
          rawText: resume.rawText ?? '',
        } : undefined,
      },
      inputHash,
    });

    if (result.jobId) {
      await fastify.container.repositories.aiJob.update(result.jobId, { vacancyId: vacancy.id });
    }

    return reply.send(result);
  });

  // Tailor Resume (ADR-031: async pipeline, apps/worker — see TailoringRequestService)
  fastify.post('/tailor-resume', async (request, reply) => {
    const userId = requireUserId(request);
    const body = tailorResumeSchema.parse(request.body);

    const vacancyRepo = fastify.container.repositories.vacancy;
    const resumeRepo = fastify.container.repositories.resume;

    const [vacancy, resume] = await Promise.all([
      vacancyRepo.findById(createVacancyId(body.vacancyId)),
      resumeRepo.findById(createResumeId(body.resumeId)),
    ]);

    if (!vacancy) throw new NotFoundError('Vacancy');
    if (!resume) throw new NotFoundError('Resume');
    if (resume.userId !== userId) throw new UnauthorizedError('Not your resume');

    const result = await fastify.container.services.tailoringRequest.requestTailoring({
      userId,
      resumeId: resume.id,
      resumeUpdatedAt: resume.updatedAt,
      vacancyId: vacancy.id,
      vacancyUpdatedAt: vacancy.updatedAt,
      forceRegenerate: body.forceRegenerate,
    });

    return reply.send(result);
  });

  // Tailor Resume status (poll target for the queued job above)
  fastify.get('/tailor-resume/:id/status', async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params as { id: string };
    const result = await fastify.container.services.tailoringRequest.getStatusById(userId, decodeURIComponent(id));
    return reply.send(result);
  });

  // Generate Cover Letter
  fastify.post('/cover-letter', async (request, reply) => {
    const userId = requireUserId(request);
    const body = coverLetterSchema.parse(request.body);

    const orchestrator = fastify.container.aiOrchestrator;
    const vacancyRepo = fastify.container.repositories.vacancy;
    const resumeRepo = fastify.container.repositories.resume;
    const companyRepo = fastify.container.repositories.company;

    const [vacancy, resume] = await Promise.all([
      vacancyRepo.findById(createVacancyId(body.vacancyId)),
      resumeRepo.findById(createResumeId(body.resumeId)),
    ]);

    if (!vacancy) throw new NotFoundError('Vacancy');
    if (!resume) throw new NotFoundError('Resume');
    if (resume.userId !== userId) throw new UnauthorizedError('Not your resume');

    const company = await companyRepo.findById(vacancy.companyId);

    const inputHash = `${vacancy.id}:${resume.id}:${resume.updatedAt.getTime()}`;

    const result = await orchestrator.execute({
      feature: 'cover_letter',
      userId,
      input: {
        vacancyId: vacancy.id,
        vacancyTitle: vacancy.title,
        vacancyDescription: vacancy.description,
        companyName: company?.name ?? 'Unknown',
        technologies: vacancy.technologies.map((t) => t.name),
        experienceLevel: vacancy.experienceLevel,
        location: vacancy.location.toString(),
        companyIndustry: company?.industry,
        companySize: company?.size,
        resumeId: resume.id,
        resumeText: resume.rawText ?? resume.summary,
        structuredResume: {
          summary: resume.summary,
          skills: resume.skills.map((s) => s.name),
          technologies: resume.technologies.map((t) => t.name),
          experience: resume.experience.map((e) => ({
            company: e.company,
            position: e.position,
            description: e.description,
            technologies: e.technologies.map((t) => t.name),
          })),
        },
      },
      inputHash,
    });

    if (result.jobId) {
      await fastify.container.repositories.aiJob.update(result.jobId, { vacancyId: vacancy.id });
    }

    return reply.send(result);
  });

  // Interview Preparation
  fastify.post('/interview-prep', async (request, reply) => {
    const userId = requireUserId(request);
    const body = interviewPrepSchema.parse(request.body);

    const orchestrator = fastify.container.aiOrchestrator;
    const vacancyRepo = fastify.container.repositories.vacancy;
    const resumeRepo = fastify.container.repositories.resume;
    const companyRepo = fastify.container.repositories.company;

    const vacancy = await vacancyRepo.findById(createVacancyId(body.vacancyId));
    if (!vacancy) throw new NotFoundError('Vacancy');

    const resume = await resumeRepo.findDefaultByUserId(createUserId(userId));
    const company = await companyRepo.findById(vacancy.companyId);

    const inputHash = `${vacancy.id}:${body.interviewType}:${userId}`;

    const result = await orchestrator.execute({
      feature: 'interview_prep',
      userId,
      input: {
        vacancyTitle: vacancy.title,
        vacancyDescription: vacancy.description,
        companyName: company?.name ?? 'Unknown',
        technologies: vacancy.requirements,
        interviewType: body.interviewType,
        resumeText: resume ? (resume.rawText ?? resume.summary) : '',
      },
      inputHash,
    });

    if (result.jobId) {
      await fastify.container.repositories.aiJob.update(result.jobId, { vacancyId: vacancy.id });
    }

    return reply.send(result);
  });

  // Salary Analysis
  fastify.post('/salary-analysis', async (request, reply) => {
    const userId = requireUserId(request);
    const body = salaryAnalysisSchema.parse(request.body);

    const orchestrator = fastify.container.aiOrchestrator;

    const inputHash = `${body.jobTitle}:${body.location}:${body.experienceLevel}:${body.technologies.join(',')}`;

    const result = await orchestrator.execute({
      feature: 'salary_analysis',
      userId,
      input: body,
      inputHash,
    });

    return reply.send(result);
  });

  // Company Analysis
  fastify.post('/company-analysis', async (request, reply) => {
    const userId = requireUserId(request);
    const body = companyAnalysisSchema.parse(request.body);

    const orchestrator = fastify.container.aiOrchestrator;

    const inputHash = `${body.companyName}:${body.industry ?? ''}:${body.size ?? ''}`;

    const result = await orchestrator.execute({
      feature: 'company_analysis',
      userId,
      input: body,
      inputHash,
    });

    return reply.send(result);
  });

  // Resume Improvement
  fastify.post('/resume-improvement', async (request, reply) => {
    const userId = requireUserId(request);
    const body = resumeImprovementSchema.parse(request.body);

    const orchestrator = fastify.container.aiOrchestrator;
    const resumeRepo = fastify.container.repositories.resume;

    const resume = await resumeRepo.findById(createResumeId(body.resumeId));
    if (!resume) throw new NotFoundError('Resume');
    if (resume.userId !== userId) throw new UnauthorizedError('Not your resume');

    const inputHash = `${resume.id}:${resume.updatedAt.getTime()}:${body.targetRole ?? ''}`;

    const result = await orchestrator.execute({
      feature: 'resume_improvement',
      userId,
      input: {
        resumeText: resume.rawText ?? resume.summary,
        targetRole: body.targetRole,
        targetTechnologies: body.targetTechnologies,
      },
      inputHash,
    });

    return reply.send(result);
  });

  // Career Advice
  fastify.post('/career-advice', async (request, reply) => {
    const userId = requireUserId(request);
    const body = careerAdviceSchema.parse(request.body);

    const orchestrator = fastify.container.aiOrchestrator;

    const inputHash = `${userId}:${body.question}:${body.currentRole ?? ''}:${body.goals ?? ''}`;

    const result = await orchestrator.execute({
      feature: 'career_advice',
      userId,
      input: body,
      inputHash,
    });

    return reply.send(result);
  });

  // ===== Job Management =====

  // Get job status
  fastify.get('/jobs/:jobId', async (request, reply) => {
    const userId = requireUserId(request);
    const { jobId } = request.params as { jobId: string };

    const orchestrator = fastify.container.aiOrchestrator;
    const job = await orchestrator.getJobStatus(jobId);

    if (!job) throw new NotFoundError('AI Job');
    if (job.userId !== userId) throw new UnauthorizedError('Not your job');

    return reply.send(job);
  });

  // List user's jobs
  fastify.get('/jobs', async (request, reply) => {
    const userId = requireUserId(request);
    const query = jobQuerySchema.parse(request.query);

    const jobs = await fastify.container.repositories.aiJob.findByUserId(userId, {
      feature: query.feature,
      status: query.status,
      vacancyId: query.vacancyId,
      applicationId: query.applicationId,
      limit: query.limit,
      offset: query.offset,
    });

    return reply.send({ jobs, total: jobs.length });
  });

  // Cancel job
  fastify.delete('/jobs/:jobId', async (request, reply) => {
    const userId = requireUserId(request);
    const { jobId } = request.params as { jobId: string };

    const orchestrator = fastify.container.aiOrchestrator;
    const job = await orchestrator.getJobStatus(jobId);

    if (!job) throw new NotFoundError('AI Job');
    if (job.userId !== userId) throw new UnauthorizedError('Not your job');

    await orchestrator.cancelJob(jobId);

    return reply.send({ success: true });
  });

  // ===== Usage & Dashboard =====

  // Get usage stats
  fastify.get('/usage', async (request, reply) => {
    const userId = requireUserId(request);
    const query = usagePeriodSchema.parse(request.query);

    const orchestrator = fastify.container.aiOrchestrator;
    const stats = await orchestrator.getUsageStats(userId, query.period);

    return reply.send(stats);
  });

  // Get dashboard data
  fastify.get('/usage/dashboard', async (request, reply) => {
    const userId = requireUserId(request);

    const orchestrator = fastify.container.aiOrchestrator;
    const dashboard = await orchestrator.getDashboardData(userId);

    return reply.send(dashboard);
  });

  // ===== Budget =====

  // Get budget status
  fastify.get('/budget', async (request, reply) => {
    const userId = requireUserId(request);

    const budgetRepo = fastify.container.repositories.aiBudget;
    const dailyBudget = await budgetRepo.findByUserAndPeriod(userId, 'DAILY');
    const monthlyBudget = await budgetRepo.findByUserAndPeriod(userId, 'MONTHLY');

    return reply.send({ daily: dailyBudget, monthly: monthlyBudget });
  });

  // Update budget
  fastify.put('/budget', async (request, reply) => {
    const userId = requireUserId(request);
    const body = updateBudgetSchema.parse(request.body);

    const budgetRepo = fastify.container.repositories.aiBudget;
    const budget = await budgetRepo.upsert({
      userId,
      period: body.period,
      maxTokens: body.maxTokens,
      maxCost: body.maxCost,
      maxRequestsPerFeature: body.maxRequestsPerFeature,
      isEnabled: body.isEnabled,
    });

    return reply.send(budget);
  });

  // ===== Mode =====

  // Get AI mode
  fastify.get('/mode', async (request, reply) => {
    const orchestrator = fastify.container.aiOrchestrator;
    const mode = await orchestrator.getMode();

    return reply.send({ mode });
  });

  // Set AI mode
  fastify.put('/mode', async (request, reply) => {
    const body = updateModeSchema.parse(request.body);

    const orchestrator = fastify.container.aiOrchestrator;
    await orchestrator.setMode(body.mode);

    return reply.send({ mode: body.mode });
  });

  // ===== Cache =====

  // Get cache stats
  fastify.get('/cache/stats', async (request, reply) => {
    const orchestrator = fastify.container.aiOrchestrator;
    const stats = await orchestrator.getCacheStats();

    return reply.send(stats);
  });

  // Clear cache
  fastify.delete('/cache', async (request, reply) => {
    const query = z.object({ feature: z.string().optional() }).parse(request.query);

    const orchestrator = fastify.container.aiOrchestrator;
    const deleted = await orchestrator.invalidateCache(query.feature);

    return reply.send({ deleted });
  });

  // ===== Providers =====

  // List providers
  fastify.get('/providers', async (request, reply) => {
    const userId = requireUserId(request);

    const providerConfigRepo = fastify.container.repositories.aiProviderConfig;
    const configs = await providerConfigRepo.findByUserId(userId);

    const safeConfigs = configs.map((c) => ({
      provider: c.provider,
      model: c.model,
      baseUrl: c.baseUrl,
      hasApiKey: Boolean(c.apiKey),
    }));

    return reply.send({ providers: safeConfigs });
  });

  // Update provider config
  fastify.put('/providers', async (request, reply) => {
    const userId = requireUserId(request);
    const body = providerConfigSchema.parse(request.body);

    const providerConfigRepo = fastify.container.repositories.aiProviderConfig;
    const config = await providerConfigRepo.upsert({
      userId,
      ...body,
    });

    return reply.send({
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      hasApiKey: Boolean(config.apiKey),
      isActive: config.isActive,
    });
  });

  // Delete provider config
  fastify.delete('/providers/:provider', async (request, reply) => {
    const userId = requireUserId(request);
    const { provider } = request.params as { provider: string };

    const providerConfigRepo = fastify.container.repositories.aiProviderConfig;
    await providerConfigRepo.deleteByUserAndProvider(userId, provider);

    return reply.send({ success: true });
  });
}
