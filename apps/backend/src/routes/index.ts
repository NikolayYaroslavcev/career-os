import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth/auth-routes.js';
import { userRoutes } from './users/user-routes.js';
import { workspaceRoutes } from './workspaces/workspace-routes.js';
import { vacancyRoutes } from './vacancies/vacancy-routes.js';
import { applicationRoutes } from './applications/application-routes.js';
import { recruiterRoutes } from './recruiters/recruiter-routes.js';
import { resumeRoutes } from './resumes/resume-routes.js';
import { searchProfileRoutes } from './search-profiles/search-profile-routes.js';
import { intelligenceRoutes } from './intelligence/intelligence-routes.js';
import { telegramRoutes } from './telegram/telegram-routes.js';
import { diagnosticsRoutes } from './diagnostics/diagnostics-routes.js';
import { authMiddleware } from '../middleware/auth-middleware.js';

export async function apiRoutes(fastify: FastifyInstance) {
  fastify.register(async function v1(fastify) {
    // Public routes (no auth required)
    await fastify.register(authRoutes, { prefix: '/auth' });

    // Protected routes (auth required)
    await fastify.register(async function protectedRoutes(fastify) {
      fastify.addHook('onRequest', authMiddleware);
      await fastify.register(userRoutes, { prefix: '/users' });
      await fastify.register(workspaceRoutes, { prefix: '/workspaces' });
      await fastify.register(vacancyRoutes, { prefix: '/vacancies' });
      await fastify.register(applicationRoutes, { prefix: '/applications' });
      await fastify.register(recruiterRoutes, { prefix: '/recruiters' });
      await fastify.register(resumeRoutes, { prefix: '/resumes' });
      await fastify.register(searchProfileRoutes, { prefix: '/search-profiles' });
      await fastify.register(intelligenceRoutes, { prefix: '/intelligence' });
      await fastify.register(telegramRoutes, { prefix: '/telegram' });
      await fastify.register(diagnosticsRoutes, { prefix: '/diagnostics' });
    });
  }, { prefix: '/api/v1' });
}
