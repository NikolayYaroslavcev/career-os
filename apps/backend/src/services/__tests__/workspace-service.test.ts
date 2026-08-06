import { describe, it, expect, beforeEach } from 'vitest';
import { User, Email, createUserId } from '@careeros/career';
import { WorkspaceService } from '../workspace-service.js';
import { InMemoryWorkspaceRepository, InMemoryUserRepository } from '../../testing/in-memory-repositories.js';

describe('WorkspaceService', () => {
  let workspaceRepository: InMemoryWorkspaceRepository;
  let userRepository: InMemoryUserRepository;
  let service: WorkspaceService;

  const ownerId = createUserId('owner-1');
  const memberEmail = 'member@example.com';

  beforeEach(async () => {
    workspaceRepository = new InMemoryWorkspaceRepository();
    userRepository = new InMemoryUserRepository();
    service = new WorkspaceService(workspaceRepository, userRepository);

    await userRepository.save(
      User.create({
        id: createUserId('member-1'),
        email: Email.create(memberEmail),
        firstName: 'Member',
        lastName: 'User',
      })
    );
  });

  it('creates a workspace with the creator as OWNER', async () => {
    const workspace = await service.create(ownerId, 'My Workspace');

    expect(workspace.name).toBe('My Workspace');
    expect(workspace.role).toBe('OWNER');

    const listed = await service.listForUser(ownerId);
    expect(listed).toEqual([workspace]);
  });

  it('only lists workspaces the user is a member of', async () => {
    await service.create(ownerId, 'Owner Workspace');
    await service.create('other-user', 'Someone Else Workspace');

    const listed = await service.listForUser(ownerId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe('Owner Workspace');
  });

  it('lets an OWNER invite an existing user by email', async () => {
    const workspace = await service.create(ownerId, 'My Workspace');

    await service.inviteMember(workspace.id, ownerId, memberEmail, 'MEMBER');

    const memberWorkspaces = await service.listForUser('member-1');
    expect(memberWorkspaces).toHaveLength(1);
    expect(memberWorkspaces[0]?.role).toBe('MEMBER');
  });

  it('rejects an invite from a non-manager member', async () => {
    const workspace = await service.create(ownerId, 'My Workspace');
    await service.inviteMember(workspace.id, ownerId, memberEmail, 'MEMBER');

    await expect(service.inviteMember(workspace.id, 'member-1', 'nobody@example.com', 'MEMBER')).rejects.toThrow(
      'Only workspace owners or admins can manage members'
    );
  });

  it('404s when inviting an email with no matching user', async () => {
    const workspace = await service.create(ownerId, 'My Workspace');

    await expect(service.inviteMember(workspace.id, ownerId, 'unknown@example.com', 'MEMBER')).rejects.toThrow(
      'User not found'
    );
  });

  it('lets an OWNER change a member role', async () => {
    const workspace = await service.create(ownerId, 'My Workspace');
    await service.inviteMember(workspace.id, ownerId, memberEmail, 'MEMBER');

    await service.updateMemberRole(workspace.id, ownerId, 'member-1', 'ADMIN');

    const memberWorkspaces = await service.listForUser('member-1');
    expect(memberWorkspaces[0]?.role).toBe('ADMIN');
  });

  it('refuses to change the owner role', async () => {
    const workspace = await service.create(ownerId, 'My Workspace');

    await expect(service.updateMemberRole(workspace.id, ownerId, ownerId, 'ADMIN')).rejects.toThrow(
      "Cannot change the workspace owner's role"
    );
  });
});
