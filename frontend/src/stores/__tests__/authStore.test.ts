import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../authStore';
import type { User } from '../../types';

const mockUser: User = {
  id: 'user-001',
  email: 'admin@lexnebulis.test',
  first_name: 'Jane',
  last_name: 'Doe',
  role: 'admin',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-06-15T12:00:00Z',
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('starts with no tokens and unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setTokens stores access and refresh tokens', () => {
    useAuthStore.getState().setTokens('access-123', 'refresh-456');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('access-123');
    expect(state.refreshToken).toBe('refresh-456');
  });

  it('setTokens sets isAuthenticated to true', () => {
    useAuthStore.getState().setTokens('access-123', 'refresh-456');

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('setUser stores user data', () => {
    useAuthStore.getState().setUser(mockUser);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.user?.email).toBe('admin@lexnebulis.test');
  });

  it('logout clears all state', () => {
    // Set up authenticated state
    useAuthStore.getState().setTokens('access-123', 'refresh-456');
    useAuthStore.getState().setUser(mockUser);

    // Verify state is set
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toBeDefined();

    // Logout
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('isAuthenticated returns true when token exists', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    useAuthStore.getState().setTokens('token', 'refresh');

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('isAuthenticated returns false after logout', () => {
    useAuthStore.getState().setTokens('token', 'refresh');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('can update user independently from tokens', () => {
    useAuthStore.getState().setUser(mockUser);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    // Tokens are still null since only setUser was called
    expect(state.accessToken).toBeNull();
  });

  it('supports updating tokens multiple times', () => {
    useAuthStore.getState().setTokens('first-access', 'first-refresh');
    expect(useAuthStore.getState().accessToken).toBe('first-access');

    useAuthStore.getState().setTokens('second-access', 'second-refresh');
    expect(useAuthStore.getState().accessToken).toBe('second-access');
    expect(useAuthStore.getState().refreshToken).toBe('second-refresh');
  });
});
