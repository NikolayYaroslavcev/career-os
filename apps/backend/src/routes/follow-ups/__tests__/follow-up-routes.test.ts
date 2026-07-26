import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import { FollowUpType } from '@careeros/career';
import { followUpRoutes } from '../follow-up-routes.js';
import type { Container } from '../../../container.js';

const ENRICHED_RESULT = {
  id: 'follow-up-1',
  applicationId: 'application-1',
  type: FollowUpType.FOLLOW_UP,
  status: 'pending' as const,
  scheduledAt: new Date('2024-06-01T00:00:00.000Z'),
  message: 'Following up',
  vacancyTitle: 'Senior Engineer',
  companyName: 'Acme Corp',
  daysSinceApplied: 3,
};

function createMockContainer(): Container {
  return {
    services: {
      followUp: {
        listEnrichedForUser: vi.fn().mockResolvedValue([]),
        schedule: vi.fn().mockResolvedValue({ id: 'follow-up-1', applicationId: 'application-1' }),
        snooze: vi.fn().mockResolvedValue({ id: 'follow-up-1', applicationId: 'application-1' }),
        complete: vi.fn().mockResolvedValue({ id: 'follow-up-1', applicationId: 'application-1' }),
        enrich: vi.fn().mockResolvedValue(ENRICHED_RESULT),
      },
    },
  } as unknown as Container;
}

describe('Follow-up Routes', () => {
  let app: ReturnType<typeof Fastify>;
  let container: ReturnType<typeof createMockContainer>;

  beforeEach(async () => {
    container = createMockContainer();
    app = Fastify();
    app.decorate('container', container);
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-1', email: 'user-1@example.com' };
    });
    await app.register(followUpRoutes, { prefix: '/api/v1/follow-ups' });
    await app.ready();
  });

  // The dashboard's `EnrichedFollowUp` frontend type (apps/dashboard/src/api/follow-ups.ts)
  // requires vacancyTitle/companyName/daysSinceApplied on every mutation response, not just
  // the GET / list. These three tests guard against that response silently shrinking back
  // down to the bare FollowUp fields.
  it('POST / returns the enriched shape (vacancyTitle/companyName/daysSinceApplied), not the bare FollowUp fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/follow-ups',
      payload: { applicationId: '11111111-1111-4111-8111-111111111111', date: '2024-06-01T00:00:00.000Z' },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.vacancyTitle).toBe('Senior Engineer');
    expect(body.companyName).toBe('Acme Corp');
    expect(body.daysSinceApplied).toBe(3);
    expect(container.services.followUp.enrich).toHaveBeenCalled();
  });

  it('PATCH /:id returns the enriched shape', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/follow-ups/follow-up-1',
      payload: { date: '2024-06-05T00:00:00.000Z' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.vacancyTitle).toBe('Senior Engineer');
    expect(body.companyName).toBe('Acme Corp');
    expect(body.daysSinceApplied).toBe(3);
  });

  it('POST /:id/complete returns the enriched shape', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/follow-ups/follow-up-1/complete',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.vacancyTitle).toBe('Senior Engineer');
    expect(body.companyName).toBe('Acme Corp');
    expect(body.daysSinceApplied).toBe(3);
  });
});
