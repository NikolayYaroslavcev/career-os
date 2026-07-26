import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Recruiter } from '@careeros/career';
import { createUserId } from '@careeros/career';
import { NotFoundError, UnauthorizedError } from '../../middleware/error-handler.js';
import { RecruiterNotFoundError } from '../../services/recruiter-service.js';

const createRecruiterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  notes: z.string().optional(),
  companyId: z.string().uuid().optional(),
});

const updateRecruiterSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  notes: z.string().optional(),
  companyId: z.string().uuid().optional(),
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

function serialize(recruiter: Recruiter): {
  id: Recruiter['id'];
  name: Recruiter['name'];
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: recruiter.id,
    name: recruiter.name,
    email: recruiter.email?.value ?? null,
    phone: recruiter.phone ?? null,
    linkedinUrl: recruiter.linkedinUrl ?? null,
    notes: recruiter.notes ?? null,
    companyId: recruiter.companyId ?? null,
    createdAt: recruiter.createdAt.toISOString(),
    updatedAt: recruiter.updatedAt.toISOString(),
  };
}

export async function recruiterRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const recruiters = await fastify.container.services.recruiter.listByWorkspace(workspaceId);
    return reply.send({ recruiters: recruiters.map(serialize) });
  });

  fastify.get('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const params = request.params as { id: string };
    const recruiter = await fastify.container.services.recruiter.getOwnedById(params.id, workspaceId);

    if (!recruiter) {
      throw new NotFoundError('Recruiter');
    }

    return reply.send(serialize(recruiter));
  });

  fastify.post('/', async (request, reply) => {
    const userId = requireUserId(request);
    const body = createRecruiterSchema.parse(request.body);
    const workspaceId = await getWorkspaceId(fastify, userId);

    const recruiter = await fastify.container.services.recruiter.create({
      workspaceId,
      ...body,
    });

    return reply.status(201).send(serialize(recruiter));
  });

  fastify.put('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const params = request.params as { id: string };
    const body = updateRecruiterSchema.parse(request.body);

    try {
      const recruiter = await fastify.container.services.recruiter.update(params.id, workspaceId, body);
      return reply.send(serialize(recruiter));
    } catch (error) {
      if (error instanceof RecruiterNotFoundError) {
        throw new NotFoundError('Recruiter');
      }
      throw error;
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const params = request.params as { id: string };

    try {
      await fastify.container.services.recruiter.delete(params.id, workspaceId);
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof RecruiterNotFoundError) {
        throw new NotFoundError('Recruiter');
      }
      throw error;
    }
  });
}
