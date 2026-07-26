import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createWorkspaceSchema = z.object({
  name: z.string().min(1),
});

export async function workspaceRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              role: { type: 'string' },
            },
          },
        },
      },
    },
    handler: async (_request, reply) => {
      // TODO: Implement actual workspace list logic
      // This is a placeholder
      return reply.send([
        {
          id: 'placeholder-id',
          name: 'My Workspace',
          role: 'OWNER',
        },
      ]);
    },
  });

  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const body = createWorkspaceSchema.parse(request.body);

      // TODO: Implement actual workspace creation logic
      // This is a placeholder
      return reply.status(201).send({
        id: 'placeholder-id',
        name: body.name,
      });
    },
  });

  fastify.post('/:id/invite', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['ADMIN', 'MEMBER'], default: 'MEMBER' },
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
      // TODO: Implement actual member invitation logic
      // This is a placeholder
      return reply.send({
        success: true,
      });
    },
  });

  fastify.put('/:id/members/:userId/role', {
    schema: {
      params: {
        type: 'object',
        required: ['id', 'userId'],
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['ADMIN', 'MEMBER'] },
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
      // TODO: Implement actual role update logic
      // This is a placeholder
      return reply.send({
        success: true,
      });
    },
  });
}
