import type { FastifyInstance } from 'fastify';
import { UnauthorizedError, NotFoundError } from '../../middleware/error-handler.js';

function requireUserId(request: { user?: { id: string } }): string {
  if (!request.user) {
    throw new UnauthorizedError('User not authenticated');
  }
  return request.user.id;
}

export async function matchExplanationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/:id/explanation', async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params as { id: string };

    const matchResult = await fastify.container.repositories.matchResult.findById(id);
    if (!matchResult) {
      throw new NotFoundError('Match result');
    }
    if (matchResult.userId !== userId) {
      throw new UnauthorizedError('Not authorized to view this match result');
    }

    return reply.send({
      matchResultId: matchResult.id,
      explanation: matchResult.explanation,
      categoryScores: matchResult.categoryScores,
    });
  });

  fastify.get('/:id/actionable-items', async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params as { id: string };

    const matchResult = await fastify.container.repositories.matchResult.findById(id);
    if (!matchResult) {
      throw new NotFoundError('Match result');
    }
    if (matchResult.userId !== userId) {
      throw new UnauthorizedError('Not authorized to view this match result');
    }

    return reply.send({
      matchResultId: matchResult.id,
      actionableItems: matchResult.actionableItems,
    });
  });
}
