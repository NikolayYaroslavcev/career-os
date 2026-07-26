import { describe, it, expect } from 'vitest';
import { Workspace } from './workspace.js';
import { createUserId, createWorkspaceId } from '../base/identifier.js';

describe('Workspace', () => {
  const ownerId = createUserId('owner-1');
  const memberId = createUserId('member-1');
  const workspaceId = createWorkspaceId('workspace-1');

  it('should create a workspace', () => {
    const workspace = Workspace.create({
      id: workspaceId,
      name: 'My Workspace',
      ownerId,
    });

    expect(workspace.id).toBe(workspaceId);
    expect(workspace.name).toBe('My Workspace');
    expect(workspace.ownerId).toBe(ownerId);
    expect(workspace.memberIds).toContain(ownerId);
  });

  it('should add and remove members', () => {
    const workspace = Workspace.create({
      id: workspaceId,
      name: 'My Workspace',
      ownerId,
    });

    workspace.addMember(memberId);
    expect(workspace.isMember(memberId)).toBe(true);

    workspace.removeMember(memberId);
    expect(workspace.isMember(memberId)).toBe(false);
  });

  it('should not remove owner', () => {
    const workspace = Workspace.create({
      id: workspaceId,
      name: 'My Workspace',
      ownerId,
    });

    expect(() => workspace.removeMember(ownerId)).toThrow('Cannot remove workspace owner');
  });

  it('should transfer ownership', () => {
    const workspace = Workspace.create({
      id: workspaceId,
      name: 'My Workspace',
      ownerId,
    });

    workspace.addMember(memberId);
    workspace.transferOwnership(memberId);
    expect(workspace.ownerId).toBe(memberId);
    expect(workspace.isOwner(memberId)).toBe(true);
  });

  it('should not transfer to non-member', () => {
    const workspace = Workspace.create({
      id: workspaceId,
      name: 'My Workspace',
      ownerId,
    });

    expect(() => workspace.transferOwnership(memberId)).toThrow('New owner must be a workspace member');
  });

  it('should rename workspace', () => {
    const workspace = Workspace.create({
      id: workspaceId,
      name: 'Old Name',
      ownerId,
    });

    workspace.rename('New Name');
    expect(workspace.name).toBe('New Name');
  });
});
