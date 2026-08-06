import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Application, Communication, Interview, FollowUp } from '@careeros/career';
import { createUserId, createVacancyId, createResumeId } from '@careeros/career';
import { NotFoundError, UnauthorizedError, ConflictError, ValidationError } from '../../middleware/error-handler.js';
import {
  ApplicationNotFoundError,
  ApplicationNotAuthorizedError,
  InvalidStatusTransitionError,
  RecruiterNotAuthorizedError,
} from '../../services/application-crm-service.js';
import {
  FollowUpApplicationNotFoundError,
  FollowUpNotAuthorizedError,
  FollowUpNotFoundError,
} from '../../services/follow-up-service.js';

const applicationStatusValues = [
  'saved',
  'started',
  'submitted',
  'waiting',
  'hr_interview',
  'technical_interview',
  'final_interview',
  'offer',
  'rejected',
  'archived',
] as const;

const createApplicationSchema = z.object({
  vacancyId: z.string().uuid(),
  matchResultId: z.string().uuid().optional(),
  resumeId: z.string().uuid().optional(),
});

const updateApplicationSchema = z.object({
  notes: z.string().min(1).optional(),
});

const changeStatusSchema = z.object({
  status: z.enum(applicationStatusValues),
});

const addNoteSchema = z.object({
  content: z.string().min(1),
});

const scheduleFollowUpSchema = z.object({
  date: z.string().datetime(),
  message: z.string().min(1).optional(),
});

const snoozeFollowUpSchema = z.object({
  date: z.string().datetime(),
});

const assignRecruiterSchema = z.object({
  recruiterId: z.string().uuid(),
});

const addCommunicationSchema = z.object({
  type: z.enum(['email', 'phone', 'linkedin', 'telegram', 'other']),
  direction: z.enum(['inbound', 'outbound']),
  content: z.string().optional(),
  subject: z.string().optional(),
});

