import { create } from 'zustand';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getStoredUser,
  type AuthUser,
} from '@/api/auth';
import { translate } from '@/lib/i18n/translate';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  login: async (email, password): Promise<void> => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiLogin({ email, password });
      set({ user: response.user, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : translate('auth.errors.loginFailed');
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  register: async (data): Promise<void> => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiRegister(data);
      set({ user: response.user, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : translate('auth.errors.registrationFailed');
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    await apiLogout();
    set({ user: null, error: null });
  },

  loadUser: (): void => {
    const user = getStoredUser();
    set({ user });
  },

  clearError: (): void => {
    set({ error: null });
  },
}));
