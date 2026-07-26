import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RegisterForm } from './register-form';
import { I18nProvider } from '@/lib/i18n/i18n-provider';

vi.mock('next/navigation', () => ({
  useRouter: (): { push: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> } => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (): { user: null; isLoading: boolean; error: null; register: ReturnType<typeof vi.fn>; clearError: ReturnType<typeof vi.fn> } => ({
    user: null,
    isLoading: false,
    error: null,
    register: vi.fn(),
    clearError: vi.fn(),
  }),
}));

function renderWithI18n(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<I18nProvider initialLocale="en">{ui}</I18nProvider>);
}

describe('RegisterForm', () => {
  it('renders register form with all fields', () => {
    renderWithI18n(<RegisterForm />);

    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('renders link to login page', () => {
    renderWithI18n(<RegisterForm />);

    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toHaveAttribute('href', '/login');
  });
});
