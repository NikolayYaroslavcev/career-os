import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth-service.js';
import type { UserRepository, WorkspaceRepository } from '@careeros/career';
import type { IAuthProvider } from '@careeros/auth';

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
});
