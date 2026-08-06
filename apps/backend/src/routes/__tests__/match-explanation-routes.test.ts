import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import { matchExplanationRoutes } from '../match-explanation/match-explanation-routes.js';
import type { Container } from '../../container.js';

function createMockContainer(): { repositories: { matchResult: { findById: ReturnType<typeof vi.fn> } } } {
  return {
    repositories: {
      matchResult: {
        findById: vi.fn(),
      },
    },
  };
}

describe('Match Explanation Routes - authorization', () => {
  let app: ReturnType<typeof Fastify>;
  let container: ReturnType<typeof createMockContainer>;

  beforeEach(async () => {
    container = createMockContainer();
    app = Fastify();
    app.decorate('container', container);
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-1', email: 'user-1@example.com', role: 'job_seeker' };
    });
    await app.register(matchExplanationRoutes, { prefix: '/api/v1/match-results' });
    await app.ready();
  });

  it('GET /:id/explanation returns the explanation for the owning user', async () => {
    container.repositories.matchResult.findById.mockResolvedValue({
      id: 'match-1',
      userId: 'user-1',
      explanation: { overallPercent: 80 },
      categoryScores: [],
    });

    const response = await app.inject({ method: 'GET', url: '/api/v1/match-results/match-1/explanation' });

    expect(response.statusCode).toBe(200);
  });

  it('GET /:id/explanation returns 401 when the match result belongs to another user', async () => {
    container.repositories.matchResult.findById.mockResolvedValue({
      id: 'match-1',
      userId: 'other-user',
      explanation: { overallPercent: 80 },
      categoryScores: [],
    });

    const response = await app.inject({ method: 'GET', url: '/api/v1/match-results/match-1/explanation' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /:id/explanation returns 404 when the match result does not exist', async () => {
    container.repositories.matchResult.findById.mockResolvedValue(null);

    const response = await app.inject({ method: 'GET', url: '/api/v1/match-results/missing/explanation' });

    expect(response.statusCode).toBe(404);
  });

  it('GET /:id/actionable-items returns 401 when the match result belongs to another user', async () => {
    container.repositories.matchResult.findById.mockResolvedValue({
      id: 'match-1',
      userId: 'other-user',
      actionableItems: [],
    });

    const response = await app.inject({ method: 'GET', url: '/api/v1/match-results/match-1/actionable-items' });

    expect(response.statusCode).toBe(401);
  });

  it('GET /:id/explanation returns 401 for an unauthenticated request', async () => {
    const unauthApp = Fastify();
    unauthApp.decorate('container', container as unknown as Container);
    await unauthApp.register(matchExplanationRoutes, { prefix: '/api/v1/match-results' });
    await unauthApp.ready();

    const response = await unauthApp.inject({ method: 'GET', url: '/api/v1/match-results/match-1/explanation' });

    expect(response.statusCode).toBe(401);
  });
});
