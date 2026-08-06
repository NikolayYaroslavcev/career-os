import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth-service.js';
import type { UserRepository, WorkspaceRepository } from '@careeros/career';
import type { IAuthProvider } from '@careeros/auth';
import { createUserId } from '@careeros/career';

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const mockTx = {
    user: { create: vi.fn() },
    workspace: { create: vi.fn() },
    refreshToken: { create: vi.fn() },
  };
  const mockPrisma = {
    $transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<void>) => cb(mockTx)),
    user: { update: vi.fn(), findUnique: vi.fn() },
  };
  return { mockPrisma, mockTx };
});

vi.mock('@careeros/database', () => ({ prisma: mockPrisma }));

describe('AuthService.register', () => {
  const userRepository: Pick<UserRepository, 'findByEmail' | 'save'> = {
    findByEmail: vi.fn().mockResolvedValue(null),
    save: vi.fn(),
  };
  const workspaceRepository: Pick<WorkspaceRepository, 'save'> = {
    save: vi.fn(),
  };
  const refreshTokenRepository = {
    create: vi.fn(),
    findByToken: vi.fn(),
    delete: vi.fn(),
    deleteAllForUser: vi.fn(),
  };
  const authProvider = {
    hashPassword: vi.fn().mockResolvedValue('hashed-password'),
    verifyPassword: vi.fn(),
    generateAccessToken: vi.fn().mockReturnValue('access-token'),
    generateRefreshToken: vi.fn().mockResolvedValue({
      id: 'rt-1',
      userId: 'will-be-overwritten',
      token: 'refresh-token',
      expiresAt: new Date('2026-08-01'),
      createdAt: new Date('2026-07-24'),
    }),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepository.findByEmail = vi.fn().mockResolvedValue(null);
    authProvider.hashPassword.mockResolvedValue('hashed-password');
    authProvider.generateAccessToken.mockReturnValue('access-token');
    authProvider.generateRefreshToken.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      token: 'refresh-token',
      expiresAt: new Date('2026-08-01'),
      createdAt: new Date('2026-07-24'),
    });
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<void>) => cb(mockTx));

    service = new AuthService(
      authProvider as unknown as IAuthProvider,
      userRepository as unknown as UserRepository,
      workspaceRepository as unknown as WorkspaceRepository,
      refreshTokenRepository
    );
  });

  it('creates the user, workspace, and refresh token inside a single transaction', async () => {
    await service.register({
      email: 'jane@example.com',
      password: 'p4ssw0rd!',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'jane@example.com', passwordHash: 'hashed-password' }),
      })
    );
    expect(mockTx.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          members: { create: [expect.objectContaining({ role: 'OWNER' })] },
        }),
      })
    );
    expect(mockTx.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('hashes the plaintext password before it is ever persisted', async () => {
    await service.register({
      email: 'jane@example.com',
      password: 'p4ssw0rd!',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(authProvider.hashPassword).toHaveBeenCalledWith('p4ssw0rd!');
    expect(mockTx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ password: expect.anything() }),
      })
    );
    expect(mockTx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ passwordHash: 'hashed-password' }) })
    );
  });

  it('signs the access token with the new user\'s id and email as the JWT payload', async () => {
    await service.register({
      email: 'jane@example.com',
      password: 'p4ssw0rd!',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(authProvider.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@example.com' })
    );
    const [payload] = authProvider.generateAccessToken.mock.calls[0] as [{ sub: string; email: string }];
    expect(payload.sub).toEqual(expect.any(String));
    expect(payload.sub.length).toBeGreaterThan(0);
  });

  it('does not leave a partially-created account when a write inside the transaction fails', async () => {
    mockTx.workspace.create.mockRejectedValueOnce(new Error('db exploded'));
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<void>) => cb(mockTx));

    await expect(
      service.register({
        email: 'jane@example.com',
        password: 'p4ssw0rd!',
        firstName: 'Jane',
        lastName: 'Doe',
      })
    ).rejects.toThrow('db exploded');

    // The refresh token write must never be reached once an earlier write in
    // the same transaction has failed — Postgres rolls the whole thing back,
    // but this also proves register() has no code path that could apply the
    // writes as independent, partially-succeeding steps.
    expect(mockTx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects registration when the email is already taken, before any write happens', async () => {
    userRepository.findByEmail = vi.fn().mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.register({
        email: 'jane@example.com',
        password: 'p4ssw0rd!',
        firstName: 'Jane',
        lastName: 'Doe',
      })
    ).rejects.toThrow();

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects registration with a 409-mapped ConflictError (not a generic error)', async () => {
    userRepository.findByEmail = vi.fn().mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.register({
        email: 'jane@example.com',
        password: 'p4ssw0rd!',
        firstName: 'Jane',
        lastName: 'Doe',
      })
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
  });
});

