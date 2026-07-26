import type { FastifyInstance } from 'fastify';
import { UnauthorizedError, NotFoundError, ValidationError } from '../../middleware/error-handler.js';

function requireUserId(request: { user?: { id: string } }): string {
  if (!request.user) throw new UnauthorizedError('User not authenticated');
  return request.user.id;
}

export async function providerManagementRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/providers', async (_request, reply) => {
    requireUserId(_request);
    const providers = await fastify.container.services.providerManagement.getAllProviders();
    return reply.send({ providers });
  });

  fastify.get<{ Params: { providerId: string } }>('/providers/:providerId', async (request, reply) => {
    requireUserId(request);
    const provider = await fastify.container.services.providerManagement.getProvider(request.params.providerId);
    if (!provider) throw new NotFoundError('Provider');
    return reply.send({ provider });
  });

  fastify.patch<{ Params: { providerId: string }; Body: { enabled?: boolean; syncEnabled?: boolean; status?: string; settings?: unknown } }>(
    '/providers/:providerId',
    async (request, reply) => {
      requireUserId(request);
      const { providerId } = request.params;
      const { enabled, syncEnabled, status, settings } = request.body;

      if (enabled === undefined && syncEnabled === undefined && status === undefined && settings === undefined) {
        throw new ValidationError('At least one field must be provided');
      }

      const config = await fastify.container.services.providerManagement.updateProvider(providerId, {
        enabled,
        syncEnabled,
        status,
        settings,
      });

      return reply.send({ config });
    },
  );

  fastify.get('/providers/telegram/channels', async (_request, reply) => {
    requireUserId(_request);
    const channels = await fastify.container.services.providerManagement.getAllTelegramChannels();
    return reply.send({ channels });
  });

  fastify.post<{ Body: { username: string; enabled?: boolean; category?: string; description?: string } }>(
    '/providers/telegram/channels',
    async (request, reply) => {
      requireUserId(request);
      const { username, enabled, category, description } = request.body;

      if (!username || typeof username !== 'string') {
        throw new ValidationError('Username is required');
      }

      const channel = await fastify.container.services.providerManagement.addTelegramChannel({
        username,
        enabled,
        category,
        description,
      });

      return reply.status(201).send({ channel });
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { enabled?: boolean; category?: string; description?: string } }>(
    '/providers/telegram/channels/:id',
    async (request, reply) => {
      requireUserId(request);
      const { id } = request.params;
      const { enabled, category, description } = request.body;

      const channel = await fastify.container.services.providerManagement.updateTelegramChannel(id, {
        enabled,
        category,
        description,
      });

      return reply.send({ channel });
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/providers/telegram/channels/:id',
    async (request, reply) => {
      requireUserId(request);
      await fastify.container.services.providerManagement.removeTelegramChannel(request.params.id);
      return reply.status(204).send();
    },
  );

  fastify.get('/providers/quality', async (_request, reply) => {
    requireUserId(_request);
    const qualities = await fastify.container.services.providerManagement.getAllProviderQualities();
    return reply.send({ qualities });
  });

  fastify.get<{ Params: { providerId: string } }>('/providers/:providerId/quality', async (request, reply) => {
    requireUserId(request);
    const quality = await fastify.container.services.providerManagement.calculateProviderQuality(request.params.providerId);
    return reply.send({ quality });
  });
}
