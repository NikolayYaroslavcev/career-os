import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth/auth-routes.js';
import { userRoutes } from './users/user-routes.js';
import { workspaceRoutes } from './workspaces/workspace-routes.js';
import { vacancyRoutes } from './vacancies/vacancy-routes.js';
import { applicationRoutes } from './applications/application-routes.js';
import { followUpRoutes } from './follow-ups/follow-up-routes.js';
import { recruiterRoutes } from './recruiters/recruiter-routes.js';
import { resumeRoutes } from './resumes/resume-routes.js';
import { searchProfileRoutes } from './search-profiles/search-profile-routes.js';
import { intelligenceRoutes } from './intelligence/intelligence-routes.js';
import { telegramRoutes } from './telegram/telegram-routes.js';
import { diagnosticsRoutes } from './diagnostics/diagnostics-routes.js';
import { syncRoutes } from './sync/sync-routes.js';
import { linkedinIngestRoutes } from './providers/linkedin-ingest-routes.js';
import { dashboardRoutes } from './dashboard/dashboard-routes.js';
import { companyWatchRoutes } from './company-watch/company-watch-routes.js';
import { companyDiscoveryRoutes } from './company-discovery/company-discovery-routes.js';
import { aiRoutes } from './ai/ai-routes.js';
import { extensionRoutes } from './extension/extension-routes.js';
import { matchExplanationRoutes } from './match-explanation/match-explanation-routes.js';
import { careerIntelligenceRoutes } from './career-intelligence/career-intelligence-routes.js';
import { providerManagementRoutes } from './providers/provider-management-routes.js';
import { recommendationRoutes } from './recommendations/recommendation-routes.js';
import { authMiddleware } from '../middleware/auth-middleware.js';

export async function apiRoutes(fastify: FastifyInstance): Promise<void> {
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
      await fastify.register(followUpRoutes, { prefix: '/follow-ups' });
      await fastify.register(recruiterRoutes, { prefix: '/recruiters' });
      await fastify.register(resumeRoutes, { prefix: '/resumes' });
      await fastify.register(searchProfileRoutes, { prefix: '/search-profiles' });
      await fastify.register(intelligenceRoutes, { prefix: '/intelligence' });
      await fastify.register(telegramRoutes, { prefix: '/telegram' });
      await fastify.register(diagnosticsRoutes, { prefix: '/diagnostics' });
      await fastify.register(syncRoutes, { prefix: '/sync' });
      await fastify.register(linkedinIngestRoutes, { prefix: '/providers/linkedin' });
      await fastify.register(dashboardRoutes, { prefix: '/dashboard' });
      await fastify.register(companyWatchRoutes, { prefix: '/company-watch' });
      await fastify.register(companyDiscoveryRoutes, { prefix: '/company-discovery' });
      await fastify.register(aiRoutes, { prefix: '/ai' });
      await fastify.register(extensionRoutes, { prefix: '/extension' });
      await fastify.register(matchExplanationRoutes, { prefix: '/match-results' });
      await fastify.register(careerIntelligenceRoutes, { prefix: '/career-intelligence' });
      await fastify.register(providerManagementRoutes, { prefix: '/providers' });
      await fastify.register(recommendationRoutes, { prefix: '/recommendations' });
    });
  }, { prefix: '/api/v1' });
}
