import { UserRole, type AuthUser } from '@/api/auth';

export type NavVisibility = 'public' | 'admin';

export function isAdmin(user: Pick<AuthUser, 'role'> | null): boolean {
  if (!user) return false;
  return user.role === UserRole.ADMIN;
}

export function canViewNavItem(
  visibleFor: NavVisibility | undefined,
  user: Pick<AuthUser, 'role'> | null
): boolean {
  if (visibleFor === 'admin') return isAdmin(user);
  return true;
}
