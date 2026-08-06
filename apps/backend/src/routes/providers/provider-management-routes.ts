import type { FastifyInstance } from 'fastify';
import { createUserId } from '@careeros/career';
import { UnauthorizedError, NotFoundError, ValidationError } from '../../middleware/error-handler.js';
import { requireAdmin } from '../../middleware/require-role.js';

function requireUserId(request: { user?: { id: string } }): string {
  if (!request.user) throw new UnauthorizedError('User not authenticated');
  return request.user.id;
}

async function getWorkspaceId(fastify: FastifyInstance, userId: string): Promise<string> {
  const user = await fastify.container.repositories.user.findById(createUserId(userId));
  if (!user) throw new NotFoundError('User workspace');
  const [workspaceId] = user.workspaceIds;
  if (!workspaceId) throw new NotFoundError('User workspace');
  return workspaceId;
}

/**
 * Provider Settings + Telegram Channel Management (EPIC-21 Phase 3). Both
 * configure global, system-wide infrastructure (which search providers are
 * enabled, which Telegram channels are scraped) rather than anything scoped
 * to the caller's own workspace, so the whole plugin is admin-only.
 */
export async function providerManagementRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', requireAdmin);

  fastify.get('/providers', async (_request, reply) => {
    const userId = requireUserId(_request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const providers = await fastify.container.services.providerManagement.getAllProviders(workspaceId);
    return reply.send({ providers });
  });

  fastify.get<{ Params: { providerId: string } }>('/providers/:providerId', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const provider = await fastify.container.services.providerManagement.getProvider(request.params.providerId, workspaceId);
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
    const userId = requireUserId(_request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const qualities = await fastify.container.services.providerManagement.getAllProviderQualities(workspaceId);
    return reply.send({ qualities });
  });

  fastify.get<{ Params: { providerId: string } }>('/providers/:providerId/quality', async (request, reply) => {
    requireUserId(request);
    const quality = await fastify.container.services.providerManagement.calculateProviderQuality(request.params.providerId);
    return reply.send({ quality });
  });
}
