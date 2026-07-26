import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FollowUpType } from '@careeros/career';
import type { EnrichedFollowUp } from '../../services/follow-up-service.js';
import { NotFoundError, UnauthorizedError } from '../../middleware/error-handler.js';
import {
  FollowUpApplicationNotFoundError,
  FollowUpNotAuthorizedError,
  FollowUpNotFoundError,
} from '../../services/follow-up-service.js';

const followUpTypeValues = [
  FollowUpType.FOLLOW_UP,
  FollowUpType.INTERVIEW,
  FollowUpType.REPLY_EXPECTED,
  FollowUpType.CUSTOM,
] as const;

const createFollowUpSchema = z.object({
  applicationId: z.string().uuid(),
  date: z.string().datetime(),
  message: z.string().min(1).optional(),
  type: z.enum(followUpTypeValues).optional(),
});

const rescheduleFollowUpSchema = z.object({
  date: z.string().datetime(),
});

function requireUserId(request: { user?: { id: string } }): string {
  if (!request.user) {
    throw new UnauthorizedError('User not authenticated');
  }
  return request.user.id;
}

function mapFollowUpError(error: unknown): never {
  if (error instanceof FollowUpApplicationNotFoundError || error instanceof FollowUpNotFoundError) {
    throw new NotFoundError(error.message);
  }
  if (error instanceof FollowUpNotAuthorizedError) {
    throw new UnauthorizedError(error.message);
  }
  throw error;
}

function serializeEnriched(item: EnrichedFollowUp): {
  id: string;
  applicationId: string;
  type: FollowUpType | null;
  status: EnrichedFollowUp['status'];
  scheduledAt: string;
  message: string | null;
  vacancyTitle: string;
  companyName: string;
  daysSinceApplied: number | null;
} {
  return {
    id: item.id,
    applicationId: item.applicationId,
    type: item.type ?? null,
    status: item.status,
    scheduledAt: item.scheduledAt.toISOString(),
    message: item.message ?? null,
    vacancyTitle: item.vacancyTitle,
    companyName: item.companyName,
    daysSinceApplied: item.daysSinceApplied,
  };
}

/**
 * Cross-application aggregate view over the same FollowUp data the nested
 * /applications/:id/follow-ups routes expose — backs the /follow-ups dashboard, which needs
 * "everything due across all my applications", not one application at a time. Every handler
 * here delegates straight to FollowUpService; there is no separate follow-up system or store.
 */
export async function followUpRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request);
    const items = await fastify.container.services.followUp.listEnrichedForUser(userId);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    const overdue: EnrichedFollowUp[] = [];
    const today: EnrichedFollowUp[] = [];
    const upcoming: EnrichedFollowUp[] = [];
    const completed: EnrichedFollowUp[] = [];

    for (const item of items) {
      if (item.status === 'cancelled') {
        continue;
      }
      if (item.status === 'completed' || item.status === 'sent') {
        completed.push(item);
        continue;
      }
      // pending / snoozed, bucketed by date
      if (item.scheduledAt < startOfToday) {
        overdue.push(item);
      } else if (item.scheduledAt < endOfToday) {
        today.push(item);
      } else {
        upcoming.push(item);
      }
    }

    const byDateAsc = (a: EnrichedFollowUp, b: EnrichedFollowUp): number => a.scheduledAt.getTime() - b.scheduledAt.getTime();
    const byDateDesc = (a: EnrichedFollowUp, b: EnrichedFollowUp): number => b.scheduledAt.getTime() - a.scheduledAt.getTime();

    return reply.send({
      overdue: overdue.sort(byDateAsc).map(serializeEnriched),
      today: today.sort(byDateAsc).map(serializeEnriched),
      upcoming: upcoming.sort(byDateAsc).map(serializeEnriched),
      completed: completed.sort(byDateDesc).map(serializeEnriched),
    });
  });

  fastify.post('/', async (request, reply) => {
    const userId = requireUserId(request);
    const body = createFollowUpSchema.parse(request.body);

    try {
      const followUp = await fastify.container.services.followUp.schedule(
        body.applicationId,
        userId,
        new Date(body.date),
        body.message,
        body.type
      );
      const enriched = await fastify.container.services.followUp.enrich(followUp);
      return reply.status(201).send(serializeEnriched(enriched));
    } catch (error) {
      mapFollowUpError(error);
    }
  });

  fastify.patch('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };
    const body = rescheduleFollowUpSchema.parse(request.body);

    try {
      // Rescheduling a pending follow-up is exactly what snooze() already does — reused as-is.
      const followUp = await fastify.container.services.followUp.snooze(params.id, userId, new Date(body.date));
      const enriched = await fastify.container.services.followUp.enrich(followUp);
      return reply.send(serializeEnriched(enriched));
    } catch (error) {
      mapFollowUpError(error);
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };

    try {
      await fastify.container.services.followUp.cancel(params.id, userId);
      return reply.status(204).send();
    } catch (error) {
      mapFollowUpError(error);
    }
  });

  fastify.post('/:id/complete', async (request, reply) => {
    const userId = requireUserId(request);
    const params = request.params as { id: string };

    try {
      const followUp = await fastify.container.services.followUp.complete(params.id, userId);
      const enriched = await fastify.container.services.followUp.enrich(followUp);
      return reply.send(serializeEnriched(enriched));
    } catch (error) {
      mapFollowUpError(error);
    }
  });
}
