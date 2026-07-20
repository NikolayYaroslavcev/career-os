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
    getUserById: vi.fn().mockResolvedValue({
      id: 'user-id',
      email: 'test@example.com',
      firstName: 'John',
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
      user: {},
      resume: {},
      vacancy: {
        findMany: vi.fn().mockResolvedValue({ vacancies: [], total: 0 }),
        findById: vi.fn().mockResolvedValue(null),
      },
      company: {
        findById: vi.fn().mockResolvedValue(null),
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
    },
    authProvider: mockAuthProvider,
    providerRegistry: { getProvider: vi.fn(), getAll: vi.fn().mockReturnValue([{}]) },
    aiProvider: { validateConfig: vi.fn().mockReturnValue(true) },
    applicationService: {},
    services: {
      auth: mockAuthService,
      searchProfile: {},
      providerSearch: {},
      aiMatching: {},
      recommendation: {},
      applicationCreation: {},
      applicationCrm: {
        list: vi.fn().mockResolvedValue({ applications: [], total: 0 }),
        getPipeline: vi.fn().mockResolvedValue([]),
      },
      recruiter: {},
      intelligenceWorkflow: {},
      morningDigest: {},
      digestDelivery: {},
      digestScheduler: {},
      telegramLinking: {},
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

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
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
        getPipeline: async () => [{ status: 'saved', count: 1, applications: [] }],
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
        changeStatus: async () => {
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
        getOwned: async () => {
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
        findById: async () => ({ workspaceIds: ['workspace-1'] }),
      };
      container.services.recruiter = {
        listByWorkspace: async () => [],
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
});
