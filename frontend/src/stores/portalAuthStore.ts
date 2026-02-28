import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ClientUser } from '../types';

interface PortalAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  clientUser: ClientUser | null;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string) => void;
  setClientUser: (user: ClientUser) => void;
  logout: () => void;
}

export const usePortalAuthStore = create<PortalAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      clientUser: null,
      isAuthenticated: false,
      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true }),
      setClientUser: (user) => set({ clientUser: user }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, clientUser: null, isAuthenticated: false }),
    }),
    {
      name: 'lexnebulis-portal-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
