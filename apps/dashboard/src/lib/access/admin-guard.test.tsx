import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n/i18n-provider';
import { UserRole, type AuthUser } from '@/api/auth';
import { AdminGuard } from './admin-guard';

vi.mock('next/navigation', () => ({
  useRouter: (): { push: ReturnType<typeof vi.fn> } => ({ push: vi.fn() }),
}));

let mockUser: Pick<AuthUser, 'role'> | null = null;

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (): { user: Pick<AuthUser, 'role'> | null } => ({ user: mockUser }),
}));

function renderWithI18n(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider initialLocale="en">{ui}</I18nProvider>);
}

describe('AdminGuard', () => {
  it('renders children for an admin user', () => {
    mockUser = { role: UserRole.ADMIN };
    renderWithI18n(
      <AdminGuard>
        <div>Admin content</div>
      </AdminGuard>
    );

    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('shows a forbidden message for a non-admin user', () => {
    mockUser = { role: UserRole.JOB_SEEKER };
    renderWithI18n(
      <AdminGuard>
        <div>Admin content</div>
      </AdminGuard>
    );

    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
    expect(screen.getByText('Access restricted')).toBeInTheDocument();
  });

  it('shows a forbidden message when there is no user', () => {
    mockUser = null;
    renderWithI18n(
      <AdminGuard>
        <div>Admin content</div>
      </AdminGuard>
    );

    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
    expect(screen.getByText('Access restricted')).toBeInTheDocument();
  });
});
