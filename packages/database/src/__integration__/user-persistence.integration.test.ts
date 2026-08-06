import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { User as UserEntity, Email, createUserId } from '@careeros/career';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

runIf('User persistence (real Postgres)', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let PrismaUserRepository: typeof import('../infrastructure/prisma-user-repository.js').PrismaUserRepository;
  let PrismaRefreshTokenRepository: typeof import('../infrastructure/prisma-refresh-token-repository.js').PrismaRefreshTokenRepository;
  const userIds: string[] = [];
  const workspaceIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../client.js'));
    ({ PrismaUserRepository } = await import('../infrastructure/prisma-user-repository.js'));
    ({ PrismaRefreshTokenRepository } = await import('../infrastructure/prisma-refresh-token-repository.js'));
  });

  afterAll(async () => {
    if (workspaceIds.length > 0) {
      await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it('creates a user, reads it back by id and by email, updates it, then deletes it', async () => {
    const repository = new PrismaUserRepository();
    const email = `integration-${crypto.randomUUID()}@example.test`;
    const user = UserEntity.create({
      id: createUserId(crypto.randomUUID()),
      email: Email.create(email),
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    userIds.push(user.id);

    await repository.save(user);

    const foundById = await repository.findById(user.id);
    expect(foundById).not.toBeNull();
    expect(foundById?.email.value).toBe(email);
    expect(foundById?.firstName).toBe('Ada');

    const foundByEmail = await repository.findByEmail(Email.create(email));
    expect(foundByEmail?.id).toBe(user.id);

    expect(await repository.exists(user.id)).toBe(true);

    user.updateName('Augusta', 'King');
    await repository.save(user);

    const updated = await repository.findById(user.id);
    expect(updated?.firstName).toBe('Augusta');
    expect(updated?.lastName).toBe('King');

    await repository.delete(user.id);

    expect(await repository.findById(user.id)).toBeNull();
    expect(await repository.exists(user.id)).toBe(false);
    userIds.splice(userIds.indexOf(user.id), 1);
  });

  it('rejects a second user with a duplicate email', async () => {
    const repository = new PrismaUserRepository();
    const email = `integration-dup-${crypto.randomUUID()}@example.test`;

    const first = UserEntity.create({
      id: createUserId(crypto.randomUUID()),
      email: Email.create(email),
      firstName: 'First',
      lastName: 'User',
    });
    userIds.push(first.id);
    await repository.save(first);

    const second = UserEntity.create({
      id: createUserId(crypto.randomUUID()),
      email: Email.create(email),
      firstName: 'Second',
      lastName: 'User',
    });

    await expect(repository.save(second)).rejects.toThrow();
    expect(await repository.exists(second.id)).toBe(false);
  });

  it('creates, looks up, and cascades away RefreshToken rows when the user is deleted', async () => {
    const userRepository = new PrismaUserRepository();
    const refreshTokenRepository = new PrismaRefreshTokenRepository();

    const user = UserEntity.create({
      id: createUserId(crypto.randomUUID()),
      email: Email.create(`integration-refresh-${crypto.randomUUID()}@example.test`),
      firstName: 'Refresh',
      lastName: 'Owner',
    });
    userIds.push(user.id);
    await userRepository.save(user);

    const token = `token-${crypto.randomUUID()}`;
    await refreshTokenRepository.create({
      id: crypto.randomUUID(),
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    const found = await refreshTokenRepository.findByToken(token);
    expect(found?.userId).toBe(user.id);

    await prisma.user.delete({ where: { id: user.id } });
    userIds.splice(userIds.indexOf(user.id), 1);

    expect(await refreshTokenRepository.findByToken(token)).toBeNull();
  });

  it('reflects workspace membership in workspaceIds and cascades away membership on user delete', async () => {
    const userRepository = new PrismaUserRepository();

    const user = UserEntity.create({
      id: createUserId(crypto.randomUUID()),
      email: Email.create(`integration-member-${crypto.randomUUID()}@example.test`),
      firstName: 'Member',
      lastName: 'User',
    });
    userIds.push(user.id);
    await userRepository.save(user);

    const workspace = await prisma.workspace.create({
      data: { name: `integration-test-${crypto.randomUUID()}` },
    });
    workspaceIds.push(workspace.id);
    await prisma.workspaceMember.create({
      data: { userId: user.id, workspaceId: workspace.id, role: 'MEMBER' },
    });

    const withWorkspace = await userRepository.findById(user.id);
    expect(withWorkspace?.workspaceIds.map(String)).toContain(workspace.id);

    await prisma.user.delete({ where: { id: user.id } });
    userIds.splice(userIds.indexOf(user.id), 1);

    const remainingMemberships = await prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
    });
    expect(remainingMemberships).toHaveLength(0);

    // The workspace itself is unaffected by the user's deletion.
    expect(await prisma.workspace.findUnique({ where: { id: workspace.id } })).not.toBeNull();
  });

  it('rolls back every write in a failed transaction (no partial user/token state survives)', async () => {
    const email = `integration-txn-${crypto.randomUUID()}@example.test`;
    const userId = crypto.randomUUID();

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: { id: userId, email, passwordHash: 'x' },
        });
        await tx.refreshToken.create({
          data: {
            id: crypto.randomUUID(),
            // Non-existent user id inside the same transaction: violates the
            // RefreshToken -> User foreign key and must abort everything above.
            userId: createUserId(crypto.randomUUID()),
            token: `token-${crypto.randomUUID()}`,
            expiresAt: new Date(Date.now() + 60_000),
          },
        });
      })
    ).rejects.toThrow();

    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
  });
});