describe('AuthService.login', () => {
  const userId = createUserId('11111111-1111-4111-8111-111111111111');
  const email = { value: 'jane@example.com' };
  const existingUser = { id: userId, email };

  const userRepository: Pick<UserRepository, 'findByEmail'> = {
    findByEmail: vi.fn().mockResolvedValue(existingUser),
  };
  const refreshTokenRepository = {
    create: vi.fn(),
    findByToken: vi.fn(),
    delete: vi.fn(),
    deleteAllForUser: vi.fn(),
  };
  const authProvider = {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    generateAccessToken: vi.fn().mockReturnValue('access-token'),
    generateRefreshToken: vi.fn().mockResolvedValue({
      id: 'rt-1',
      userId,
      token: 'refresh-token',
      expiresAt: new Date('2026-08-09'),
      createdAt: new Date('2026-08-02'),
    }),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepository.findByEmail = vi.fn().mockResolvedValue(existingUser);
    mockPrisma.user.findUnique = vi.fn().mockResolvedValue({ passwordHash: 'stored-hash' });
    authProvider.verifyPassword.mockResolvedValue(true);
    authProvider.generateAccessToken.mockReturnValue('access-token');
    authProvider.generateRefreshToken.mockResolvedValue({
      id: 'rt-1',
      userId,
      token: 'refresh-token',
      expiresAt: new Date('2026-08-09'),
      createdAt: new Date('2026-08-02'),
    });
    refreshTokenRepository.create.mockResolvedValue(undefined);

    service = new AuthService(
      authProvider as unknown as IAuthProvider,
      userRepository as unknown as UserRepository,
      {} as WorkspaceRepository,
      refreshTokenRepository
    );
  });

  it('returns tokens and persists the refresh token on a correct password', async () => {
    const result = await service.login({ email: 'jane@example.com', password: 'correct-password' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user).toEqual({ id: userId, email: 'jane@example.com' });
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'refresh-token', userId })
    );
  });

  it('signs the access token JWT payload with the user\'s sub and email', async () => {
    await service.login({ email: 'jane@example.com', password: 'correct-password' });

    expect(authProvider.generateAccessToken).toHaveBeenCalledWith({ sub: userId, email: 'jane@example.com' });
  });

  it('rejects an unknown user without revealing whether the account exists', async () => {
    userRepository.findByEmail = vi.fn().mockResolvedValue(null);

    await expect(
      service.login({ email: 'ghost@example.com', password: 'anything' })
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });

    expect(authProvider.verifyPassword).not.toHaveBeenCalled();
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a wrong password with the same generic message as an unknown user', async () => {
    authProvider.verifyPassword.mockResolvedValue(false);

    await expect(
      service.login({ email: 'jane@example.com', password: 'wrong-password' })
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });

    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  it('rejects login when the user record has no password hash set', async () => {
    mockPrisma.user.findUnique = vi.fn().mockResolvedValue(null);

    await expect(
      service.login({ email: 'jane@example.com', password: 'anything' })
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(authProvider.verifyPassword).not.toHaveBeenCalled();
  });

  it('verifies the submitted password against the stored hash, not the plaintext', async () => {
    await service.login({ email: 'jane@example.com', password: 'correct-password' });

    expect(authProvider.verifyPassword).toHaveBeenCalledWith('stored-hash', 'correct-password');
  });
});

