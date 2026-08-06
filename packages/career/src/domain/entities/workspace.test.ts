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

  it('should default new members to MEMBER role and track OWNER role', () => {
    const workspace = Workspace.create({
      id: workspaceId,
      name: 'My Workspace',
      ownerId,
    });

    workspace.addMember(memberId);

    expect(workspace.getMemberRole(ownerId)).toBe('OWNER');
    expect(workspace.getMemberRole(memberId)).toBe('MEMBER');
  });

  it('should add a member with an explicit role', () => {
    const workspace = Workspace.create({
      id: workspaceId,
      name: 'My Workspace',
      ownerId,
    });

    workspace.addMember(memberId, 'ADMIN');

    expect(workspace.getMemberRole(memberId)).toBe('ADMIN');
  });

  it('should update a member role', () => {
    const workspace = Workspace.create({
      id: workspaceId,
      name: 'My Workspace',
      ownerId,
    });

    workspace.addMember(memberId);
    workspace.updateMemberRole(memberId, 'ADMIN');

    expect(workspace.getMemberRole(memberId)).toBe('ADMIN');
  });

  it('should not update the role of a non-member', () => {
    const workspace = Workspace.create({
      id: workspaceId,
      name: 'My Workspace',
      ownerId,
    });

    expect(() => workspace.updateMemberRole(memberId, 'ADMIN')).toThrow('User is not a member of this workspace');
  });

  it('should not update the owner role', () => {
    const workspace = Workspace.create({
      id: workspaceId,
      name: 'My Workspace',
      ownerId,
    });

    expect(() => workspace.updateMemberRole(ownerId, 'ADMIN')).toThrow("Cannot change the workspace owner's role");
  });

  it('should demote the previous owner to ADMIN on ownership transfer', () => {
    const workspace = Workspace.create({
      id: workspaceId,
      name: 'My Workspace',
      ownerId,
    });

    workspace.addMember(memberId);
    workspace.transferOwnership(memberId);

    expect(workspace.getMemberRole(memberId)).toBe('OWNER');
    expect(workspace.getMemberRole(ownerId)).toBe('ADMIN');
  });
});
