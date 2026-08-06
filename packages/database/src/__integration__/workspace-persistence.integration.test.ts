import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Workspace as WorkspaceEntity, createWorkspaceId, createUserId } from '@careeros/career';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

runIf('Workspace persistence (real Postgres)', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let PrismaWorkspaceRepository: typeof import('../infrastructure/prisma-workspace-repository.js').PrismaWorkspaceRepository;
  const workspaceIds: string[] = [];
  const userIds: string[] = [];

  async function createTestUser(): Promise<string> {
    const user = await prisma.user.create({
      data: { email: `integration-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
    });
    userIds.push(user.id);
    return user.id;
  }

  beforeAll(async () => {
    ({ prisma } = await import('../client.js'));
    ({ PrismaWorkspaceRepository } = await import('../infrastructure/prisma-workspace-repository.js'));
  });

  afterAll(async () => {
    if (workspaceIds.length > 0) {
      await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it('creates a workspace with an OWNER member, reads it back, and deletes it', async () => {
    const repository = new PrismaWorkspaceRepository();
    const ownerId = await createTestUser();

    const workspace = WorkspaceEntity.create({
      id: createWorkspaceId(crypto.randomUUID()),
      name: 'Integration Test Workspace',
      ownerId: createUserId(ownerId),
    });
    workspaceIds.push(workspace.id);

    await repository.save(workspace);

    const found = await repository.findById(workspace.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Integration Test Workspace');
    expect(found?.ownerId).toBe(ownerId);
    expect(found?.getMemberRole(createUserId(ownerId))).toBe('OWNER');

    const byOwner = await repository.findByOwnerId(createUserId(ownerId));
    expect(byOwner.map((w) => w.id)).toContain(workspace.id);

    await repository.delete(workspace.id);
    expect(await repository.exists(workspace.id)).toBe(false);
    workspaceIds.splice(workspaceIds.indexOf(workspace.id), 1);
  });

  it('persists membership additions, role updates, and an invite-flow member add', async () => {
    const repository = new PrismaWorkspaceRepository();
    const ownerId = await createTestUser();
    const inviteeId = await createTestUser();

    const workspace = WorkspaceEntity.create({
      id: createWorkspaceId(crypto.randomUUID()),
      name: 'Role Update Workspace',
      ownerId: createUserId(ownerId),
    });
    workspaceIds.push(workspace.id);
    await repository.save(workspace);

    // Simulates the invite-acceptance flow (workspace-service.inviteMember): the
    // invited user is resolved by email, then added as a plain MEMBER.
    workspace.addMember(createUserId(inviteeId), 'MEMBER');
    await repository.save(workspace);

    const afterInvite = await repository.findById(workspace.id);
    expect(afterInvite?.getMemberRole(createUserId(inviteeId))).toBe('MEMBER');
    expect(afterInvite?.memberIds).toHaveLength(2);

    const byMember = await repository.findByMemberId(createUserId(inviteeId));
    expect(byMember.map((w) => w.id)).toContain(workspace.id);

    afterInvite!.updateMemberRole(createUserId(inviteeId), 'ADMIN');
    await repository.save(afterInvite!);

    const afterRoleUpdate = await repository.findById(workspace.id);
    expect(afterRoleUpdate?.getMemberRole(createUserId(inviteeId))).toBe('ADMIN');
  });

  it('rejects a duplicate WorkspaceMember row for the same user + workspace pair', async () => {
    const ownerId = await createTestUser();
    const workspace = await prisma.workspace.create({ data: { name: `integration-test-${crypto.randomUUID()}` } });
    workspaceIds.push(workspace.id);

    await prisma.workspaceMember.create({
      data: { userId: ownerId, workspaceId: workspace.id, role: 'OWNER' },
    });

    await expect(
      prisma.workspaceMember.create({
        data: { userId: ownerId, workspaceId: workspace.id, role: 'MEMBER' },
      })
    ).rejects.toThrow();
  });

  it('cascades away WorkspaceMember rows when the workspace is deleted', async () => {
    const repository = new PrismaWorkspaceRepository();
    const ownerId = await createTestUser();

    const workspace = WorkspaceEntity.create({
      id: createWorkspaceId(crypto.randomUUID()),
      name: 'Cascade Delete Workspace',
      ownerId: createUserId(ownerId),
    });
    await repository.save(workspace);

    await repository.delete(workspace.id);

    const remainingMemberships = await prisma.workspaceMember.findMany({ where: { workspaceId: workspace.id } });
    expect(remainingMemberships).toHaveLength(0);
    // The user itself is unaffected by the workspace's deletion.
    expect(await prisma.user.findUnique({ where: { id: ownerId } })).not.toBeNull();
  });

  it('rolls back the whole save() transaction when one member upsert violates a foreign key', async () => {
    const repository = new PrismaWorkspaceRepository();
    const ownerId = await createTestUser();

    const workspace = WorkspaceEntity.create({
      id: createWorkspaceId(crypto.randomUUID()),
      name: 'Original Name',
      ownerId: createUserId(ownerId),
    });
    workspaceIds.push(workspace.id);
    await repository.save(workspace);

    // Rename and add a member that does not exist in the User table: the
    // workspaceMember upsert should violate its FK and abort the whole
    // $transaction inside WorkspaceRepository.save, including the rename.
    workspace.rename('Renamed During Failed Transaction');
    workspace.addMember(createUserId(crypto.randomUUID()), 'MEMBER');

    await expect(repository.save(workspace)).rejects.toThrow();

    const found = await repository.findById(workspace.id);
    expect(found?.name).toBe('Original Name');
    expect(found?.memberIds).toHaveLength(1);
  });
});
