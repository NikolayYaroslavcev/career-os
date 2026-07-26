import type { FastifyInstance } from 'fastify';
import { createUserId } from '@careeros/career';
import { UnauthorizedError, NotFoundError } from '../../middleware/error-handler.js';

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

export async function companyWatchRoutes(fastify: FastifyInstance): Promise<void> {
  // Check if a company is watched by name
  fastify.get('/check', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const { companyName } = request.query as { companyName?: string };

    if (!companyName) {
      return reply.status(400).send({ error: 'companyName query parameter is required' });
    }

    const companyWatchService = fastify.container.services.companyWatch;
    const companies = await companyWatchService.listCompaniesByWorkspace(workspaceId);
    const matched = companies.find(c =>
      c.name.toLowerCase() === companyName.toLowerCase()
      || c.aliases?.some(a => a.toLowerCase() === companyName.toLowerCase())
    );

    return reply.send({
      watched: !!matched,
      companyId: matched?.id ?? null,
    });
  });

  // List all watched companies for workspace
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const companyWatchService = fastify.container.services.companyWatch;
    const companies = await companyWatchService.listCompaniesByWorkspace(workspaceId);
    return reply.send(companies);
  });

  // Get company by ID
  fastify.get('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const { id } = request.params as { id: string };
    const companyWatchService = fastify.container.services.companyWatch;
    const company = await companyWatchService.getOwned(id, workspaceId);
    if (!company) throw new NotFoundError('Company watch');
    return reply.send(company);
  });

  // Add company to watch list
  fastify.post('/', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const companyWatchService = fastify.container.services.companyWatch;
    const body = request.body as Record<string, unknown>;

    const company = await companyWatchService.addCompany({
      name: body.name as string,
      aliases: (body.aliases as string[]) || [],
      country: body.country as string | undefined,
      languages: (body.languages as string[]) || ['en'],
      tags: (body.tags as string[]) || [],
      atsType: body.atsType as 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'WORKDAY' | 'TEAMTAILOR' | 'SMARTRECRUITERS' | 'RECRUITEE' | 'PERSONIO' | 'BAMBOOHR' | 'CUSTOM_HTML' | 'JSON_LD',
      careerUrl: body.careerUrl as string,
      atsEndpoint: body.atsEndpoint as string | undefined,
      pollingInterval: (body.pollingInterval as number) || 3600,
      active: (body.active as boolean) !== false,
      metadata: body.metadata as Record<string, unknown> | undefined,
      workspaceId,
    });

    return reply.status(201).send(company);
  });

  // Update company
  fastify.put('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const { id } = request.params as { id: string };
    const companyWatchService = fastify.container.services.companyWatch;
    const body = request.body as Record<string, unknown>;

    const company = await companyWatchService.updateCompany(id, workspaceId, body as Partial<{
      name: string;
      aliases: string[];
      country: string;
      languages: string[];
      tags: string[];
      atsType: 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'WORKDAY' | 'TEAMTAILOR' | 'SMARTRECRUITERS' | 'RECRUITEE' | 'PERSONIO' | 'BAMBOOHR' | 'CUSTOM_HTML' | 'JSON_LD';
      careerUrl: string;
      atsEndpoint: string;
      pollingInterval: number;
      active: boolean;
      metadata: Record<string, unknown>;
    }>);

    if (!company) throw new NotFoundError('Company watch');
    return reply.send(company);
  });

  // Delete company
  fastify.delete('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const { id } = request.params as { id: string };
    const companyWatchService = fastify.container.services.companyWatch;
    const deleted = await companyWatchService.removeCompany(id, workspaceId);
    if (!deleted) throw new NotFoundError('Company watch');
    return reply.status(204).send();
  });

  // Trigger sync for a company
  fastify.post('/:id/sync', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const { id } = request.params as { id: string };
    const companyWatchService = fastify.container.services.companyWatch;
    const owned = await companyWatchService.getOwned(id, workspaceId);
    if (!owned) throw new NotFoundError('Company watch');
    const result = await companyWatchService.syncCompany(id);
    return reply.send(result);
  });

  // Get events for a company
  fastify.get('/:id/events', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const { id } = request.params as { id: string };
    const query = request.query as { type?: string; limit?: string; offset?: string };
    const companyWatchService = fastify.container.services.companyWatch;

    const owned = await companyWatchService.getOwned(id, workspaceId);
    if (!owned) throw new NotFoundError('Company watch');

    const events = await companyWatchService.getCompanyEvents(id, {
      type: query.type,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return reply.send(events);
  });

  // Discover ATS from URL
  fastify.post('/discover', async (request, reply) => {
    const { url } = request.body as { url: string };
    const { CompanyDiscoveryService } = await import('@careeros/company-watch');
    const discoveryService = new CompanyDiscoveryService();
    const result = await discoveryService.discover(url);
    return reply.send(result);
  });
}
