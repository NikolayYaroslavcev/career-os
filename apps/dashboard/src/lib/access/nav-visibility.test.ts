import { describe, it, expect } from 'vitest';
import { UserRole, type AuthUser } from '@/api/auth';
import { isAdmin, canViewNavItem } from './nav-visibility';

function user(role: UserRole): Pick<AuthUser, 'role'> {
  return { role };
}

describe('isAdmin', () => {
  it('returns false for a null user', () => {
    expect(isAdmin(null)).toBe(false);
  });

  it('returns false for a job seeker', () => {
    expect(isAdmin(user(UserRole.JOB_SEEKER))).toBe(false);
  });

  it('returns false for a recruiter', () => {
    expect(isAdmin(user(UserRole.RECRUITER))).toBe(false);
  });

  it('returns true for an admin', () => {
    expect(isAdmin(user(UserRole.ADMIN))).toBe(true);
  });
});

describe('canViewNavItem', () => {
  it('allows public items regardless of role', () => {
    expect(canViewNavItem('public', null)).toBe(true);
    expect(canViewNavItem(undefined, user(UserRole.JOB_SEEKER))).toBe(true);
  });

  it('hides admin items from non-admin users', () => {
    expect(canViewNavItem('admin', user(UserRole.JOB_SEEKER))).toBe(false);
    expect(canViewNavItem('admin', null)).toBe(false);
  });

  it('shows admin items to admin users', () => {
    expect(canViewNavItem('admin', user(UserRole.ADMIN))).toBe(true);
  });
});