describe('AuthService.refresh', () => {
  const userId = 'user-1';
  const activeUser = { id: userId, email: { value: 'jane@example.com' } };

  const userRepository: Pick<UserRepository, 'findById'> = {
    findById: vi.fn().mockResolvedValue(activeUser),
  };
  const refreshTokenRepository = {
    create: vi.fn(),
    findByToken: vi.fn(),
    delete: vi.fn(),
    deleteAllForUser: vi.fn(),
  };
  const authProvider = {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    generateAccessToken: vi.fn().mockReturnValue('new-access-token'),
    generateRefreshToken: vi.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepository.findById = vi.fn().mockResolvedValue(activeUser);
    authProvider.generateAccessToken.mockReturnValue('new-access-token');
    authProvider.generateRefreshToken.mockResolvedValue({
      id: 'rt-2',
      userId,
      token: 'new-refresh-token',
      expiresAt: new Date('2026-08-09'),
      createdAt: new Date('2026-08-02'),
    });
    refreshTokenRepository.create.mockResolvedValue(undefined);
    refreshTokenRepository.delete.mockResolvedValue(undefined);

    service = new AuthService(
      authProvider as unknown as IAuthProvider,
      userRepository as unknown as UserRepository,
      {} as WorkspaceRepository,
      refreshTokenRepository
    );
  });

  it('rejects an unknown refresh token', async () => {
    refreshTokenRepository.findByToken.mockResolvedValue(null);

    await expect(service.refresh('bogus-token')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid refresh token',
    });
    expect(refreshTokenRepository.delete).not.toHaveBeenCalled();
  });

  it('rejects and deletes an expired refresh token', async () => {
    refreshTokenRepository.findByToken.mockResolvedValue({
      id: 'rt-1',
      userId,
      token: 'stale-token',
      expiresAt: new Date('2020-01-01'),
      createdAt: new Date('2019-12-25'),
    });

    await expect(service.refresh('stale-token')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Refresh token expired',
    });
    expect(refreshTokenRepository.delete).toHaveBeenCalledWith('stale-token');
    // An expired token must never mint new credentials.
    expect(authProvider.generateAccessToken).not.toHaveBeenCalled();
  });

  it('rejects a refresh token whose user no longer exists', async () => {
    refreshTokenRepository.findByToken.mockResolvedValue({
      id: 'rt-1',
      userId,
      token: 'orphaned-token',
      expiresAt: new Date('2099-01-01'),
      createdAt: new Date('2026-08-02'),
    });
    userRepository.findById = vi.fn().mockResolvedValue(null);

    await expect(service.refresh('orphaned-token')).rejects.toMatchObject({
      statusCode: 401,
      message: 'User not found',
    });
  });

  it('rotates the refresh token: deletes the old one and issues a new access+refresh pair', async () => {
    refreshTokenRepository.findByToken.mockResolvedValue({
      id: 'rt-1',
      userId,
      token: 'old-refresh-token',
      expiresAt: new Date('2099-01-01'),
      createdAt: new Date('2026-08-02'),
    });

    const result = await service.refresh('old-refresh-token');

    expect(refreshTokenRepository.delete).toHaveBeenCalledWith('old-refresh-token');
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'new-refresh-token', userId })
    );
    expect(result).toEqual({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
  });

  it('rejects reuse of an already-rotated (replayed) refresh token', async () => {
    // First call rotates the token out of the store.
    refreshTokenRepository.findByToken.mockResolvedValueOnce({
      id: 'rt-1',
      userId,
      token: 'one-time-token',
      expiresAt: new Date('2099-01-01'),
      createdAt: new Date('2026-08-02'),
    });
    await service.refresh('one-time-token');

    // Replaying the same (now-rotated) token must fail — the repository no
    // longer has a record for it.
    refreshTokenRepository.findByToken.mockResolvedValueOnce(null);
    await expect(service.refresh('one-time-token')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('signs the rotated access token with the JWT payload of the token owner, not the caller', async () => {
    refreshTokenRepository.findByToken.mockResolvedValue({
      id: 'rt-1',
      userId,
      token: 'old-refresh-token',
      expiresAt: new Date('2099-01-01'),
      createdAt: new Date('2026-08-02'),
    });

    await service.refresh('old-refresh-token');

    expect(authProvider.generateAccessToken).toHaveBeenCalledWith({ sub: userId, email: 'jane@example.com' });
  });

  it('handles two concurrent refresh attempts against the same token: the first wins, the second is rejected', async () => {
    // Model the repository as a real store would behave under Postgres:
    // delete() throws (like Prisma's P2025) when the row is already gone,
    // which is exactly what happens when a second concurrent caller tries
    // to rotate a token the first caller already consumed.
    const store = new Map<string, { id: string; userId: string; token: string; expiresAt: Date; createdAt: Date }>();
    store.set('shared-token', {
      id: 'rt-1',
      userId,
      token: 'shared-token',
      expiresAt: new Date('2099-01-01'),
      createdAt: new Date('2026-08-02'),
    });

    refreshTokenRepository.findByToken.mockImplementation(async (token: string) => store.get(token) ?? null);
    refreshTokenRepository.delete.mockImplementation(async (token: string) => {
      if (!store.has(token)) {
        throw new Error('Refresh token not found (P2025)');
      }
      store.delete(token);
    });
    refreshTokenRepository.create.mockImplementation(async (data: { token: string; id: string; userId: string; expiresAt: Date; createdAt: Date }) => {
      store.set(data.token, data);
    });

    let callCount = 0;
    authProvider.generateRefreshToken.mockImplementation(async () => {
      callCount += 1;
      return {
        id: `rt-${callCount}`,
        userId,
        token: `rotated-token-${callCount}`,
        expiresAt: new Date('2099-01-01'),
        createdAt: new Date('2026-08-02'),
      };
    });

    const [first, second] = await Promise.allSettled([
      service.refresh('shared-token'),
      service.refresh('shared-token'),
    ]);

    const outcomes = [first.status, second.status];
    expect(outcomes).toContain('fulfilled');
    expect(outcomes).toContain('rejected');
    expect(outcomes.filter((status) => status === 'fulfilled')).toHaveLength(1);
  });
});

describe('AuthService.logout', () => {
  const refreshTokenRepository = {
    create: vi.fn(),
    findByToken: vi.fn(),
    delete: vi.fn(),
    deleteAllForUser: vi.fn(),
  };
  const authProvider = {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    generateAccessToken: vi.fn(),
    generateRefreshToken: vi.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      authProvider as unknown as IAuthProvider,
      {} as UserRepository,
      {} as WorkspaceRepository,
      refreshTokenRepository
    );
  });

  it('revokes the given refresh token when it exists', async () => {
    refreshTokenRepository.findByToken.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      token: 'active-token',
      expiresAt: new Date('2099-01-01'),
      createdAt: new Date('2026-08-02'),
    });

    await service.logout('active-token');

    expect(refreshTokenRepository.delete).toHaveBeenCalledWith('active-token');
  });

  it('is idempotent: logging out an already-revoked or unknown token does not throw', async () => {
    refreshTokenRepository.findByToken.mockResolvedValue(null);

    await expect(service.logout('already-gone-token')).resolves.toBeUndefined();
    expect(refreshTokenRepository.delete).not.toHaveBeenCalled();
  });
});

