import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
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
    handler: async (request, reply) => {
      const workspaces = await fastify.container.services.workspace.listForUser(request.user!.id);
      return reply.send(workspaces);
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
      const workspace = await fastify.container.services.workspace.create(request.user!.id, body.name);
      return reply.status(201).send(workspace);
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
      const { id } = request.params as { id: string };
      const body = inviteMemberSchema.parse(request.body);

      await fastify.container.services.workspace.inviteMember(id, request.user!.id, body.email, body.role);

      return reply.send({ success: true });
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
      const { id, userId } = request.params as { id: string; userId: string };
      const body = updateMemberRoleSchema.parse(request.body);

      await fastify.container.services.workspace.updateMemberRole(id, request.user!.id, userId, body.role);

      return reply.send({ success: true });
    },
  });
}
