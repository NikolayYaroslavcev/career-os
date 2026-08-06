import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import { applicationRoutes } from '../applications/application-routes.js';
import { errorHandler } from '../../middleware/error-handler.js';
import type { Container } from '../../container.js';

const VALID_RESUME_ID = '11111111-1111-1111-1111-111111111111';

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
        findById: vi.fn().mockResolvedValue({
          id: 'vacancy-1',
          title: 'Senior Engineer',
          description: 'We are looking for a senior engineer',
          companyId: 'company-1',
          requirements: ['React', 'TypeScript'],
          technologies: [{ name: 'React' }, { name: 'TypeScript' }],
          experienceLevel: 'senior',
          location: { toString: () => 'Remote' },
        }),
      },
      resume: {
        findById: vi.fn().mockResolvedValue({
          id: 'resume-1',
          userId: 'user-1',
          title: 'My Resume',
          summary: 'Experienced developer',
          rawText: 'Full resume text',
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          skills: [{ name: 'React' }],
          technologies: [{ name: 'TypeScript' }],
          experience: [{
            company: 'Acme',
            position: 'Developer',
            description: 'Built stuff',
            technologies: [{ name: 'React' }],
          }],
          education: [{
            institution: 'MIT',
            degree: 'BS',
            field: 'CS',
          }],
        }),
      },
      company: {
        findById: vi.fn().mockResolvedValue({
          id: 'company-1',
          name: 'Acme Corp',
          industry: 'Tech',
          size: '100-500',
        }),
      },
      application: {
        findById: vi.fn().mockResolvedValue({
          id: 'app-1',
          userId: 'user-1',
          vacancyId: 'vacancy-1',
          status: 'saved',
        }),
      },
      structuredResume: {
        findByResumeId: vi.fn().mockResolvedValue(null),
      },
      aiJob: {
        update: vi.fn().mockResolvedValue({}),
      },
    },
    services: {
      applicationCrm: {
        getOwned: vi.fn().mockResolvedValue({
          id: 'app-1',
          userId: 'user-1',
          vacancyId: 'vacancy-1',
          status: 'saved',
          resumeId: null,
          matchResultId: null,
          recruiterId: null,
          notes: [],
          startedAt: null,
          submittedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        list: vi.fn().mockResolvedValue({ applications: [], total: 0 }),
        getPipeline: vi.fn().mockResolvedValue([]),
        getOwnedByVacancy: vi.fn().mockResolvedValue(null),
        changeStatus: vi.fn().mockResolvedValue({}),
        addNote: vi.fn().mockResolvedValue({}),
        scheduleFollowUp: vi.fn().mockResolvedValue({}),
        listFollowUps: vi.fn().mockResolvedValue([]),
        snoozeFollowUp: vi.fn().mockResolvedValue({}),
        completeFollowUp: vi.fn().mockResolvedValue({}),
        cancelFollowUp: vi.fn().mockResolvedValue({}),
        assignRecruiter: vi.fn().mockResolvedValue({}),
        listCommunications: vi.fn().mockResolvedValue([]),
        addCommunication: vi.fn().mockResolvedValue({}),
        listInterviews: vi.fn().mockResolvedValue([]),
        scheduleInterview: vi.fn().mockResolvedValue({
          id: 'interview-1',
          applicationId: 'app-1',
          type: 'technical',
          scheduledAt: new Date('2026-02-01T10:00:00.000Z'),
          durationMinutes: 60,
          interviewerName: undefined,
          interviewerEmail: undefined,
          location: undefined,
          notes: 'Bring portfolio examples',
          isCompleted: false,
          feedback: undefined,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      },
      applicationCreation: {
        createFromIds: vi.fn().mockResolvedValue({
          id: 'app-new',
          vacancyId: 'vacancy-1',
          status: 'saved',
          createdAt: new Date(),
        }),
      },
      tailoringRequest: {
        requestTailoring: vi.fn().mockResolvedValue({
          jobId: 'resume-1:vacancy-1',
          status: 'queued',
          currentStage: 'QUEUED',
          cached: false,
        }),
        getStatusById: vi.fn().mockResolvedValue({
          jobId: 'resume-1:vacancy-1',
          status: 'queued',
          currentStage: 'QUEUED',
          cached: false,
        }),
      },
    },
    aiOrchestrator: {
      execute: vi.fn().mockResolvedValue({
        jobId: 'job-123',
        status: 'queued',
      }),
    },
  } as unknown as Container;
}

describe('Application Routes - AI Integration', () => {
  let app: ReturnType<typeof Fastify>;
  let container: ReturnType<typeof createMockContainer>;

  beforeEach(async () => {
    container = createMockContainer();
    app = Fastify();
    app.decorate('container', container);
    app.setErrorHandler(errorHandler);
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-1', email: 'user-1@example.com', role: 'job_seeker' };
    });
    await app.register(applicationRoutes, { prefix: '/api/v1/applications' });
    await app.ready();
  });

  it('POST /:id/tailor-resume enqueues the async tailoring pipeline (ADR-031)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/tailor-resume',
      payload: { resumeId: VALID_RESUME_ID },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.jobId).toBe('resume-1:vacancy-1');
    expect(body.status).toBe('queued');
    expect(container.services.tailoringRequest.requestTailoring).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        resumeId: 'resume-1',
        vacancyId: 'vacancy-1',
        applicationId: 'app-1',
      })
    );
  });

  it('POST /:id/cover-letter creates AI job', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/cover-letter',
      payload: { resumeId: VALID_RESUME_ID },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.jobId).toBe('job-123');
    expect(body.status).toBe('queued');
    expect(container.aiOrchestrator.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'cover_letter',
        userId: 'user-1',
      })
    );
  });

  it('POST /:id/tailor-resume returns 401 for unauthenticated user', async () => {
    const unauthApp = Fastify();
    unauthApp.decorate('container', container as unknown as Container);
    unauthApp.setErrorHandler(errorHandler);
    await unauthApp.register(applicationRoutes, { prefix: '/api/v1/applications' });
    await unauthApp.ready();

    const response = await unauthApp.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/tailor-resume',
      payload: { resumeId: VALID_RESUME_ID },
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /:id/cover-letter returns 401 for unauthenticated user', async () => {
    const unauthApp = Fastify();
    unauthApp.decorate('container', container as unknown as Container);
    unauthApp.setErrorHandler(errorHandler);
    await unauthApp.register(applicationRoutes, { prefix: '/api/v1/applications' });
    await unauthApp.ready();

    const response = await unauthApp.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/cover-letter',
      payload: { resumeId: VALID_RESUME_ID },
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /:id/tailor-resume validates resumeId is required', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/tailor-resume',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /:id/cover-letter validates resumeId is required', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/cover-letter',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /:id/tailor-resume validates resumeId format', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/tailor-resume',
      payload: { resumeId: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /:id/cover-letter validates resumeId format', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/cover-letter',
      payload: { resumeId: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
  });

  // Regression guard: the dashboard's ScheduleInterviewInput/Interview types (api/applications.ts)
  // include `notes`, but the backend used to accept it in the request, silently strip it (zod
  // schema had no `notes` field), and never persist or return it — user-entered interview notes
  // were dropped with no error. This asserts `notes` actually reaches the service call.
  it('POST /:id/interviews forwards notes to the CRM service instead of silently dropping them', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/interviews',
      payload: {
        type: 'technical',
        scheduledAt: '2026-02-01T10:00:00.000Z',
        notes: 'Bring portfolio examples',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(container.services.applicationCrm.scheduleInterview).toHaveBeenCalledWith(
      'app-1',
      'user-1',
      expect.objectContaining({ notes: 'Bring portfolio examples' })
    );
    const body = JSON.parse(response.payload);
    expect(body.notes).toBe('Bring portfolio examples');
  });
});
