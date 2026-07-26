import type { FastifyInstance } from 'fastify';
import { createUserId } from '@careeros/career';
import { UnauthorizedError, NotFoundError } from '../../middleware/error-handler.js';
import { UserNotFoundError } from '../../services/telegram-linking-service.js';

function requireUserId(request: { user?: { id: string } }): string {
  if (!request.user) {
    throw new UnauthorizedError('User not authenticated');
  }
  return request.user.id;
}

export async function telegramRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/link-code', async (request, reply) => {
    const userId = requireUserId(request);

    try {
      const result = await fastify.container.services.telegramLinking.generateLinkingCode(userId);
      return reply.status(201).send({
        code: result.code,
        expiresAt: result.expiresAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw new NotFoundError('User');
      }
      throw error;
    }
  });

  fastify.get('/connection', async (request, reply) => {
    const userId = requireUserId(request);
    const connection = await fastify.container.repositories.telegramConnection.findByUserId(createUserId(userId));

    if (!connection || !connection.isActive) {
      return reply.send({ linked: false });
    }

    return reply.send({
      linked: true,
      telegramUsername: connection.telegramUsername ?? null,
      verifiedAt: connection.verifiedAt.toISOString(),
    });
  });
}
