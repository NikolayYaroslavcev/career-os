import type { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@careeros/career';
import { ForbiddenError, UnauthorizedError } from './error-handler.js';

/**
 * Centralized role guard. Runs after authMiddleware (which populates
 * request.user), so a missing user here means the guard was mounted on a
 * route/plugin that skipped the auth hook — treated as 401, not 403.
 *
 * Usable as a whole-plugin `onRequest` hook (`fastify.addHook('onRequest', requireAdmin)`)
 * or per-route via `{ preHandler: requireAdmin }`.
 */
export function requireRole(...allowedRoles: readonly UserRole[]): (request: FastifyRequest, _reply: FastifyReply) => Promise<void> {
  return async function roleGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('User not authenticated');
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
}

export const requireAdmin = requireRole(UserRole.ADMIN);
