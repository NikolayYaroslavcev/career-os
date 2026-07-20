import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { errorHandler } from '../../../middleware/error-handler.js';
import { diagnosticsRoutes } from '../diagnostics-routes.js';

function buildTestApp(diagnosticsEnabled: boolean) {
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  app.decorate('config', { DIAGNOSTICS_ENABLED: diagnosticsEnabled, AI_PROVIDER: 'openai', AI_FALLBACK_PROVIDERS: 'anthropic' } as never);
  app.decorate('container', {
    providerDiagnostics: {
      getSnapshot: () => [{ providerId: 'hh', registered: true, enabled: true, configured: true, authenticated: 'not_required', health: 'unknown' }],
    },
    queueDiagnostics: {
      getJobCounts: async () => ({ waiting: 1, active: 2, completed: 3, failed: 4, delayed: 0 }),
    },
    searchRunTraces: {
      getAll: () => [{ runId: 'run-1', searchProfileId: 'sp-1' }],
      getById: (id: string) => (id === 'run-1' ? { runId: 'run-1', searchProfileId: 'sp-1' } : undefined),
    },
    aiProviderHealthMonitor: {
      getStatus: (name: string) => (name === 'openai' ? { providerName: 'openai', state: 'healthy' } : undefined),
    },
    aiMetrics: {
      getCounter: () => 5,
      getHistogram: () => [10, 20, 30],
    },
  } as never);
  app.register(diagnosticsRoutes, { prefix: '/diagnostics' });
  return app;
}

describe('diagnosticsRoutes (EPIC-17 Part 4)', () => {
  it('404s every endpoint when DIAGNOSTICS_ENABLED is false — never exposes pipeline internals by accident', async () => {
    const app = buildTestApp(false);
    await app.ready();

    for (const url of ['/diagnostics/providers', '/diagnostics/queue', '/diagnostics/runs', '/diagnostics/ai']) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(404);
    }

    await app.close();
  });

  it('returns provider diagnostics when enabled', async () => {
    const app = buildTestApp(true);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/diagnostics/providers' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      providers: [{ providerId: 'hh', registered: true, enabled: true, configured: true, authenticated: 'not_required', health: 'unknown' }],
    });

    await app.close();
  });

  it('returns queue job counts when enabled', async () => {
    const app = buildTestApp(true);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/diagnostics/queue' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ queue: { waiting: 1, active: 2, completed: 3, failed: 4, delayed: 0 } });

    await app.close();
  });

  it('returns the list of recent search run traces', async () => {
    const app = buildTestApp(true);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/diagnostics/runs' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).runs).toHaveLength(1);

    await app.close();
  });

  it('returns a single search run trace by id, or 404 if not found', async () => {
    const app = buildTestApp(true);
    await app.ready();

    const found = await app.inject({ method: 'GET', url: '/diagnostics/runs/run-1' });
    expect(found.statusCode).toBe(200);
    expect(JSON.parse(found.payload).run.runId).toBe('run-1');

    const notFound = await app.inject({ method: 'GET', url: '/diagnostics/runs/does-not-exist' });
    expect(notFound.statusCode).toBe(404);

    await app.close();
  });

  it('returns AI provider health and metrics for the primary and fallback chain', async () => {
    const app = buildTestApp(true);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/diagnostics/ai' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.providers).toEqual([
      { name: 'openai', health: { providerName: 'openai', state: 'healthy' } },
      { name: 'anthropic', health: null },
    ]);
    expect(body.metrics.cacheReused).toBe(5);
    expect(body.metrics.avgBatchDurationMs).toBe(20);

    await app.close();
  });
});
