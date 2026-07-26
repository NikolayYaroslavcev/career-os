import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { I18nProvider } from '@/lib/i18n/i18n-provider';
import { AuthGuard } from './auth-guard';

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: ReturnType<typeof vi.fn> } => ({ replace: vi.fn() }),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (): { user: { id: string; email: string }; isLoading: boolean; loadUser: ReturnType<typeof vi.fn> } => ({
    user: { id: '1', email: 'user@example.com' },
    isLoading: false,
    loadUser: vi.fn(),
  }),
}));

vi.mock('@/api/auth', () => ({
  isAuthenticated: vi.fn(),
}));

import { isAuthenticated } from '@/api/auth';

function tree(): React.JSX.Element {
  return (
    <I18nProvider initialLocale="en">
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    </I18nProvider>
  );
}

describe('AuthGuard hydration', () => {
  afterEach(() => {
    vi.mocked(isAuthenticated).mockReset();
    document.body.innerHTML = '';
  });

  it('renders the same markup on the server pass and the first client pass, even when the client already has a token the server could not see', async () => {
    // The server never has `window`, so isAuthenticated() is always false there.
    vi.mocked(isAuthenticated).mockReturnValue(false);
    const serverHtml = renderToString(tree());

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    // The client, on the other hand, already has a token in localStorage.
    vi.mocked(isAuthenticated).mockReturnValue(true);

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      hydrateRoot(container, tree());
    });

    const hydrationMismatches = consoleError.mock.calls.filter(([message]) =>
      typeof message === 'string' && message.includes('Hydration')
    );
    expect(hydrationMismatches).toEqual([]);

    consoleError.mockRestore();
  });

  it('shows protected content once the auth check resolves', async () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(tree());
    });

    expect(container.textContent).toContain('Protected content');
    root.unmount();
  });
});