describe('AuthService.logoutAll (multiple active sessions)', () => {
  const refreshTokenRepository = {
    create: vi.fn(),
    findByToken: vi.fn(),
    delete: vi.fn(),
    deleteAllForUser: vi.fn(),
  };
  const authProvider = {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    generateAccessToken: vi.fn(),
    generateRefreshToken: vi.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      authProvider as unknown as IAuthProvider,
      {} as UserRepository,
      {} as WorkspaceRepository,
      refreshTokenRepository
    );
  });

  it('revokes every refresh token belonging to the user in one call', async () => {
    await service.logoutAll('user-1');

    expect(refreshTokenRepository.deleteAllForUser).toHaveBeenCalledWith('user-1');
    expect(refreshTokenRepository.deleteAllForUser).toHaveBeenCalledTimes(1);
  });

  it('does not touch a single-session logout path (deleteAllForUser is the only call made)', async () => {
    await service.logoutAll('user-1');

    expect(refreshTokenRepository.delete).not.toHaveBeenCalled();
  });
});

describe('AuthService.getUserById / updateProfile', () => {
  const userRepository: Pick<UserRepository, 'findById' | 'save'> = {
    findById: vi.fn(),
    save: vi.fn(),
  };
  const authProvider = {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    generateAccessToken: vi.fn(),
    generateRefreshToken: vi.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      authProvider as unknown as IAuthProvider,
      userRepository as unknown as UserRepository,
      {} as WorkspaceRepository,
      { create: vi.fn(), findByToken: vi.fn(), delete: vi.fn(), deleteAllForUser: vi.fn() }
    );
  });

  it('throws NotFoundError (404-mapped) for an unknown user id', async () => {
    userRepository.findById = vi.fn().mockResolvedValue(null);

    await expect(service.getUserById('missing-user')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates only the provided profile fields, defaulting the rest to current values', async () => {
    const user = {
      id: 'user-1',
      email: { value: 'jane@example.com' },
      firstName: 'Jane',
      lastName: 'Doe',
      updateName: vi.fn(function (this: { firstName: string; lastName: string }, firstName: string, lastName: string) {
        this.firstName = firstName;
        this.lastName = lastName;
      }),
    };
    userRepository.findById = vi.fn().mockResolvedValue(user);

    const result = await service.updateProfile('user-1', { firstName: 'Janet' });

    expect(user.updateName).toHaveBeenCalledWith('Janet', 'Doe');
    expect(userRepository.save).toHaveBeenCalledWith(user);
    expect(result.firstName).toBe('Janet');
  });
});
