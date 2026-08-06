import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { authMiddleware } from '../auth-middleware.js';
import { UnauthorizedError } from '../error-handler.js';

function createRequest(headers: Record<string, string | undefined>, authProvider?: unknown): FastifyRequest {
  return {
    headers,
    server: { authProvider },
  } as unknown as FastifyRequest;
}

const reply = {} as FastifyReply;

describe('authMiddleware', () => {
  let verifyAccessToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    verifyAccessToken = vi.fn();
  });

  it('rejects a request with no Authorization header', async () => {
    const request = createRequest({}, { verifyAccessToken });

    await expect(authMiddleware(request, reply)).rejects.toThrow(UnauthorizedError);
    await expect(authMiddleware(request, reply)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Missing or invalid authorization header',
    });
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects an Authorization header that does not use the Bearer scheme', async () => {
    const request = createRequest({ authorization: 'Basic dXNlcjpwYXNz' }, { verifyAccessToken });

    await expect(authMiddleware(request, reply)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Missing or invalid authorization header',
    });
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects a bare "Bearer " header with no token', async () => {
    const request = createRequest({ authorization: 'Bearer ' }, { verifyAccessToken });

    await expect(authMiddleware(request, reply)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid token',
    });
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects when no authProvider is configured on the server instance', async () => {
    const request = createRequest({ authorization: 'Bearer some-token' }, undefined);

    await expect(authMiddleware(request, reply)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Auth provider not configured',
    });
  });

  it('rejects a malformed JWT (provider returns null, mirroring a jwt.verify parse failure)', async () => {
    verifyAccessToken.mockReturnValue(null);
    const request = createRequest({ authorization: 'Bearer not-a-jwt' }, { verifyAccessToken });

    await expect(authMiddleware(request, reply)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid or expired token',
    });
    expect(verifyAccessToken).toHaveBeenCalledWith('not-a-jwt');
  });

  it('rejects an expired JWT (provider returns null, mirroring jwt.verify TokenExpiredError)', async () => {
    verifyAccessToken.mockReturnValue(null);
    const request = createRequest({ authorization: 'Bearer expired.jwt.token' }, { verifyAccessToken });

    await expect(authMiddleware(request, reply)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('strips exactly the "Bearer " prefix, forwarding the raw token to the provider', async () => {
    verifyAccessToken.mockReturnValue({ sub: 'user-1', email: 'jane@example.com', iat: 0, exp: 999999999 });
    const request = createRequest({ authorization: 'Bearer abc.def.ghi' }, { verifyAccessToken });

    await authMiddleware(request, reply);

    expect(verifyAccessToken).toHaveBeenCalledWith('abc.def.ghi');
  });

  it('attaches { id, email } from the verified payload to request.user on success', async () => {
    verifyAccessToken.mockReturnValue({ sub: 'user-42', email: 'jane@example.com', iat: 0, exp: 999999999 });
    const request = createRequest({ authorization: 'Bearer valid.jwt.token' }, { verifyAccessToken });

    await authMiddleware(request, reply);

    expect((request as unknown as { user: { id: string; email: string } }).user).toEqual({
      id: 'user-42',
      email: 'jane@example.com',
    });
  });
});