const scheduleInterviewSchema = z.object({
  type: z.enum(['hr', 'technical', 'system_design', 'behavioral', 'coding', 'cultural', 'final']),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().min(15).max(480).optional(),
  interviewerName: z.string().optional(),
  interviewerEmail: z.string().email().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const listQuerySchema = z.object({
  status: z.enum(applicationStatusValues).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
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

/** Statuses where a stalled application is expected/fine — no point warning about them. */
const COOLING_DOWN_EXEMPT_STATUSES = new Set(['saved', 'rejected', 'archived', 'offer']);
/** How long an active application can sit with no activity and no pending follow-up before it's flagged. Informational only — never affects ranking. */
const COOLING_DOWN_AFTER_DAYS = 10;

/**
 * Purely informational "this might be going cold" signal for the CRM board (task item 6) — does
 * not touch AiMatchingService or any ranking score, just flags applications with no recent
 * activity and nothing scheduled to nudge the user.
 */
function isCoolingDown(application: Application, hasPendingFollowUp: boolean): boolean {
  if (COOLING_DOWN_EXEMPT_STATUSES.has(application.status) || hasPendingFollowUp) {
    return false;
  }

  const daysSinceActivity = (Date.now() - application.updatedAt.getTime()) / 86_400_000;
  return daysSinceActivity >= COOLING_DOWN_AFTER_DAYS;
}

function serializeApplication(application: Application, hasPendingFollowUp = false): {
  id: string;
  userId: string;
  vacancyId: string;
  resumeId: string | null;
  matchResultId: string | null;
  recruiterId: string | null;
  status: Application['status'];
  notes: { content: string; createdAt: string }[];
  startedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  coolingDown: boolean;
} {
  return {
    id: application.id,
    userId: application.userId,
    vacancyId: application.vacancyId,
    resumeId: application.resumeId ?? null,
    matchResultId: application.matchResultId ?? null,
    recruiterId: application.recruiterId ?? null,
    status: application.status,
    notes: application.notes.map((note) => ({
      content: note.content,
      createdAt: note.createdAt.toISOString(),
    })),
    startedAt: application.startedAt ? application.startedAt.toISOString() : null,
    submittedAt: application.submittedAt ? application.submittedAt.toISOString() : null,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    coolingDown: isCoolingDown(application, hasPendingFollowUp),
  };
}

function serializeFollowUp(followUp: FollowUp): {
  id: string;
  applicationId: string;
  scheduledAt: string;
  status: FollowUp['status'];
  message: string | null;
  sentAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: followUp.id,
    applicationId: followUp.applicationId,
    scheduledAt: followUp.scheduledAt.toISOString(),
    status: followUp.status,
    message: followUp.message ?? null,
    sentAt: followUp.sentAt ? followUp.sentAt.toISOString() : null,
    snoozedUntil: followUp.snoozedUntil ? followUp.snoozedUntil.toISOString() : null,
    createdAt: followUp.createdAt.toISOString(),
    updatedAt: followUp.updatedAt.toISOString(),
  };
}

function serializeCommunication(communication: Communication): {
  id: string;
  applicationId: string;
  type: Communication['type'];
  direction: Communication['direction'];
  content: string | null;
  subject: string | null;
  sentAt: string;
} {
  return {
    id: communication.id,
    applicationId: communication.applicationId,
    type: communication.type,
    direction: communication.direction,
    content: communication.content ?? null,
    subject: communication.subject ?? null,
    sentAt: communication.sentAt.toISOString(),
  };
}

function serializeInterview(interview: Interview): {
  id: string;
  applicationId: string;
  type: Interview['type'];
  scheduledAt: string;
  durationMinutes: number;
  interviewerName: string | null;
  interviewerEmail: string | null;
  location: string | null;
  notes: string | null;
  isCompleted: boolean;
  feedback: Interview['feedback'] | null;
  createdAt: string;
} {
  return {
    id: interview.id,
    applicationId: interview.applicationId,
    type: interview.type,
    scheduledAt: interview.scheduledAt.toISOString(),
    durationMinutes: interview.durationMinutes,
    interviewerName: interview.interviewerName ?? null,
    interviewerEmail: interview.interviewerEmail ?? null,
    location: interview.location ?? null,
    notes: interview.notes ?? null,
    isCompleted: interview.isCompleted,
    feedback: interview.feedback ?? null,
    createdAt: interview.createdAt.toISOString(),
  };
}

function mapCrmError(error: unknown): never {
  if (error instanceof ApplicationNotFoundError) {
    throw new NotFoundError(error.message);
  }
  if (error instanceof ApplicationNotAuthorizedError) {
    throw new UnauthorizedError(error.message);
  }
  if (error instanceof InvalidStatusTransitionError) {
    throw new ConflictError(error.message);
  }
  if (error instanceof RecruiterNotAuthorizedError) {
    throw new ValidationError(error.message);
  }
  if (error instanceof FollowUpApplicationNotFoundError || error instanceof FollowUpNotFoundError) {
    throw new NotFoundError(error.message);
  }
  if (error instanceof FollowUpNotAuthorizedError) {
    throw new UnauthorizedError(error.message);
  }
  throw error;
}

export async function applicationRoutes(fastify: FastifyInstance): Promise<void> {
  async function pendingFollowUpApplicationIds(userId: string): Promise<Set<string>> {
    const followUps = await fastify.container.services.followUp.findByUserId(userId);
    return new Set(
      followUps.filter((f) => f.status === 'pending' || f.status === 'snoozed').map((f) => f.applicationId)
    );
  }

  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request);
    const query = listQuerySchema.parse(request.query);

    const { applications, total } = await fastify.container.services.applicationCrm.list(userId, {
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
    const pendingIds = await pendingFollowUpApplicationIds(userId);

    return reply.send({
      applications: applications.map((application) => serializeApplication(application, pendingIds.has(application.id))),
      total,
    });
  });

  fastify.get('/pipeline', async (request, reply) => {
    const userId = requireUserId(request);
    const groups = await fastify.container.services.applicationCrm.getPipeline(userId);
    const pendingIds = await pendingFollowUpApplicationIds(userId);

    return reply.send({
      pipeline: groups.map((group) => ({
        status: group.status,
        count: group.count,
        applications: group.applications.map((application) =>
          serializeApplication(application, pendingIds.has(application.id))
        ),
      })),
    });
  });

  fastify.get('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };

    try {
      const application = await fastify.container.services.applicationCrm.getOwned(params.id, userId);
      return reply.send(serializeApplication(application));
    } catch (error) {
      mapCrmError(error);
    }
  });

  fastify.post('/', {
    schema: {
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            vacancyId: { type: 'string' },
            matchResultId: { type: ['string', 'null'] },
            status: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // Returned when the application already exists for this vacancy (idempotent create).
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            vacancyId: { type: 'string' },
            matchResultId: { type: ['string', 'null'] },
            status: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const userId = requireUserId(request);
      const body = createApplicationSchema.parse(request.body);

      try {
        const application = await fastify.container.services.applicationCreation.createFromIds({
          userId,
          vacancyId: body.vacancyId,
          matchResultId: body.matchResultId,
          resumeId: body.resumeId,
          workspaceId: await getWorkspaceId(fastify, userId),
        });

        return reply.status(201).send({
          id: application.id,
          vacancyId: application.vacancyId,
          matchResultId: application.matchResultId ?? null,
          status: application.status,
          createdAt: application.createdAt.toISOString(),
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Unique constraint')) {
          const existing = await fastify.container.services.applicationCrm.getOwnedByVacancy(userId, body.vacancyId);
          if (existing) {
            return reply.status(200).send({
              id: existing.id,
              vacancyId: existing.vacancyId,
              matchResultId: existing.matchResultId ?? null,
              status: existing.status,
              createdAt: existing.createdAt.toISOString(),
            });
          }
        }
        throw error;
      }
    },
  });

  fastify.put('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };
    const body = updateApplicationSchema.parse(request.body);

    try {
      const application = await fastify.container.services.applicationCrm.update(params.id, userId, body);
      return reply.send(serializeApplication(application));
    } catch (error) {
      mapCrmError(error);
    }
  });

  fastify.patch('/:id/status', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };
    const body = changeStatusSchema.parse(request.body);

    try {
      const application = await fastify.container.services.applicationCrm.changeStatus(
        params.id,
        userId,
        body.status
      );
      return reply.send(serializeApplication(application));
    } catch (error) {
      mapCrmError(error);
    }
  });

  fastify.post('/:id/notes', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };
    const body = addNoteSchema.parse(request.body);

    try {
      const application = await fastify.container.services.applicationCrm.addNote(
        params.id,
        userId,
        body.content
      );
      return reply.send(serializeApplication(application));
    } catch (error) {
      mapCrmError(error);
    }
  });

  fastify.get('/:id/follow-ups', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };

    try {
      const followUps = await fastify.container.services.applicationCrm.listFollowUps(params.id, userId);
      return reply.send({ followUps: followUps.map(serializeFollowUp) });
    } catch (error) {
      mapCrmError(error);
    }
  });

  fastify.post('/:id/follow-ups', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };
    const body = scheduleFollowUpSchema.parse(request.body);

    try {
      const followUp = await fastify.container.services.applicationCrm.scheduleFollowUp(
        params.id,
        userId,
        new Date(body.date),
        body.message
      );
      return reply.status(201).send(serializeFollowUp(followUp));
    } catch (error) {
      mapCrmError(error);
    }
  });

  fastify.post('/follow-ups/:followUpId/snooze', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { followUpId: string };
    const body = snoozeFollowUpSchema.parse(request.body);

    try {
      const followUp = await fastify.container.services.applicationCrm.snoozeFollowUp(
        params.followUpId,
        userId,
        new Date(body.date)
      );
      return reply.send(serializeFollowUp(followUp));
    } catch (error) {
      mapCrmError(error);
    }
  });

  fastify.post('/follow-ups/:followUpId/complete', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { followUpId: string };

    try {
      const followUp = await fastify.container.services.applicationCrm.completeFollowUp(params.followUpId, userId);
      return reply.send(serializeFollowUp(followUp));
    } catch (error) {
      mapCrmError(error);
    }
  });

  fastify.delete('/follow-ups/:followUpId', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { followUpId: string };

    try {
      const followUp = await fastify.container.services.applicationCrm.cancelFollowUp(params.followUpId, userId);
      return reply.send(serializeFollowUp(followUp));
    } catch (error) {
      mapCrmError(error);
    }
  });

  fastify.post('/:id/recruiter', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };
    const body = assignRecruiterSchema.parse(request.body);
    const workspaceId = await getWorkspaceId(fastify, userId);

    try {
      const application = await fastify.container.services.applicationCrm.assignRecruiter(
        params.id,
        userId,
        body.recruiterId,
        workspaceId
      );
      return reply.send(serializeApplication(application));
    } catch (error) {
      mapCrmError(error);
    }
  });

  fastify.get('/:id/communications', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };

    try {
      const communications = await fastify.container.services.applicationCrm.listCommunications(
        params.id,
        userId
      );
      return reply.send({ communications: communications.map(serializeCommunication) });
    } catch (error) {
      mapCrmError(error);
    }
  });

  fastify.post('/:id/communications', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };
    const body = addCommunicationSchema.parse(request.body);

    try {
      const communication = await fastify.container.services.applicationCrm.addCommunication(
        params.id,
        userId,
        body
      );
      return reply.status(201).send(serializeCommunication(communication));
    } catch (error) {
      mapCrmError(error);
    }
  });

  fastify.get('/:id/interviews', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };

    try {
      const interviews = await fastify.container.services.applicationCrm.listInterviews(params.id, userId);
      return reply.send({ interviews: interviews.map(serializeInterview) });
    } catch (error) {
      mapCrmError(error);
    }
  });

  fastify.post('/:id/interviews', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };
    const body = scheduleInterviewSchema.parse(request.body);

    try {
      const interview = await fastify.container.services.applicationCrm.scheduleInterview(params.id, userId, {
        type: body.type,
        scheduledAt: new Date(body.scheduledAt),
        durationMinutes: body.durationMinutes,
        interviewerName: body.interviewerName,
        interviewerEmail: body.interviewerEmail,
        location: body.location,
        notes: body.notes,
      });
      return reply.status(201).send(serializeInterview(interview));
    } catch (error) {
      mapCrmError(error);
    }
  });

  // Tailor Resume for Application (ADR-031: async pipeline, apps/worker — see TailoringRequestService)
  fastify.post('/:id/tailor-resume', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };
    const body = z.object({ resumeId: z.string().uuid(), forceRegenerate: z.boolean().optional() }).parse(request.body);

    let application: Application;
    try {
      application = await fastify.container.services.applicationCrm.getOwned(params.id, userId);
    } catch (error) {
      mapCrmError(error);
    }
    const vacancyRepo = fastify.container.repositories.vacancy;
    const resumeRepo = fastify.container.repositories.resume;

    const vacancy = await vacancyRepo.findById(createVacancyId(application.vacancyId));
    if (!vacancy) throw new NotFoundError('Vacancy');

    const resume = await resumeRepo.findById(createResumeId(body.resumeId));
    if (!resume) throw new NotFoundError('Resume');
    if (resume.userId !== userId) throw new UnauthorizedError('Not your resume');

    const result = await fastify.container.services.tailoringRequest.requestTailoring({
      userId,
      resumeId: resume.id,
      resumeUpdatedAt: resume.updatedAt,
      vacancyId: vacancy.id,
      vacancyUpdatedAt: vacancy.updatedAt,
      applicationId: application.id,
      forceRegenerate: body.forceRegenerate,
    });

    return reply.send(result);
  });

  // Generate Cover Letter for Application
  fastify.post('/:id/cover-letter', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };
    const body = z.object({ resumeId: z.string().uuid() }).parse(request.body);

    let application: Application;
    try {
      application = await fastify.container.services.applicationCrm.getOwned(params.id, userId);
    } catch (error) {
      mapCrmError(error);
    }
    const vacancyRepo = fastify.container.repositories.vacancy;
    const resumeRepo = fastify.container.repositories.resume;
    const companyRepo = fastify.container.repositories.company;

    const vacancy = await vacancyRepo.findById(createVacancyId(application.vacancyId));
    if (!vacancy) throw new NotFoundError('Vacancy');

    const resume = await resumeRepo.findById(createResumeId(body.resumeId));
    if (!resume) throw new NotFoundError('Resume');
    if (resume.userId !== userId) throw new UnauthorizedError('Not your resume');

    const company = await companyRepo.findById(vacancy.companyId);
    const inputHash = `${vacancy.id}:${resume.id}:${resume.updatedAt.getTime()}`;

    const result = await fastify.container.aiOrchestrator.execute({
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
      await fastify.container.repositories.aiJob.update(result.jobId, {
        vacancyId: vacancy.id,
        applicationId: application.id,
      });
    }

    return reply.send(result);
  });

  // Analyze Vacancy for Application
  fastify.post('/:id/analyze', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };

    let application: Application;
    try {
      application = await fastify.container.services.applicationCrm.getOwned(params.id, userId);
    } catch (error) {
      mapCrmError(error);
    }
    const vacancyRepo = fastify.container.repositories.vacancy;
    const resumeRepo = fastify.container.repositories.resume;
    const companyRepo = fastify.container.repositories.company;
    const searchProfileRepo = fastify.container.repositories.searchProfile;

    const vacancy = await vacancyRepo.findById(createVacancyId(application.vacancyId));
    if (!vacancy) throw new NotFoundError('Vacancy');

    const profile = await searchProfileRepo.findActiveByUserId(createUserId(userId));
    if (!profile) throw new NotFoundError('Active search profile');

    const [resume, company] = await Promise.all([
      resumeRepo.findDefaultByUserId(createUserId(userId)),
      companyRepo.findById(vacancy.companyId),
    ]);

    const inputHash = `${vacancy.id}:${profile.id}:${vacancy.updatedAt.getTime()}`;

    const result = await fastify.container.aiOrchestrator.execute({
      feature: 'analyze_vacancy',
      userId,
      input: {
        vacancyId: vacancy.id,
        vacancyUpdatedAt: vacancy.updatedAt,
        vacancyTitle: vacancy.title,
        vacancyDescription: vacancy.description,
        companyName: company?.name ?? 'Unknown',
        technologies: vacancy.requirements,
        experienceLevel: vacancy.experienceLevel,
        location: vacancy.location.toString(),
        userId,
        searchProfileId: profile.id,
        searchProfileUpdatedAt: profile.updatedAt,
        desiredPositions: profile.desiredPositions,
        desiredTechnologies: profile.desiredTechnologies.map((t) => t.name),
        desiredExperienceLevel: profile.experienceLevel,
        isRemoteOnly: profile.isRemoteOnly,
        desiredLocations: profile.desiredLocations.map((l) => l.toString()),
        resume: resume ? {
          resumeId: resume.id,
          resumeUpdatedAt: resume.updatedAt,
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
      await fastify.container.repositories.aiJob.update(result.jobId, {
        vacancyId: vacancy.id,
        applicationId: application.id,
      });
    }

    return reply.send(result);
  });

  // Interview Prep for Application
  fastify.post('/:id/interview-prep', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };
    const body = z
      .object({
        interviewType: z.enum(['HR', 'TECHNICAL', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'CODING', 'CULTURAL', 'FINAL']),
      })
      .parse(request.body);

    let application: Application;
    try {
      application = await fastify.container.services.applicationCrm.getOwned(params.id, userId);
    } catch (error) {
      mapCrmError(error);
    }
    const vacancyRepo = fastify.container.repositories.vacancy;
    const resumeRepo = fastify.container.repositories.resume;
    const companyRepo = fastify.container.repositories.company;

    const vacancy = await vacancyRepo.findById(createVacancyId(application.vacancyId));
    if (!vacancy) throw new NotFoundError('Vacancy');

    const resume = await resumeRepo.findDefaultByUserId(createUserId(userId));
    const company = await companyRepo.findById(vacancy.companyId);

    const inputHash = `${vacancy.id}:${body.interviewType}:${userId}`;

    const result = await fastify.container.aiOrchestrator.execute({
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
      await fastify.container.repositories.aiJob.update(result.jobId, {
        vacancyId: vacancy.id,
        applicationId: application.id,
      });
    }

    return reply.send(result);
  });
}
