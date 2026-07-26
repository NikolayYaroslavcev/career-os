import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('../container.js', () => ({
  buildContainer: vi.fn().mockReturnValue({
    repositories: { user: {} },
    authProvider: {},
    providerRegistry: { getAll: vi.fn().mockReturnValue([]) },
    aiProvider: { validateConfig: vi.fn().mockReturnValue(false) },
    aiOrchestrator: {},
    applicationService: {},
    services: { syncScheduler: { startAll: vi.fn() } },
  }),
}));

vi.mock('@careeros/database', () => ({
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  prisma: {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    workspace: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('@careeros/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@careeros/shared')>();
  return {
    ...original,
    loadConfig: vi.fn().mockReturnValue({
      NODE_ENV: 'test',
      PORT: 3000,
      HOST: '0.0.0.0',
      LOG_LEVEL: 'warn',
      CORS_ORIGIN: 'http://localhost:3000',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      AI_PROVIDER: 'openai',
    }),
    checkRedisHealth: vi.fn().mockResolvedValue(true),
    getRedis: vi.fn().mockReturnValue({
      ping: vi.fn().mockResolvedValue('PONG'),
      set: vi.fn().mockResolvedValue('OK'),
      rateLimit: vi.fn((_key: string, timeWindow: number, _max: number, _c: boolean, _e: boolean, cb: (err: null, result: [number, number]) => void) => {
        cb(null, [1, timeWindow]);
      }),
    }),
    runHealthChecks: vi.fn().mockResolvedValue({ status: 'healthy', checks: {}, timestamp: new Date().toISOString(), uptime: 0 }),
  };
});

vi.mock('@careeros/telegram', () => ({
  InMemoryTelegramClient: vi.fn(),
  TelegramAdapter: vi.fn(),
  registerTelegramLinkingBot: vi.fn(),
}));

describe('buildApp AI configuration warning', () => {
  let app: FastifyInstance | undefined;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.MASTER_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  afterEach(async () => {
    if (app) await app.close();
    app = undefined;
    process.env = originalEnv;
  });

  it('logs a warning at startup when the AI provider is not configured', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const { buildApp } = await import('../app.js');
    app = await buildApp();

    const logged = writeSpy.mock.calls.map((call) => String(call[0])).join('\n');
    writeSpy.mockRestore();

    expect(logged).toContain('AI provider is not configured');
    expect(logged).toContain('openai');
  }, 20_000);
});
