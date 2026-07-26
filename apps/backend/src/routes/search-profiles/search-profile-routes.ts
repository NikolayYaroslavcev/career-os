import type { FastifyInstance } from 'fastify';
import type { SearchProfile } from '@careeros/career';
import { createUserId } from '@careeros/career';
import { CreateSearchProfileDto, UpdateSearchProfileDto } from '../../dto/search-profile-dto.js';
import { NotFoundError, UnauthorizedError } from '../../middleware/error-handler.js';
import { SearchProfileNotFoundError } from '../../services/search-profile-service.js';

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

function serialize(profile: SearchProfile): {
  id: SearchProfile['id'];
  userId: SearchProfile['userId'];
  name: SearchProfile['name'];
  desiredPositions: SearchProfile['desiredPositions'];
  desiredTechnologies: string[];
  experienceLevel: SearchProfile['experienceLevel'];
  desiredSalary: { min: number; max: number; currency: string; period: string } | null;
  desiredLocations: { city: string | null; country: string | null; workMode: string; isRelocationPossible: boolean }[];
  isRemoteOnly: SearchProfile['isRemoteOnly'];
  isActive: SearchProfile['isActive'];
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.name,
    desiredPositions: profile.desiredPositions,
    desiredTechnologies: profile.desiredTechnologies.map((t) => t.name),
    experienceLevel: profile.experienceLevel,
    desiredSalary: profile.desiredSalary
      ? {
          min: profile.desiredSalary.min,
          max: profile.desiredSalary.max,
          currency: profile.desiredSalary.currency,
          period: profile.desiredSalary.period,
        }
      : null,
    desiredLocations: profile.desiredLocations.map((location) => ({
      city: location.city ?? null,
      country: location.country ?? null,
      workMode: location.workMode,
      isRelocationPossible: location.isRelocationPossible,
    })),
    isRemoteOnly: profile.isRemoteOnly,
    isActive: profile.isActive,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function searchProfileRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request);
    const profiles = await fastify.container.services.searchProfile.listByUser(userId);
    return reply.send({ searchProfiles: profiles.map(serialize) });
  });

  fastify.get('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };
    const profile = await fastify.container.services.searchProfile.getOwnedById(params.id, userId);

    if (!profile) {
      throw new NotFoundError('SearchProfile');
    }

    return reply.send(serialize(profile));
  });

  fastify.post('/', async (request, reply) => {
    const userId = requireUserId(request);
    const body = CreateSearchProfileDto.parse(request.body);
    const workspaceId = await getWorkspaceId(fastify, userId);

    const profile = await fastify.container.services.searchProfile.create({
      userId,
      workspaceId,
      ...body,
    });

    return reply.status(201).send(serialize(profile));
  });

  fastify.put('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };
    const body = UpdateSearchProfileDto.parse(request.body);

    try {
      const profile = await fastify.container.services.searchProfile.update(params.id, userId, body);
      return reply.send(serialize(profile));
    } catch (error) {
      if (error instanceof SearchProfileNotFoundError) {
        throw new NotFoundError('SearchProfile');
      }
      throw error;
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };

    try {
      await fastify.container.services.searchProfile.delete(params.id, userId);
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof SearchProfileNotFoundError) {
        throw new NotFoundError('SearchProfile');
      }
      throw error;
    }
  });

  fastify.post('/:id/enable', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };

    try {
      const profile = await fastify.container.services.searchProfile.enable(params.id, userId);
      return reply.send(serialize(profile));
    } catch (error) {
      if (error instanceof SearchProfileNotFoundError) {
        throw new NotFoundError('SearchProfile');
      }
      throw error;
    }
  });

  fastify.post('/:id/disable', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };

    try {
      const profile = await fastify.container.services.searchProfile.disable(params.id, userId);
      return reply.send(serialize(profile));
    } catch (error) {
      if (error instanceof SearchProfileNotFoundError) {
        throw new NotFoundError('SearchProfile');
      }
      throw error;
    }
  });
}
