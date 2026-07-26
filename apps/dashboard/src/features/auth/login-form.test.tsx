import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginForm } from './login-form';
import { I18nProvider } from '@/lib/i18n/i18n-provider';

vi.mock('next/navigation', () => ({
  useRouter: (): { push: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> } => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (): { user: null; isLoading: boolean; error: null; login: ReturnType<typeof vi.fn>; clearError: ReturnType<typeof vi.fn> } => ({
    user: null,
    isLoading: false,
    error: null,
    login: vi.fn(),
    clearError: vi.fn(),
  }),
}));

function renderWithI18n(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider initialLocale="en">{ui}</I18nProvider>);
}

describe('LoginForm', () => {
  it('renders login form with email and password fields', () => {
    renderWithI18n(<LoginForm />);

    expect(screen.getByText('Sign in to CareerOS')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders link to register page', () => {
    renderWithI18n(<LoginForm />);

    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByText('Sign up')).toHaveAttribute('href', '/register');
  });
});
