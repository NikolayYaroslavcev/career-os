import type { FastifyInstance, FastifyReply } from 'fastify';
import { NotFoundError } from '../../middleware/error-handler.js';

/**
 * Developer diagnostics: provider status, queue depth, per-search-run
 * pipeline traces (with a per-vacancy exclusion reason), and AI provider
 * health/metrics. Gated behind existing JWT auth (registered inside the
 * protected route group) *and* DIAGNOSTICS_ENABLED, so a misconfigured
 * production deploy never exposes pipeline internals by accident — every
 * handler 404s when the flag is off, same as if the route didn't exist.
 *
 * Deliberately reuses existing observability infrastructure rather than
 * introducing a parallel one: ProviderDiagnosticsService wraps the existing
 * ProviderHealthMonitor, QueueDiagnosticsService reads BullMQ's own job
 * counts, the AI section reads the same AIProviderHealthMonitor instance
 * FallbackAIProvider records against, and SearchRunTraceRecorder is built
 * entirely from data ProviderSearchService/AiMatchingService/
 * TriageMatchingService already compute.
 */
export async function diagnosticsRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (_request, reply: FastifyReply) => {
    if (!fastify.config.DIAGNOSTICS_ENABLED) {
      return reply.status(404).send({ error: 'Not Found' });
    }
  });

  fastify.get('/providers', async (_request, reply) => {
    return reply.send({ providers: fastify.container.providerDiagnostics.getSnapshot() });
  });

  fastify.get('/queue', async (_request, reply) => {
    const jobCounts = await fastify.container.queueDiagnostics.getJobCounts();
    return reply.send({ queue: jobCounts });
  });

  fastify.get('/runs', async (_request, reply) => {
    return reply.send({ runs: fastify.container.searchRunTraces.getAll() });
  });

  fastify.get<{ Params: { id: string } }>('/runs/:id', async (request, reply) => {
    const trace = fastify.container.searchRunTraces.getById(request.params.id);
    if (!trace) {
      throw new NotFoundError('Search run trace');
    }
    return reply.send({ run: trace });
  });

  fastify.get('/ai', async (_request, reply) => {
    const config = fastify.config;
    const providerNames = [
      config.AI_PROVIDER,
      ...(config.AI_FALLBACK_PROVIDERS ?? '').split(',').map((name) => name.trim()).filter(Boolean),
    ];

    const providers = providerNames.map((name) => ({
      name,
      health: fastify.container.aiProviderHealthMonitor.getStatus(name) ?? null,
    }));

    const metrics = fastify.container.aiMetrics;
    const batchDurations = metrics.getHistogram('careeros.ai_matching.batch_duration_ms');

    return reply.send({
      providers,
      metrics: {
        cacheReused: metrics.getCounter('careeros.ai_matching.reused'),
        triageTotal: metrics.getCounter('careeros.ai_matching.triage_total'),
        triagePassed: metrics.getCounter('careeros.ai_matching.triage_passed'),
        triageRejected: metrics.getCounter('careeros.ai_matching.triage_rejected'),
        failed: metrics.getCounter('careeros.ai_matching.failed'),
        evaluated: metrics.getCounter('careeros.ai_matching.evaluated'),
        avgBatchDurationMs:
          batchDurations.length > 0 ? batchDurations.reduce((sum, ms) => sum + ms, 0) / batchDurations.length : 0,
      },
    });
  });
}
