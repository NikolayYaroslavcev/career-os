import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { syncRoutes } from '../sync/sync-routes.js';
import { errorHandler } from '../../middleware/error-handler.js';

function createMockContainer(): {
  repositories: {
    user: { findById: ReturnType<typeof vi.fn> };
    vacancy: { findMany: ReturnType<typeof vi.fn> };
    company: { findById: ReturnType<typeof vi.fn> };
  };
  services: {
    syncScheduler: {
      getStatuses: ReturnType<typeof vi.fn>;
      syncAll: ReturnType<typeof vi.fn>;
      syncProvider: ReturnType<typeof vi.fn>;
    };
    syncRateLimiter: { checkAndRecord: ReturnType<typeof vi.fn> };
  };
} {
  return {
    repositories: {
      user: {
        findById: vi.fn().mockResolvedValue({
          id: 'user-1',
          workspaceIds: ['ws-1'],
        }),
      },
      vacancy: { findMany: vi.fn().mockResolvedValue({ vacancies: [], total: 0 }) },
      company: { findById: vi.fn().mockResolvedValue(null) },
    },
    services: {
      syncScheduler: {
        getStatuses: vi.fn().mockReturnValue([
          { providerId: 'hh', lastSyncAt: null, lastSyncResult: 'pending', nextSyncAt: null, totalJobsSynced: 0 },
        ]),
        syncAll: vi.fn().mockResolvedValue({ results: [], totalDurationMs: 100 }),
        syncProvider: vi.fn().mockResolvedValue({ status: 'success', jobsSynced: 5, durationMs: 200 }),
      },
      syncRateLimiter: {
        checkAndRecord: vi.fn().mockResolvedValue(true),
      },
    },
  };
}

describe('Sync Routes', () => {
  let app: ReturnType<typeof Fastify>;
  let container: ReturnType<typeof createMockContainer>;

  beforeEach(async () => {
    container = createMockContainer();
    app = Fastify();
    app.setErrorHandler(errorHandler);
    app.decorate('container', container);
    // Simulate auth middleware by adding user to request
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-1', email: 'user-1@example.com' };
    });
    await app.register(syncRoutes, { prefix: '/api/v1/sync' });
    await app.ready();
  });

  it('GET /status returns provider statuses', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/sync/status',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.statuses).toHaveLength(1);
    expect(body.statuses[0].providerId).toBe('hh');
  });

  it('POST /all triggers sync for all providers', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/all',
    });

    expect(response.statusCode).toBe(200);
    expect(container.services.syncScheduler.syncAll).toHaveBeenCalledWith('ws-1');
  });

  it('POST /:providerId triggers sync for specific provider and returns the expected response shape', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/hh',
    });

    expect(response.statusCode).toBe(200);
    expect(container.services.syncScheduler.syncProvider).toHaveBeenCalledWith('hh', 'ws-1');
    const body = JSON.parse(response.payload);
    expect(body).toEqual({ status: 'success', jobsSynced: 5, durationMs: 200 });
  });

  it('an authenticated user with a workspace can sync a provider (workspace correctly resolved from the User domain object)', async () => {
    container.repositories.user.findById.mockResolvedValueOnce({
      id: 'user-1',
      workspaceIds: ['ws-42'],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/hh',
    });

    expect(response.statusCode).toBe(200);
    expect(container.services.syncScheduler.syncProvider).toHaveBeenCalledWith('hh', 'ws-42');
  });

  it('a user with no workspace gets a 404 NotFoundError, not a 500', async () => {
    container.repositories.user.findById.mockResolvedValueOnce({
      id: 'user-1',
      workspaceIds: [],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/hh',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(container.services.syncScheduler.syncProvider).not.toHaveBeenCalled();
  });

  it('a user record that cannot be found at all gets a 404, not a 500', async () => {
    container.repositories.user.findById.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/hh',
    });

    expect(response.statusCode).toBe(404);
    expect(container.services.syncScheduler.syncProvider).not.toHaveBeenCalled();
  });

  it('a second sync request within the rate-limit window returns 429, not 500', async () => {
    container.services.syncRateLimiter.checkAndRecord
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const first = await app.inject({ method: 'POST', url: '/api/v1/sync/hh' });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: 'POST', url: '/api/v1/sync/hh' });
    expect(second.statusCode).toBe(429);
    const body = JSON.parse(second.payload);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('consults the distributed rate limiter keyed by the caller userId, not an in-process map', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/sync/hh' });

    expect(container.services.syncRateLimiter.checkAndRecord).toHaveBeenCalledWith('user-1');
  });

  it('rejects with 429 when the rate limiter denies the request, without ever calling syncAll', async () => {
    container.services.syncRateLimiter.checkAndRecord.mockResolvedValueOnce(false);

    const response = await app.inject({ method: 'POST', url: '/api/v1/sync/all' });

    expect(response.statusCode).toBe(429);
    expect(container.services.syncScheduler.syncAll).not.toHaveBeenCalled();
  });

  it('an unauthenticated request is rejected with 401, not 500', async () => {
    const unauthContainer = createMockContainer();
    const unauthApp = Fastify();
    unauthApp.setErrorHandler(errorHandler);
    unauthApp.decorate('container', unauthContainer as unknown as FastifyInstance['container']);
    await unauthApp.register(syncRoutes, { prefix: '/api/v1/sync' });
    await unauthApp.ready();

    const response = await unauthApp.inject({ method: 'POST', url: '/api/v1/sync/hh' });
    expect(response.statusCode).toBe(401);
  });
});
