import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { createMockPrismaClient, type MockPrismaClient } from './mock-prisma.js';
import { createMockRedis, type MockRedis } from './mock-redis.js';
import { createMockAuthProvider, type MockAuthProvider } from './mock-auth.js';

export interface TestAppContext {
  prisma: MockPrismaClient;
  redis: MockRedis;
  authProvider: MockAuthProvider;
  app: FastifyInstance;
}

export function createTestApp(): TestAppContext {
  const prisma = createMockPrismaClient();
  const redis = createMockRedis();
  const authProvider = createMockAuthProvider();

  const app = Fastify({
    logger: false,
  });

  app.decorate('prisma', prisma);
  app.decorate('redis', redis);
  app.decorate('authProvider', authProvider);

  return { prisma, redis, authProvider, app };
}

export async function buildTestApp(): Promise<TestAppContext> {
  const ctx = createTestApp();
  await ctx.app.ready();
  return ctx;
}
