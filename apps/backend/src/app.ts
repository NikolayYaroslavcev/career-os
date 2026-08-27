import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { Telegraf } from 'telegraf';
import { registerTelegramLinkingBot, registerChannelPostForwarder } from '@careeros/telegram';
import { loadConfig, validateEncryptionConfig } from '@careeros/shared';
import { checkDatabaseHealth, prisma } from '@careeros/database';
import { checkRedisHealth, getRedis } from '@careeros/shared';
import { runHealthChecks } from '@careeros/shared';
import { apiRoutes } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { buildContainer } from './container.js';
import type { Container } from './container.js';

/**
 * Long-polls Telegram for inbound /start and /link commands, plus (EPIC-12
 * Phase 2) forwards any channel_post/edited_channel_post updates the bot
 * receives into BotApiTransport — the same bot instance and poller, no
 * second getUpdates loop. Colocated with the HTTP server for MVP simplicity
 * (mirrors ManualDigestScheduler's "no separate infra yet" deferral) — a real
 * deployment could move this to its own process without changing
 * TelegramLinkingService or the bot layer. No-ops without a bot token (e.g.
 * in tests), so it never touches the network there.
 */
function launchTelegramLinkingBot(botToken: string, container: Container): void {
  const bot = new Telegraf(botToken);
  registerTelegramLinkingBot(bot, container.services.telegramLinking);
  registerChannelPostForwarder(bot, (post) => container.botApiTransport.ingest(post));
  bot.launch();

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

export async function buildApp(): Promise<ReturnType<typeof Fastify>> {
  const config = loadConfig();

  validateEncryptionConfig();

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
  });

  const container = buildContainer(config);
  app.decorate('authProvider', container.authProvider);
  app.decorate('container', container);
  app.decorate('config', config);

  if (config.TELEGRAM_BOT_TOKEN) {
    launchTelegramLinkingBot(config.TELEGRAM_BOT_TOKEN, container);
  }

  // AI is optional (see /health's ai sub-check below), but a missing/invalid
  // key should be loud in boot logs — not something only discovered by
  // polling /health or waiting for the first AI call to fail at request time.
  if (!container.aiProvider.validateConfig()) {
    app.log.warn(
      'AI provider is not configured (missing/invalid API key for %s) — AI-powered features will fail at request time until this is fixed.',
      config.AI_PROVIDER
    );
  }

  app.setErrorHandler(errorHandler);

  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(','),
    credentials: true,
  });

  await app.register(helmet);

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    // Backed by Redis (not the plugin's in-process default) so the limit is
    // shared across backend replicas instead of being multiplied by replica
    // count — see ADR-019.
    redis: getRedis(config.REDIS_URL),
    nameSpace: 'fastify-rate-limit:',
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });

  // Provider/AI checks below are config/registration checks, not live network
  // calls — polling a job board or LLM API on every health probe would burn
  // rate-limit budget for no benefit. "Healthy" here means "configured and
  // ready to be used when called", not "just verified reachable".
  //
  // Neither gates the overall /health status code: both AI and every job
  // provider are optional (see .env.example), so a backend with no AI key
  // set is still a correctly running backend — it should report 200 (and
  // satisfy `depends_on: condition: service_healthy`), just with those two
  // sub-checks visibly unhealthy so it's obvious what's misconfigured.
  const checkProvidersReady = async (): Promise<boolean> => container.providerRegistry.getAll().length > 0;
  const checkAIReady = async (): Promise<boolean> => container.aiProvider.validateConfig();

  app.get('/health', async (_request, reply) => {
    const [health, providersReady, aiReady] = await Promise.all([
      runHealthChecks({
        database: checkDatabaseHealth,
        redis: checkRedisHealth,
      }),
      checkProvidersReady(),
      checkAIReady(),
    ]);

    const body = {
      ...health,
      checks: {
        ...health.checks,
        providers: { status: providersReady ? 'healthy' : 'unhealthy' } as const,
        ai: { status: aiReady ? 'healthy' : 'unhealthy' } as const,
      },
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    return reply.status(statusCode).send(body);
  });

  app.get('/ready', async (_request, reply) => {
    const dbHealthy = await checkDatabaseHealth();
    const redisHealthy = await checkRedisHealth();

    if (dbHealthy && redisHealthy) {
      return reply.status(200).send({ status: 'ready' });
    }
    return reply.status(503).send({ status: 'not ready' });
  });

  app.get('/live', async (_request, reply) => {
    return reply.status(200).send({ status: 'alive' });
  });

  await app.register(apiRoutes);

  // Start the sync scheduler — registers periodic sync for every allowlisted
  // workspace (SYNC_WORKSPACE_ALLOWLIST; unset = every workspace, previous
  // behavior). Providers take no workspace parameter, so starting sync for
  // N workspaces fetches the same external content N times over — see the
  // SYNC_WORKSPACE_ALLOWLIST doc comment in packages/shared/src/config.ts.
  // Non-blocking: runs in the background after the server starts accepting requests.
  app.addHook('onReady', async () => {
    try {
      const allowlist = config.SYNC_WORKSPACE_ALLOWLIST
        ?.split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      const workspaces = await prisma.workspace.findMany({
        where: allowlist && allowlist.length > 0 ? { id: { in: allowlist } } : undefined,
        select: { id: true },
      });
      for (const workspace of workspaces) {
        try {
          container.services.syncScheduler.startAll(workspace.id);
        } catch (error: unknown) {
          app.log.warn(
            'Failed to start sync scheduler for workspace %s: %s',
            workspace.id,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
      app.log.info('Sync scheduler started for %d workspace(s)', workspaces.length);
    } catch (error: unknown) {
      app.log.warn('Failed to start sync scheduler: %s', error instanceof Error ? error.message : String(error));
    }
  });

  return app;
}
