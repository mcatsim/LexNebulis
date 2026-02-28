import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import AuthGuard from '../AuthGuard';
import { useAuthStore } from '../../stores/authStore';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('AuthGuard', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    useAuthStore.getState().logout();
  });

  it('redirects to /login when no token is present', async () => {
    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated and user is loaded', async () => {
    useAuthStore.getState().setTokens('valid-token', 'valid-refresh');
    // Set user so it does not have to fetch
    useAuthStore.getState().setUser({
      id: 'user-001',
      email: 'admin@lexnebulis.test',
      first_name: 'Jane',
      last_name: 'Doe',
      role: 'admin',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-06-15T12:00:00Z',
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith('/login');
  });

  it('fetches user profile on mount when authenticated but user is null', async () => {
    useAuthStore.getState().setTokens('valid-token', 'valid-refresh');
    // Do not set user — AuthGuard should fetch via authApi.me()

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    // Initially shows loading while fetching user
    // After MSW responds with mockUser, children should render
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeDefined();
    expect(state.user?.email).toBe('admin@lexnebulis.test');
  });

  it('redirects to /login if user profile fetch fails', async () => {
    const { server } = await import('../../test/mocks/server');
    const { http, HttpResponse } = await import('msw');

    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 });
      }),
    );

    useAuthStore.getState().setTokens('expired-token', 'expired-refresh');

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });
});
