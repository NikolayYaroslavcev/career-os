import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import { workspaceRoutes } from '../workspaces/workspace-routes.js';
import { errorHandler } from '../../middleware/error-handler.js';
import type { Container } from '../../container.js';

function createMockContainer(): Container {
  return {
    services: {
      workspace: {
        listForUser: vi.fn().mockResolvedValue([{ id: 'ws-1', name: 'My Workspace', role: 'OWNER' }]),
        create: vi.fn().mockResolvedValue({ id: 'ws-2', name: 'New Workspace', role: 'OWNER' }),
        inviteMember: vi.fn().mockResolvedValue(undefined),
        updateMemberRole: vi.fn().mockResolvedValue(undefined),
      },
    },
  } as unknown as Container;
}

describe('Workspace Routes', () => {
  let app: ReturnType<typeof Fastify>;
  let container: ReturnType<typeof createMockContainer>;

  beforeEach(async () => {
    container = createMockContainer();
    app = Fastify();
    app.decorate('container', container);
    app.setErrorHandler(errorHandler);
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-1', email: 'user-1@example.com' };
    });
    await app.register(workspaceRoutes, { prefix: '/api/v1/workspaces' });
    await app.ready();
  });

  it('GET / returns the workspaces for the authenticated user', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/workspaces' });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual([{ id: 'ws-1', name: 'My Workspace', role: 'OWNER' }]);
    expect(container.services.workspace.listForUser).toHaveBeenCalledWith('user-1');
  });

  it('POST / creates a workspace owned by the requester', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      payload: { name: 'New Workspace' },
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.payload)).toEqual({ id: 'ws-2', name: 'New Workspace' });
    expect(container.services.workspace.create).toHaveBeenCalledWith('user-1', 'New Workspace');
  });

  it('POST /:id/invite invites a member by email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces/ws-1/invite',
      payload: { email: 'someone@example.com', role: 'ADMIN' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ success: true });
    expect(container.services.workspace.inviteMember).toHaveBeenCalledWith(
      'ws-1',
      'user-1',
      'someone@example.com',
      'ADMIN'
    );
  });

  it('PUT /:id/members/:userId/role updates a member role', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/workspaces/ws-1/members/user-2/role',
      payload: { role: 'MEMBER' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ success: true });
    expect(container.services.workspace.updateMemberRole).toHaveBeenCalledWith('ws-1', 'user-1', 'user-2', 'MEMBER');
  });

  it('propagates a 403 when the service rejects the request', async () => {
    const { ForbiddenError } = await import('../../middleware/error-handler.js');
    (container.services.workspace.inviteMember as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ForbiddenError('Only workspace owners or admins can manage members')
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces/ws-1/invite',
      payload: { email: 'someone@example.com' },
    });

    expect(response.statusCode).toBe(403);
  });
});
