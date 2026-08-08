import type { FastifyInstance } from 'fastify';
import { createUserId } from '@careeros/career';
import { UnauthorizedError, NotFoundError, TooManyRequestsError } from '../../middleware/error-handler.js';
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

async function checkSyncRateLimit(fastify: FastifyInstance, userId: string): Promise<void> {
  const allowed = await fastify.container.services.syncRateLimiter.checkAndRecord(userId);
  if (!allowed) {
    throw new TooManyRequestsError('Please wait 1 minute between sync requests');
  }
}

export async function syncRoutes(fastify: FastifyInstance): Promise<void> {
  // Job-source syncing is an admin-only feature (mirrors the dashboard's
  // AdminGuard on /app/sync) — without this hook any authenticated user
  // could trigger provider syncs directly against the API.
  fastify.addHook('onRequest', requireAdmin);

  // Get sync status for all providers, scoped to the caller's workspace
  fastify.get('/status', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const statuses = fastify.container.services.syncScheduler.getStatuses(workspaceId);
    return reply.send({ statuses });
  });

  // Trigger full sync for all providers
  fastify.post('/all', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    await checkSyncRateLimit(fastify, userId);

    const result = await fastify.container.services.syncScheduler.syncAll(workspaceId);
    return reply.send(result);
  });

  // Trigger sync for a specific provider
  fastify.post('/:providerId', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const { providerId } = request.params as { providerId: string };
    await checkSyncRateLimit(fastify, userId);

    const result = await fastify.container.services.syncScheduler.syncProvider(providerId, workspaceId);
    return reply.send(result);
  });
}
