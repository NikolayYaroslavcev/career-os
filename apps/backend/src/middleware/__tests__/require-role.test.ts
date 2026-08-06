import { describe, it, expect } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { UserRole } from '@careeros/career';
import { requireRole, requireAdmin } from '../require-role.js';
import { ForbiddenError, UnauthorizedError } from '../error-handler.js';

function createRequest(user?: { id: string; email: string; role: UserRole }): FastifyRequest {
  return { user } as unknown as FastifyRequest;
}

const reply = {} as FastifyReply;

describe('requireRole', () => {
  it('rejects with 401 when request.user is missing (guard mounted without authMiddleware having run)', async () => {
    const guard = requireRole(UserRole.ADMIN);
    const request = createRequest(undefined);

    await expect(guard(request, reply)).rejects.toThrow(UnauthorizedError);
    await expect(guard(request, reply)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects with 403 when the authenticated user role is not in the allowed list', async () => {
    const guard = requireRole(UserRole.ADMIN);
    const request = createRequest({ id: 'user-1', email: 'user@example.com', role: UserRole.JOB_SEEKER });

    await expect(guard(request, reply)).rejects.toThrow(ForbiddenError);
    await expect(guard(request, reply)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('resolves without throwing when the user role is in the allowed list', async () => {
    const guard = requireRole(UserRole.ADMIN);
    const request = createRequest({ id: 'admin-1', email: 'admin@example.com', role: UserRole.ADMIN });

    await expect(guard(request, reply)).resolves.toBeUndefined();
  });

  it('accepts any role in a multi-role allowlist', async () => {
    const guard = requireRole(UserRole.ADMIN, UserRole.RECRUITER);
    const recruiter = createRequest({ id: 'r-1', email: 'r@example.com', role: UserRole.RECRUITER });
    const jobSeeker = createRequest({ id: 'j-1', email: 'j@example.com', role: UserRole.JOB_SEEKER });

    await expect(guard(recruiter, reply)).resolves.toBeUndefined();
    await expect(guard(jobSeeker, reply)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('requireAdmin', () => {
  it('is a requireRole(UserRole.ADMIN) guard: rejects non-admins with 403', async () => {
    const request = createRequest({ id: 'user-1', email: 'user@example.com', role: UserRole.RECRUITER });

    await expect(requireAdmin(request, reply)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows admins through', async () => {
    const request = createRequest({ id: 'admin-1', email: 'admin@example.com', role: UserRole.ADMIN });

    await expect(requireAdmin(request, reply)).resolves.toBeUndefined();
  });
});
