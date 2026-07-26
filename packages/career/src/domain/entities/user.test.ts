import { describe, it, expect } from 'vitest';
import { User } from './user.js';
import { Email } from '../value-objects/email.js';
import { UserRole } from '../enums/user-role.js';
import { createUserId, createWorkspaceId } from '../base/identifier.js';

describe('User', () => {
  const userId = createUserId('user-1');
  const workspaceId = createWorkspaceId('workspace-1');

  it('should create a user', () => {
    const user = User.create({
      id: userId,
      email: Email.create('test@example.com'),
      firstName: 'John',
      lastName: 'Doe',
    });

    expect(user.id).toBe(userId);
    expect(user.email.value).toBe('test@example.com');
    expect(user.firstName).toBe('John');
    expect(user.lastName).toBe('Doe');
    expect(user.fullName).toBe('John Doe');
    expect(user.role).toBe(UserRole.JOB_SEEKER);
    expect(user.isActive).toBe(true);
  });

  it('should change email', () => {
    const user = User.create({
      id: userId,
      email: Email.create('old@example.com'),
      firstName: 'John',
      lastName: 'Doe',
    });

    user.changeEmail(Email.create('new@example.com'));
    expect(user.email.value).toBe('new@example.com');
  });

  it('should update name', () => {
    const user = User.create({
      id: userId,
      email: Email.create('test@example.com'),
      firstName: 'John',
      lastName: 'Doe',
    });

    user.updateName('Jane', 'Smith');
    expect(user.firstName).toBe('Jane');
    expect(user.lastName).toBe('Smith');
    expect(user.fullName).toBe('Jane Smith');
  });

  it('should add and remove workspace', () => {
    const user = User.create({
      id: userId,
      email: Email.create('test@example.com'),
      firstName: 'John',
      lastName: 'Doe',
    });

    user.addToWorkspace(workspaceId);
    expect(user.workspaceIds).toContain(workspaceId);

    user.addToWorkspace(workspaceId);
    expect(user.workspaceIds.length).toBe(1);

    user.removeFromWorkspace(workspaceId);
    expect(user.workspaceIds).not.toContain(workspaceId);
  });

  it('should activate and deactivate', () => {
    const user = User.create({
      id: userId,
      email: Email.create('test@example.com'),
      firstName: 'John',
      lastName: 'Doe',
    });

    user.deactivate();
    expect(user.isActive).toBe(false);

    user.activate();
    expect(user.isActive).toBe(true);
  });

  it('should increment version on changes', () => {
    const user = User.create({
      id: userId,
      email: Email.create('test@example.com'),
      firstName: 'John',
      lastName: 'Doe',
    });

    expect(user.version).toBe(0);
    user.changeEmail(Email.create('new@example.com'));
    expect(user.version).toBe(1);
  });
});
