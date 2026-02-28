import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  tempToken: string | null;
  requires2fa: boolean;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
  setTempToken: (token: string) => void;
  clear2fa: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      tempToken: null,
      requires2fa: false,
      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true, tempToken: null, requires2fa: false }),
      setUser: (user) => set({ user }),
      setTempToken: (token) =>
        set({ tempToken: token, requires2fa: true }),
      clear2fa: () =>
        set({ tempToken: null, requires2fa: false }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, tempToken: null, requires2fa: false }),
    }),
    {
      name: 'lexnebulis-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
