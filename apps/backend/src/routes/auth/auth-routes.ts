import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth-middleware.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const logoutSchema = z.object({
  refreshToken: z.string(),
});

function requireUserId(request: { user?: { id: string } }): string {
  const userId = request.user?.id;
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

const AUTH_RATE_LIMIT = { max: 10, timeWindow: '1 minute' } as const;

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/register', {
    config: {
      rateLimit: AUTH_RATE_LIMIT,
    },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string', minLength: 1 },
          lastName: { type: 'string', minLength: 1 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const body = registerSchema.parse(request.body);
      const container = (request.server as unknown as { container: { services: { auth: { register: (input: { email: string; password: string; firstName: string; lastName: string }) => Promise<{ accessToken: string; refreshToken: string; user: { id: string; email: string } }> } } } }).container;

      const result = await container.services.auth.register(body);

      return reply.status(201).send(result);
    },
  });

  fastify.post('/login', {
    config: {
      rateLimit: AUTH_RATE_LIMIT,
    },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const body = loginSchema.parse(request.body);
      const container = (request.server as unknown as { container: { services: { auth: { login: (input: { email: string; password: string }) => Promise<{ accessToken: string; refreshToken: string; user: { id: string; email: string } }> } } } }).container;

      const result = await container.services.auth.login(body);

      return reply.send(result);
    },
  });

  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const body = refreshSchema.parse(request.body);
      const container = (request.server as unknown as { container: { services: { auth: { refresh: (token: string) => Promise<{ accessToken: string; refreshToken: string }> } } } }).container;

      const result = await container.services.auth.refresh(body.refreshToken);

      return reply.send(result);
    },
  });

  fastify.post('/logout', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const body = logoutSchema.parse(request.body);
      const container = (request.server as unknown as { container: { services: { auth: { logout: (token: string) => Promise<void> } } } }).container;

      await container.services.auth.logout(body.refreshToken);

      return reply.send({ success: true });
    },
  });

  fastify.post('/logout-all', {
    preHandler: [authMiddleware],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const userId = requireUserId(request);
      const container = (request.server as unknown as { container: { services: { auth: { logoutAll: (userId: string) => Promise<void> } } } }).container;

      await container.services.auth.logoutAll(userId);

      return reply.send({ success: true });
    },
  });
}
