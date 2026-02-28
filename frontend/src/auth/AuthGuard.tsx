import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingOverlay } from '@mantine/core';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/services';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, setUser, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!user) {
      authApi.me().then(({ data }) => setUser(data)).catch(() => {
        logout();
        navigate('/login');
      });
    }
  }, [isAuthenticated, user, navigate, setUser, logout]);

  if (!isAuthenticated) return null;
  if (!user) return <LoadingOverlay visible />;

  return <>{children}</>;
}
