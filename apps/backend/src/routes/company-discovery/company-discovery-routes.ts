import type { FastifyInstance } from 'fastify';
import type { CompanyCandidateStatus } from '@careeros/company-watch';
import { createUserId } from '@careeros/career';
import { UnauthorizedError, NotFoundError, ValidationError } from '../../middleware/error-handler.js';
import { requireAdmin } from '../../middleware/require-role.js';

const CANDIDATE_STATUSES: readonly CompanyCandidateStatus[] = [
  'DISCOVERED',
  'AUTO_APPROVED',
  'REVIEW_REQUIRED',
  'REJECTED',
  'CONVERTED',
];

function requireUserId(request: { user?: { id: string } }): string {
  if (!request.user) throw new UnauthorizedError('User not authenticated');
  return request.user.id;
}

async function getWorkspaceId(fastify: FastifyInstance, userId: string): Promise<string> {
  const user = await fastify.container.repositories.user.findById(createUserId(userId));
  if (!user) throw new NotFoundError('User workspace');
  const [workspaceId] = user.workspaceIds;
  if (!workspaceId) throw new NotFoundError('User workspace');
  return workspaceId;
}

function parseStatuses(raw: string | undefined): CompanyCandidateStatus[] {
  if (!raw) return ['REVIEW_REQUIRED'];
  const requested = raw.split(',').map((s) => s.trim());
  const invalid = requested.filter((s) => !CANDIDATE_STATUSES.includes(s as CompanyCandidateStatus));
  if (invalid.length > 0) {
    throw new ValidationError(`Invalid status filter: ${invalid.join(', ')}`);
  }
  return requested as CompanyCandidateStatus[];
}

/**
 * ADR-035 Phase 2: single-shot discovery + review queue. No bulk-source
 * ingestion routes here — those are Phase 4 (§1/§14).
 */
export async function companyDiscoveryRoutes(fastify: FastifyInstance): Promise<void> {
  // List candidates, defaulting to the review queue (ADR §5: REVIEW_REQUIRED).
  fastify.get('/', async (request, reply) => {
    requireUserId(request);
    const query = request.query as { status?: string; limit?: string; offset?: string };
    const statuses = parseStatuses(query.status);
    const candidates = await fastify.container.repositories.companyCandidate.findAllByStatus(statuses, {
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });
    return reply.send(candidates);
  });

  fastify.get('/diagnostics', { preHandler: requireAdmin }, async (request, reply) => {
    requireUserId(request);
    const snapshot = await fastify.container.companyDiscoveryDiagnostics.getSnapshot();
    return reply.send(snapshot);
  });

  fastify.get('/:id', async (request, reply) => {
    requireUserId(request);
    const { id } = request.params as { id: string };
    const candidate = await fastify.container.repositories.companyCandidate.findById(id);
    if (!candidate) throw new NotFoundError('Company candidate');
    return reply.send(candidate);
  });

  // Trigger single-shot discovery for a URL (ADR §1: the dashboard's
  // "Discover" flow, now scored/staged as a CompanyCandidate instead of a
  // one-off, unpersisted DiscoveryResult).
  fastify.post('/', async (request, reply) => {
    requireUserId(request);
    const body = request.body as { companyName?: string; url?: string; discoverySource?: string };
    if (!body.companyName || !body.url) {
      throw new ValidationError('companyName and url are required');
    }

    const outcome = await fastify.container.services.companyDiscoveryIntake.discover({
      companyName: body.companyName,
      url: body.url,
      discoverySource: body.discoverySource,
    });

    return reply.status(201).send(outcome);
  });

  // Review-queue approval (ADR §5) — converts into the caller's own workspace.
  fastify.post('/:id/approve', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const { id } = request.params as { id: string };
    const companyWatch = await fastify.container.services.companyDiscoveryIntake.approve(id, workspaceId);
    return reply.send(companyWatch);
  });

  // Review-queue rejection (ADR §5) — reason feeds the §10 feedback loop.
  fastify.post('/:id/reject', async (request, reply) => {
    requireUserId(request);
    const { id } = request.params as { id: string };
    const body = request.body as { reason?: string };
    if (!body.reason) throw new ValidationError('reason is required');
    const candidate = await fastify.container.services.companyDiscoveryIntake.reject(id, body.reason);
    return reply.send(candidate);
  });
}
