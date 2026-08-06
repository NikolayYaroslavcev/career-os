import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '@careeros/career';
import { UnauthorizedError } from './error-handler.js';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  if (!token) {
    throw new UnauthorizedError('Invalid token');
  }

  const authProvider = (request.server as unknown as { authProvider: { verifyAccessToken: (t: string) => JwtPayload | null } }).authProvider;

  if (!authProvider) {
    throw new UnauthorizedError('Auth provider not configured');
  }

  const payload = authProvider.verifyAccessToken(token);

  if (!payload) {
    throw new UnauthorizedError('Invalid or expired token');
  }

  (request as unknown as { user: { id: string; email: string; role: UserRole } }).user = {
    id: payload.sub,
    email: payload.email,
    role: payload.role as UserRole,
  };
}
