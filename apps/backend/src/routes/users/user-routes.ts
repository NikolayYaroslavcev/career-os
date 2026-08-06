import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
});

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/me', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const user = (request as unknown as { user: { id: string } }).user;
      const container = (request.server as unknown as { container: { services: { auth: { getUserById: (id: string) => Promise<{ id: string; email: string; firstName: string; lastName: string }> } } } }).container;

      const userData = await container.services.auth.getUserById(user.id);

      return reply.send(userData);
    },
  });

  fastify.put('/me', {
    schema: {
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string', minLength: 1, maxLength: 100 },
          lastName: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const user = (request as unknown as { user: { id: string } }).user;
      const body = updateProfileSchema.parse(request.body);
      const container = (request.server as unknown as { container: { services: { auth: { updateProfile: (id: string, input: { firstName?: string; lastName?: string }) => Promise<{ id: string; email: string; firstName: string; lastName: string }> } } } }).container;

      const userData = await container.services.auth.updateProfile(user.id, body);

      return reply.send(userData);
    },
  });
}
