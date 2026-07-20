import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { Telegraf } from 'telegraf';
import { registerTelegramLinkingBot } from '@careeros/telegram';
import { loadConfig } from '@careeros/shared';
import { checkDatabaseHealth } from '@careeros/database';
import { checkRedisHealth } from '@careeros/shared';
import { runHealthChecks } from '@careeros/shared';
import { apiRoutes } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { buildContainer } from './container.js';
import type { Container } from './container.js';

/**
 * Long-polls Telegram for inbound /start and /link commands. Colocated with
 * the HTTP server for MVP simplicity (mirrors ManualDigestScheduler's
 * "no separate infra yet" deferral) — a real deployment could move this to
 * its own process without changing TelegramLinkingService or the bot layer.
 * No-ops without a bot token (e.g. in tests), so it never touches the network there.
 */
function launchTelegramLinkingBot(botToken: string, container: Container): void {
  const bot = new Telegraf(botToken);
  registerTelegramLinkingBot(bot, container.services.telegramLinking);
  bot.launch();

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

export async function buildApp() {
  const config = loadConfig();

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

  app.setErrorHandler(errorHandler);

  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(','),
    credentials: true,
  });

  await app.register(helmet);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
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
  const checkProvidersReady = async () => container.providerRegistry.getAll().length > 0;
  const checkAIReady = async () => container.aiProvider.validateConfig();

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

  return app;
}
