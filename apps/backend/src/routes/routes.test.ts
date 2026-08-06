import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

const { mockAuthService } = vi.hoisted(() => ({
  mockAuthService: {
    register: vi.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh',
      user: { id: 'user-id', email: 'test@example.com' },
    }),
    login: vi.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh',
      user: { id: 'user-id', email: 'test@example.com' },
    }),
    refresh: vi.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh',
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    logoutAll: vi.fn().mockResolvedValue(undefined),
    getUserById: vi.fn().mockResolvedValue({
      id: 'user-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
    }),
    updateProfile: vi.fn().mockResolvedValue({
      id: 'user-id',
      email: 'test@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    }),
  },
}));

const mockAuthProvider = vi.hoisted(() => ({
  hashPassword: vi.fn().mockResolvedValue('$argon2id$testhash'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  generateAccessToken: vi.fn().mockReturnValue('mock-access-token'),
  verifyAccessToken: vi.fn().mockImplementation((token: string) => {
    if (token === 'valid-token') {
      return { sub: 'user-id', email: 'test@example.com', iat: 0, exp: 999999999 };
    }
    return null;
  }),
  generateRefreshToken: vi.fn().mockResolvedValue({
    id: 'refresh-id',
    userId: 'user-id',
    token: 'mock-refresh',
    expiresAt: new Date(),
    createdAt: new Date(),
  }),
  verifyRefreshToken: vi.fn().mockResolvedValue(null),
  revokeRefreshToken: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
}));

vi.mock('../container.js', () => ({
  buildContainer: vi.fn().mockReturnValue({
    repositories: {
      user: {
        findById: vi.fn().mockResolvedValue({ id: 'user-id', workspaceIds: ['workspace-id'] }),
      },
      resume: {},
      vacancy: {
        findMany: vi.fn().mockResolvedValue({ vacancies: [], total: 0 }),
        findById: vi.fn().mockResolvedValue(null),
        findByIdForWorkspace: vi.fn().mockResolvedValue(null),
      },
      company: {
        findById: vi.fn().mockResolvedValue(null),
        findByIdForWorkspace: vi.fn().mockResolvedValue(null),
      },
      application: {},
      recruiter: {},
      communication: {},
      interview: {},
      searchProfile: {},
      matchResult: {},
      notificationHistory: {},
      telegramConnection: {},
      telegramLinkingToken: {},
      workspace: {},
      refreshToken: {},
      aiJob: {
        update: vi.fn().mockResolvedValue(undefined),
        findByUserId: vi.fn().mockResolvedValue([]),
        findById: vi.fn().mockResolvedValue(null),
      },
    },
    authProvider: mockAuthProvider,
    providerRegistry: { getProvider: vi.fn(), getAll: vi.fn().mockReturnValue([{}]) },
    aiProvider: { validateConfig: vi.fn().mockReturnValue(true) },
    aiOrchestrator: {
      execute: vi.fn().mockResolvedValue({ jobId: '', status: 'failed', cached: false }),
      getJobStatus: vi.fn().mockResolvedValue(null),
      getUserJobs: vi.fn().mockResolvedValue([]),
    },
    applicationService: {},
    services: {
      auth: mockAuthService,
      workspace: {
        listForUser: vi.fn().mockResolvedValue([{ id: 'workspace-id', name: 'Test Workspace', role: 'OWNER' }]),
        create: vi.fn().mockResolvedValue({ id: 'workspace-id', name: 'Test Workspace', role: 'OWNER' }),
        inviteMember: vi.fn().mockResolvedValue(undefined),
        updateMemberRole: vi.fn().mockResolvedValue(undefined),
      },
      searchProfile: {},
      providerSearch: {},
      aiMatching: {},
      recommendation: {},
      applicationCreation: {},
      applicationCrm: {
        list: vi.fn().mockResolvedValue({ applications: [], total: 0 }),
        getPipeline: vi.fn().mockResolvedValue([]),
      },
      followUp: {
        findByUserId: vi.fn().mockResolvedValue([]),
        listEnrichedForUser: vi.fn().mockResolvedValue([]),
        schedule: vi.fn(),
        snooze: vi.fn(),
        complete: vi.fn(),
        cancel: vi.fn(),
      },
      recruiter: {},
      intelligenceWorkflow: {},
      morningDigest: {},
      digestDelivery: {},
      digestScheduler: {},
      telegramLinking: {},
      careerIntelligence: {},
      resumeVersionIntelligence: {},
      tailoringRequest: {
        requestTailoring: vi.fn().mockResolvedValue({ jobId: '', status: 'queued', currentStage: 'QUEUED', cached: false }),
        getStatusById: vi.fn().mockResolvedValue({ jobId: '', status: 'queued', currentStage: 'QUEUED', cached: false }),
      },
    },
  }),
}));

vi.mock('@careeros/database', () => ({
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  prisma: {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
  },
  PrismaUserRepository: vi.fn(),
  PrismaResumeRepository: vi.fn(),
  PrismaVacancyRepository: vi.fn(),
  PrismaCompanyRepository: vi.fn(),
  PrismaApplicationRepository: vi.fn(),
  PrismaRecruiterRepository: vi.fn(),
  PrismaCommunicationRepository: vi.fn(),
  PrismaInterviewRepository: vi.fn(),
  PrismaSearchProfileRepository: vi.fn(),
  PrismaMatchResultRepository: vi.fn(),
  PrismaNotificationHistoryRepository: vi.fn(),
  PrismaTelegramConnectionRepository: vi.fn(),
  PrismaTelegramLinkingTokenRepository: vi.fn(),
  PrismaWorkspaceRepository: vi.fn(),
  PrismaRefreshTokenRepository: vi.fn(),
}));

vi.mock('@careeros/telegram', () => ({
  InMemoryTelegramClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
  TelegramAdapter: vi.fn(),
  registerTelegramLinkingBot: vi.fn(),
}));

vi.mock('@careeros/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@careeros/shared')>();
  return {
    ...original,
    loadConfig: vi.fn().mockReturnValue({
      NODE_ENV: 'test',
      PORT: 3000,
      HOST: '0.0.0.0',
      LOG_LEVEL: 'info',
      CORS_ORIGIN: 'http://localhost:3000',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: 9000,
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin',
      MINIO_BUCKET: 'careeros',
      MINIO_USE_SSL: false,
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      EMAIL_FROM: 'CareerOS <noreply@careeros.local>',
      JWT_SECRET: 'test-secret-key-at-least-32-characters-long',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      ARGON2_MEMORY_COST: 65536,
      ARGON2_TIME_COST: 3,
      ARGON2_PARALLELISM: 4,
      AI_ENABLED: true,
      AI_PROVIDER: 'openai',
    }),
    checkRedisHealth: vi.fn().mockResolvedValue(true),
    getRedis: vi.fn().mockReturnValue({
      ping: vi.fn().mockResolvedValue('PONG'),
      set: vi.fn().mockResolvedValue('OK'),
      // @fastify/rate-limit's RedisStore skips defineCommand() and calls this
      // directly when the client already exposes it — always allow (1 request,
      // full time window remaining) so tests never hit a simulated 429.
      rateLimit: vi.fn((_key: string, timeWindow: number, _max: number, _continueExceeding: boolean, _exponentialBackoff: boolean, cb: (err: null, result: [number, number]) => void) => {
        cb(null, [1, timeWindow]);
      }),
    }),
    runHealthChecks: vi.fn().mockResolvedValue({
      status: 'healthy',
      checks: {},
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
  };
});

vi.mock('@careeros/auth', () => ({
  createAuthProvider: vi.fn().mockReturnValue(mockAuthProvider),
}));

import { buildApp } from '../app.js';

describe('API Routes', () => {
  let app: FastifyInstance;
  const originalEnv = process.env;

  beforeAll(async () => {
    process.env = { ...originalEnv };
    process.env.MASTER_ENCRYPTION_KEY = 'a'.repeat(64);
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    process.env = originalEnv;
  });

  describe('Health endpoints', () => {
    it('GET /health should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('status');
    });

    it('GET /live should return alive status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/live',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({ status: 'alive' });
    });
  });

  describe('Auth endpoints (public)', () => {
    it('POST /api/v1/auth/register should validate input', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'short',
          firstName: '',
          lastName: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('POST /api/v1/auth/login should validate input', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'invalid-email',
          password: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('POST /api/v1/auth/register should not require auth', async () => {
      mockAuthService.register.mockResolvedValueOnce({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh',
        user: { id: 'user-id', email: 'test@example.com' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('POST /api/v1/auth/login should not require auth', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh',
        user: { id: 'user-id', email: 'test@example.com' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('POST /api/v1/auth/logout should not require auth and revokes the given refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: { refreshToken: 'some-refresh-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({ success: true });
      expect(mockAuthService.logout).toHaveBeenCalledWith('some-refresh-token');
    });

    it('POST /api/v1/auth/logout should validate input', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('POST /api/v1/auth/logout-all should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
      });

      expect(response.statusCode).toBe(401);
    });

    it('POST /api/v1/auth/logout-all should revoke all of the authenticated user\'s refresh tokens', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({ success: true });
      expect(mockAuthService.logoutAll).toHaveBeenCalledWith('user-id');
    });
  });

  describe('User endpoints (protected)', () => {
    it('GET /api/v1/users/me should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/users/me should accept valid token', async () => {
      mockAuthService.getUserById.mockResolvedValueOnce({
        id: 'user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('PUT /api/v1/users/me should apply the submitted profile changes', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/users/me',
        headers: {
          authorization: 'Bearer valid-token',
        },
        payload: { firstName: 'Jane', lastName: 'Doe' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.firstName).toBe('Jane');
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith('user-id', { firstName: 'Jane', lastName: 'Doe' });
    });

    it('PUT /api/v1/users/me should require authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/users/me',
        payload: { firstName: 'Jane' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('PUT /api/v1/users/me should reject an empty firstName', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/users/me',
        headers: {
          authorization: 'Bearer valid-token',
        },
        payload: { firstName: '' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('PUT /api/v1/users/me should accept a partial update with only firstName', async () => {
      mockAuthService.updateProfile.mockResolvedValueOnce({
        id: 'user-id',
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/users/me',
        headers: {
          authorization: 'Bearer valid-token',
        },
        payload: { firstName: 'Jane' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith('user-id', { firstName: 'Jane' });
    });
  });

  describe('Workspace endpoints (protected)', () => {
    it('GET /api/v1/workspaces should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/workspaces',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/workspaces should accept valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/workspaces',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Vacancy endpoints (protected)', () => {
    it('GET /api/v1/vacancies should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/vacancies',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/vacancies should accept valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/vacancies',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('vacancies');
      expect(body).toHaveProperty('total');
    });
  });

  describe('Application endpoints (protected)', () => {
    it('GET /api/v1/applications should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/applications',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/applications should accept valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/applications',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /api/v1/applications/pipeline should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/applications/pipeline',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/applications/pipeline should return grouped applications', async () => {
      const container = (app as unknown as { container: { services: Record<string, unknown> } })
        .container;
      container.services.applicationCrm = {
        getPipeline: async (): Promise<{ status: string; count: number; applications: unknown[] }[]> => [{ status: 'saved', count: 1, applications: [] }],
      };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/applications/pipeline',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.pipeline).toEqual([{ status: 'saved', count: 1, applications: [] }]);
    });

    it('PATCH /api/v1/applications/:id/status should map an invalid transition to 409', async () => {
      const { InvalidStatusTransitionError } = await import(
        '../services/application-crm-service.js'
      );
      const container = (app as unknown as { container: { services: Record<string, unknown> } })
        .container;
      container.services.applicationCrm = {
        changeStatus: async (): Promise<never> => {
          throw new InvalidStatusTransitionError('Invalid status transition from applied to saved');
        },
      };

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/applications/test-id/status',
        payload: { status: 'saved' },
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(409);
    });

    it('GET /api/v1/applications/:id should map a not-found application to 404', async () => {
      const { ApplicationNotFoundError } = await import('../services/application-crm-service.js');
      const container = (app as unknown as { container: { services: Record<string, unknown> } })
        .container;
      container.services.applicationCrm = {
        getOwned: async (): Promise<never> => {
          throw new ApplicationNotFoundError('test-id');
        },
      };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/applications/test-id',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('PUT /api/v1/applications/:id should ignore a resumeId in the body and only forward notes', async () => {
      const container = (app as unknown as { container: { services: Record<string, unknown> } })
        .container;
      let receivedInput: unknown;
      container.services.applicationCrm = {
        update: async (id: string, userId: string, input: unknown): Promise<{
          id: string;
          userId: string;
          vacancyId: string;
          resumeId: string;
          matchResultId: null;
          recruiterId: null;
          status: string;
          notes: unknown[];
          appliedAt: null;
          createdAt: Date;
          updatedAt: Date;
        }> => {
          receivedInput = input;
          return {
            id,
            userId,
            vacancyId: 'vacancy-1',
            resumeId: 'original-resume-id',
            matchResultId: null,
            recruiterId: null,
            status: 'saved',
            notes: [],
            appliedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
      };

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/applications/test-id',
        payload: { resumeId: '11111111-1111-4111-8111-111111111111', notes: 'Sent follow-up email' },
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(receivedInput).toEqual({ notes: 'Sent follow-up email' });
      const body = JSON.parse(response.payload);
      expect(body.resumeId).toBe('original-resume-id');
    });

    it('DELETE /api/v1/applications/:id should not exist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/applications/test-id',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('PATCH /api/v1/applications/:id/status should require auth', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/applications/test-id/status',
        payload: { status: 'applied' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('POST /api/v1/applications/:id/interviews should require auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/applications/test-id/interviews',
        payload: {
          type: 'technical',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Follow-up aggregate endpoints (protected)', () => {
    it('GET /api/v1/follow-ups should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/follow-ups',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/follow-ups should bucket enriched follow-ups into overdue/today/upcoming/completed', async () => {
      const container = (app as unknown as { container: { services: Record<string, unknown> } }).container;
      const now = Date.now();
      container.services.followUp = {
        listEnrichedForUser: async (): Promise<{
          id: string;
          applicationId: string;
          type: string;
          status: string;
          scheduledAt: Date;
          message: string | null;
          vacancyTitle: string;
          companyName: string;
          daysSinceApplied: number | null;
        }[]> => [
          { id: 'f-overdue', applicationId: 'a-1', type: 'follow_up', status: 'pending', scheduledAt: new Date(now - 2 * 86_400_000), message: null, vacancyTitle: 'A', companyName: 'Acme', daysSinceApplied: 9 },
          { id: 'f-today', applicationId: 'a-2', type: 'interview', status: 'pending', scheduledAt: new Date(now + 60_000), message: null, vacancyTitle: 'B', companyName: 'Beta', daysSinceApplied: null },
          { id: 'f-upcoming', applicationId: 'a-3', type: 'follow_up', status: 'snoozed', scheduledAt: new Date(now + 3 * 86_400_000), message: null, vacancyTitle: 'C', companyName: 'Gamma', daysSinceApplied: 3 },
          { id: 'f-done', applicationId: 'a-4', type: 'follow_up', status: 'completed', scheduledAt: new Date(now - 86_400_000), message: null, vacancyTitle: 'D', companyName: 'Delta', daysSinceApplied: 10 },
          { id: 'f-cancelled', applicationId: 'a-5', type: 'follow_up', status: 'cancelled', scheduledAt: new Date(now - 86_400_000), message: null, vacancyTitle: 'E', companyName: 'Epsilon', daysSinceApplied: 10 },
        ],
      };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/follow-ups',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.overdue.map((f: { id: string }) => f.id)).toEqual(['f-overdue']);
      expect(body.today.map((f: { id: string }) => f.id)).toEqual(['f-today']);
      expect(body.upcoming.map((f: { id: string }) => f.id)).toEqual(['f-upcoming']);
      expect(body.completed.map((f: { id: string }) => f.id)).toEqual(['f-done']);
    });

    it('POST /api/v1/follow-ups should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/follow-ups',
        payload: { applicationId: 'a-1', date: new Date(Date.now() + 86_400_000).toISOString() },
      });

      expect(response.statusCode).toBe(401);
    });

    it('POST /api/v1/follow-ups should delegate to FollowUpService.schedule and return 201', async () => {
      const container = (app as unknown as { container: { services: Record<string, unknown> } }).container;
      const schedule = async (applicationId: string, userId: string, date: Date, message?: string, type?: string): Promise<{
        id: string;
        applicationId: string;
        type: string | null;
        status: string;
        scheduledAt: Date;
        message: string | null;
      }> => ({
        id: 'f-new',
        applicationId,
        type: type ?? null,
        status: 'pending',
        scheduledAt: date,
        message: message ?? null,
      });
      const enrich = vi.fn().mockImplementation(async (followUp: { applicationId: string; type: string | null }) => ({
        ...followUp,
        id: 'f-new',
        status: 'pending',
        scheduledAt: new Date(),
        message: null,
        vacancyTitle: 'Senior Engineer',
        companyName: 'Acme Corp',
        daysSinceApplied: 0,
      }));
      container.services.followUp = { schedule, enrich };

      const applicationId = '11111111-1111-4111-8111-111111111111';
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/follow-ups',
        payload: { applicationId, date: new Date(Date.now() + 86_400_000).toISOString(), type: 'custom' },
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.applicationId).toBe(applicationId);
      expect(body.type).toBe('custom');
      // Contract guard: create must return the same enriched shape the list endpoint does.
      expect(body.vacancyTitle).toBe('Senior Engineer');
      expect(body.companyName).toBe('Acme Corp');
    });

    it('DELETE /api/v1/follow-ups/:id should delegate to FollowUpService.cancel and return 204', async () => {
      const container = (app as unknown as { container: { services: Record<string, unknown> } }).container;
      const cancel = vi.fn().mockResolvedValue({ id: 'f-1' });
      container.services.followUp = { cancel };

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/follow-ups/f-1',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(204);
      expect(cancel).toHaveBeenCalledWith('f-1', 'user-id');
    });

    it('POST /api/v1/follow-ups/:id/complete should delegate to FollowUpService.complete', async () => {
      const container = (app as unknown as { container: { services: Record<string, unknown> } }).container;
      const complete = vi.fn().mockResolvedValue({
        id: 'f-1',
        applicationId: 'a-1',
        type: null,
        status: 'completed',
        scheduledAt: new Date(),
        message: null,
      });
      const enrich = vi.fn().mockImplementation(async (followUp: { id: string; applicationId: string; status: string }) => ({
        ...followUp,
        type: null,
        scheduledAt: new Date(),
        message: null,
        vacancyTitle: 'Senior Engineer',
        companyName: 'Acme Corp',
        daysSinceApplied: 3,
      }));
      container.services.followUp = { complete, enrich };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/follow-ups/f-1/complete',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('completed');
      expect(complete).toHaveBeenCalledWith('f-1', 'user-id');
    });
  });

  describe('Recruiter endpoints (protected)', () => {
    it('GET /api/v1/recruiters should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/recruiters',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/recruiters should list recruiters for the caller workspace', async () => {
      const container = (
        app as unknown as { container: { repositories: Record<string, unknown>; services: Record<string, unknown> } }
      ).container;
      container.repositories.user = {
        findById: async (): Promise<{ workspaceIds: string[] }> => ({ workspaceIds: ['workspace-1'] }),
      };
      container.services.recruiter = {
        listByWorkspace: async (): Promise<unknown[]> => [],
      };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/recruiters',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({ recruiters: [] });
    });

    it('POST /api/v1/recruiters should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/recruiters',
        payload: { name: 'Jane Doe' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Resume endpoints (protected)', () => {
    it('GET /api/v1/resumes should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resumes',
      });

      expect(response.statusCode).toBe(401);
    });

    it('POST /api/v1/resumes/:id/search-profile-suggestion should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/resumes/test-id/search-profile-suggestion',
      });

      expect(response.statusCode).toBe(401);
    });

    it('PATCH /api/v1/resumes/:id should update version metadata and return the serialized resume', async () => {
      const updateVersionMetadata = vi.fn().mockResolvedValue({
        id: 'resume-1',
        title: 'React EN',
        summary: '',
        description: 'Tailored for React roles',
        language: 'English',
        tags: ['Frontend', 'React'],
        status: 'active',
        skills: [],
        technologies: [],
        format: 'pdf',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-id',
      });
      const container = (app as unknown as { container: { services: Record<string, unknown> } }).container;
      container.services.resume = { updateVersionMetadata };

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/resumes/resume-1',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        payload: { description: 'Tailored for React roles', language: 'English', tags: ['Frontend', 'React'] },
      });

      expect(response.statusCode).toBe(200);
      expect(updateVersionMetadata).toHaveBeenCalledWith('resume-1', 'user-id', {
        description: 'Tailored for React roles',
        language: 'English',
        tags: ['Frontend', 'React'],
      });
      const body = JSON.parse(response.payload);
      expect(body.tags).toEqual(['Frontend', 'React']);
      expect(body.status).toBe('active');
    });

    it('PATCH /api/v1/resumes/:id should require authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/resumes/resume-1',
        payload: { title: 'X' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Telegram endpoints (protected)', () => {
    it('POST /api/v1/telegram/link-code should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/telegram/link-code',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/telegram/connection should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/telegram/connection',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Intelligence endpoints (protected)', () => {
    it('POST /api/v1/intelligence/search should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/intelligence/search',
      });

      expect(response.statusCode).toBe(401);
    });

    it('POST /api/v1/intelligence/search should return NO_ACTIVE_SEARCH_PROFILE when no profile exists', async () => {
      const { NoActiveSearchProfileError } = await import(
        '../services/intelligence-workflow-service.js'
      );
      const mockRun = vi.fn().mockRejectedValue(new NoActiveSearchProfileError('user-id'));

      const container = (app as unknown as { container: { services: Record<string, unknown> } })
        .container;
      container.services.intelligenceWorkflow = { run: mockRun };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/intelligence/search',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('NO_ACTIVE_SEARCH_PROFILE');
      expect(body.error.message).toBe('Create your search profile before finding vacancies');
    });
  });

  describe('Career Intelligence routes (protected)', () => {
    it('GET /api/v1/career-intelligence/overview should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/overview',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/career-intelligence/overview should return overview data with default period', async () => {
      const getOverview = vi.fn().mockResolvedValue({ applicationsSent: 5, offers: 1 });
      const container = (app as unknown as { container: { services: Record<string, unknown> } })
        .container;
      container.services.careerIntelligence = { getOverview };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/overview',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(getOverview).toHaveBeenCalledWith('user-id', 'all');
      const body = JSON.parse(response.payload);
      expect(body).toEqual({ applicationsSent: 5, offers: 1 });
    });

    it('GET /api/v1/career-intelligence/funnel should forward the period query param', async () => {
      const getFunnel = vi.fn().mockResolvedValue({ stages: [] });
      const container = (app as unknown as { container: { services: Record<string, unknown> } })
        .container;
      container.services.careerIntelligence = { getFunnel };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/funnel?period=30d',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(getFunnel).toHaveBeenCalledWith('user-id', '30d');
    });

    it('GET /api/v1/career-intelligence/funnel should reject an invalid period', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/funnel?period=not-a-period',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('GET /api/v1/career-intelligence/insights should return computed insights', async () => {
      const getInsights = vi.fn().mockResolvedValue({ insights: [], generatedAt: new Date().toISOString() });
      const container = (app as unknown as { container: { services: Record<string, unknown> } })
        .container;
      container.services.careerIntelligence = { getInsights };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/insights',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(getInsights).toHaveBeenCalledWith('user-id', 'all');
    });

    it('POST /api/v1/career-intelligence/refresh should force-recompute insights', async () => {
      const refreshInsights = vi.fn().mockResolvedValue({ insights: [] });
      const container = (app as unknown as { container: { services: Record<string, unknown> } })
        .container;
      container.services.careerIntelligence = { refreshInsights };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/career-intelligence/refresh',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(refreshInsights).toHaveBeenCalledWith('user-id', 'all');
    });

    it('GET /api/v1/career-intelligence/performance-breakdowns should wrap the result in a breakdowns key', async () => {
      const getPerformanceBreakdowns = vi.fn().mockResolvedValue([{ dimension: 'country', segments: [] }]);
      const container = (app as unknown as { container: { services: Record<string, unknown> } })
        .container;
      container.services.careerIntelligence = { getPerformanceBreakdowns };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/performance-breakdowns',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.breakdowns).toEqual([{ dimension: 'country', segments: [] }]);
    });
  });

  describe('Resume Version Intelligence routes (protected)', () => {
    it('GET /api/v1/career-intelligence/resume-versions should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/resume-versions',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/career-intelligence/resume-versions should list versions with parsed criteria', async () => {
      const listVersions = vi.fn().mockResolvedValue([
        { id: 'resume-1', title: 'React EN', description: '', language: 'English', tags: ['React'], status: 'active', createdAt: new Date(), updatedAt: new Date() },
      ]);
      const container = (app as unknown as { container: { services: Record<string, unknown> } }).container;
      container.services.resumeVersionIntelligence = { listVersions };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/resume-versions?status=active&tag=React',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(listVersions).toHaveBeenCalledWith('user-id', { status: 'active', tag: 'React' });
      const body = JSON.parse(response.payload);
      expect(body.total).toBe(1);
      expect(body.versions[0].id).toBe('resume-1');
    });

    it('GET /api/v1/career-intelligence/resume-versions/performance should return all versions performance', async () => {
      const getAllVersionsPerformance = vi.fn().mockResolvedValue([{ resumeId: 'resume-1', applications: 5 }]);
      const container = (app as unknown as { container: { services: Record<string, unknown> } }).container;
      container.services.resumeVersionIntelligence = { getAllVersionsPerformance };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/resume-versions/performance',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(getAllVersionsPerformance).toHaveBeenCalledWith('user-id', 'all');
      const body = JSON.parse(response.payload);
      expect(body.performance).toEqual([{ resumeId: 'resume-1', applications: 5 }]);
    });

    it('GET /api/v1/career-intelligence/resume-versions/:id should return 404 when not found or not owned', async () => {
      const getVersion = vi.fn().mockResolvedValue(null);
      const container = (app as unknown as { container: { services: Record<string, unknown> } }).container;
      container.services.resumeVersionIntelligence = { getVersion };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/resume-versions/missing-id',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('GET /api/v1/career-intelligence/resume-versions/:id/performance should combine performance, breakdowns and insights', async () => {
      const resume = { id: 'resume-1', title: 'React EN', description: '', tags: [], status: 'active', createdAt: new Date(), updatedAt: new Date() };
      const getVersion = vi.fn().mockResolvedValue(resume);
      const getVersionPerformance = vi.fn().mockResolvedValue({ resumeId: 'resume-1', applications: 5 });
      const getVersionBreakdowns = vi.fn().mockResolvedValue([{ dimension: 'country', segments: [] }]);
      const getVersionInsights = vi.fn().mockResolvedValue({ insights: [] });
      const container = (app as unknown as { container: { services: Record<string, unknown> } }).container;
      container.services.resumeVersionIntelligence = { getVersion, getVersionPerformance, getVersionBreakdowns, getVersionInsights };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/resume-versions/resume-1/performance?period=30d',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(getVersionPerformance).toHaveBeenCalledWith('user-id', 'resume-1', '30d');
      expect(getVersionBreakdowns).toHaveBeenCalledWith('user-id', 'resume-1', '30d');
      expect(getVersionInsights).toHaveBeenCalledWith('user-id', 'resume-1', '30d');
      const body = JSON.parse(response.payload);
      expect(body.performance).toEqual({ resumeId: 'resume-1', applications: 5 });
      expect(body.breakdowns).toEqual([{ dimension: 'country', segments: [] }]);
      expect(body.insights).toEqual({ insights: [] });
    });

    it('GET /api/v1/career-intelligence/resume-compare should return the comparison when both versions are owned', async () => {
      const resumeA = { id: 'resume-a', title: 'A' };
      const resumeB = { id: 'resume-b', title: 'B' };
      const getVersion = vi.fn().mockImplementation((_userId: string, id: string) => Promise.resolve(id === 'resume-a' ? resumeA : id === 'resume-b' ? resumeB : null));
      const compareVersions = vi.fn().mockResolvedValue({ overallWinner: 'A' });
      const container = (app as unknown as { container: { services: Record<string, unknown> } }).container;
      container.services.resumeVersionIntelligence = { getVersion, compareVersions };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/resume-compare?resumeIdA=resume-a&resumeIdB=resume-b',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(compareVersions).toHaveBeenCalledWith('user-id', 'resume-a', 'resume-b', 'all');
      const body = JSON.parse(response.payload);
      expect(body).toEqual({ overallWinner: 'A' });
    });

    it('GET /api/v1/career-intelligence/resume-compare should 404 when a version is not owned', async () => {
      const getVersion = vi.fn().mockResolvedValue(null);
      const compareVersions = vi.fn();
      const container = (app as unknown as { container: { services: Record<string, unknown> } }).container;
      container.services.resumeVersionIntelligence = { getVersion, compareVersions };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/resume-compare?resumeIdA=resume-a&resumeIdB=resume-b',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
      expect(compareVersions).not.toHaveBeenCalled();
    });

    it('GET /api/v1/career-intelligence/resume-recommendation/:vacancyId should return the recommendation', async () => {
      const recommendForVacancy = vi.fn().mockResolvedValue({ vacancyId: 'vacancy-1', recommendedResumeId: 'resume-a' });
      const container = (app as unknown as { container: { services: Record<string, unknown> } }).container;
      container.services.resumeVersionIntelligence = { recommendForVacancy };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/resume-recommendation/vacancy-1',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(recommendForVacancy).toHaveBeenCalledWith('user-id', 'vacancy-1');
      const body = JSON.parse(response.payload);
      expect(body.recommendedResumeId).toBe('resume-a');
    });

    it('GET /api/v1/career-intelligence/resume-recommendation/:vacancyId should 404 when the vacancy is not found', async () => {
      const { VacancyNotFoundError } = await import('../services/resume-version-intelligence-service.js');
      const recommendForVacancy = vi.fn().mockRejectedValue(new VacancyNotFoundError('missing-vacancy'));
      const container = (app as unknown as { container: { services: Record<string, unknown> } }).container;
      container.services.resumeVersionIntelligence = { recommendForVacancy };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/career-intelligence/resume-recommendation/missing-vacancy',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('AI action routes (protected)', () => {
    const VACANCY_ID = '11111111-1111-4111-8111-111111111111';
    const RESUME_ID = '22222222-2222-4222-8222-222222222222';
    const APP_ID = '33333333-3333-4333-8333-333333333333';
    const APP_ID_2 = '44444444-4444-4444-8444-444444444444';

    const vacancyFixture = {
      id: VACANCY_ID,
      title: 'Senior Engineer',
      description: 'Build things',
      requirements: ['TypeScript'],
      technologies: [{ name: 'TypeScript' }],
      experienceLevel: 'senior',
      companyId: 'company-1',
      location: { toString: (): string => 'Remote' },
      updatedAt: new Date('2026-01-01'),
    };

    const resumeFixture = {
      id: RESUME_ID,
      userId: 'user-id',
      rawText: 'Resume text',
      summary: 'Summary',
      skills: [{ name: 'TypeScript' }],
      technologies: [{ name: 'TypeScript' }],
      experience: [],
      education: [],
      updatedAt: new Date('2026-01-01'),
    };

    it('POST /api/v1/ai/analyze-vacancy should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/ai/analyze-vacancy',
        payload: { vacancyId: VACANCY_ID, searchProfileId: RESUME_ID },
      });

      expect(response.statusCode).toBe(401);
    });

    it('POST /api/v1/applications/:id/tailor-resume should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/applications/${APP_ID}/tailor-resume`,
        payload: { resumeId: RESUME_ID },
      });

      expect(response.statusCode).toBe(401);
    });

    it('POST /api/v1/applications/:id/tailor-resume should enqueue the async tailoring pipeline (ADR-031)', async () => {
      const container = (
        app as unknown as {
          container: {
            repositories: {
              vacancy: { findById: ReturnType<typeof vi.fn> };
              resume: { findById: ReturnType<typeof vi.fn> };
            };
            services: {
              applicationCrm: { getOwned: ReturnType<typeof vi.fn> };
              tailoringRequest: { requestTailoring: ReturnType<typeof vi.fn> };
            };
          };
        }
      ).container;

      container.services.applicationCrm.getOwned = vi.fn().mockResolvedValue({
        id: APP_ID,
        vacancyId: VACANCY_ID,
        userId: 'user-id',
      });
      container.repositories.vacancy.findById = vi.fn().mockResolvedValue(vacancyFixture);
      container.repositories.resume.findById = vi.fn().mockResolvedValue(resumeFixture);
      container.services.tailoringRequest.requestTailoring = vi.fn().mockResolvedValue({
        jobId: `${RESUME_ID}:${VACANCY_ID}`,
        status: 'queued',
        currentStage: 'QUEUED',
        cached: false,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/applications/${APP_ID}/tailor-resume`,
        headers: { authorization: 'Bearer valid-token' },
        payload: { resumeId: RESUME_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('queued');
      expect(body.jobId).toBe(`${RESUME_ID}:${VACANCY_ID}`);
      expect(container.services.tailoringRequest.requestTailoring).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-id',
          resumeId: RESUME_ID,
          vacancyId: VACANCY_ID,
          applicationId: APP_ID,
        })
      );
    });

    it('GET /api/v1/ai/jobs should list AIJob history for a vacancy (cover-letter/analyze-vacancy features)', async () => {
      const container = (
        app as unknown as { container: { repositories: { aiJob: { findByUserId: ReturnType<typeof vi.fn> } } } }
      ).container;

      container.repositories.aiJob.findByUserId = vi.fn().mockResolvedValue([
        {
          id: 'job-1',
          feature: 'cover_letter',
          status: 'COMPLETED',
          result: { coverLetter: 'Dear hiring manager...' },
          vacancyId: VACANCY_ID,
          createdAt: new Date('2026-01-01'),
        },
      ]);

      const historyResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/ai/jobs?vacancyId=${VACANCY_ID}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(historyResponse.statusCode).toBe(200);
      expect(container.repositories.aiJob.findByUserId).toHaveBeenCalledWith(
        'user-id',
        expect.objectContaining({ vacancyId: VACANCY_ID })
      );
      const historyBody = JSON.parse(historyResponse.payload);
      expect(historyBody.jobs).toHaveLength(1);
      expect(historyBody.jobs[0].result.coverLetter).toBe('Dear hiring manager...');
    });

    it('POST /api/v1/applications/:id/tailor-resume should reject a caller who does not own the application', async () => {
      const { ApplicationNotAuthorizedError } = await import('../services/application-crm-service.js');
      const container = (
        app as unknown as { container: { services: { applicationCrm: { getOwned: ReturnType<typeof vi.fn> } } } }
      ).container;
      container.services.applicationCrm.getOwned = vi.fn().mockRejectedValue(new ApplicationNotAuthorizedError(APP_ID_2));

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/applications/${APP_ID_2}/tailor-resume`,
        headers: { authorization: 'Bearer valid-token' },
        payload: { resumeId: RESUME_ID },
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/ai/jobs/:jobId should reject a caller who does not own the job', async () => {
      const container = (
        app as unknown as { container: { aiOrchestrator: { getJobStatus: ReturnType<typeof vi.fn> } } }
      ).container;
      container.aiOrchestrator.getJobStatus = vi.fn().mockResolvedValue({ id: 'job-2', userId: 'other-user' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ai/jobs/job-2',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
