import type { FastifyInstance } from 'fastify';

export async function extensionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/status', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      version: '0.1.0',
      serverVersion: '0.1.0',
      features: [
        'vacancy-detection',
        'vacancy-save',
        'apply-tracking',
        'ai-analysis',
        'ai-resume-tailor',
        'ai-cover-letter',
        'ai-interview-prep',
        'company-watch',
        'notifications',
        'offline-queue',
      ],
    });
  });
}
