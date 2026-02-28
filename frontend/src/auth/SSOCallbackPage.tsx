import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Center, Loader, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconShieldCheck } from '@tabler/icons-react';
import { authApi } from '../api/services';
import { useAuthStore } from '../stores/authStore';

export default function SSOCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      // Check for error in query params
      const error = searchParams.get('error');
      if (error) {
        setStatus('error');
        setErrorMessage(decodeURIComponent(error));
        return;
      }

      // Check for tokens in query params (set by backend redirect)
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');

      if (accessToken && refreshToken) {
        try {
          setTokens(accessToken, refreshToken);
          const { data: user } = await authApi.me();
          setUser(user);
          setStatus('success');
          // Navigate to dashboard after a short delay
          setTimeout(() => navigate('/'), 1000);
        } catch {
          setStatus('error');
          setErrorMessage('Failed to verify authentication. Please try again.');
        }
        return;
      }

      // No tokens and no error - something went wrong
      setStatus('error');
      setErrorMessage('No authentication data received. Please try logging in again.');
    };

    handleCallback();
  }, [searchParams, setTokens, setUser, navigate]);

  return (
    <Center h="100vh" bg="gray.0">
      <Card shadow="md" padding="xl" radius="md" w={450}>
        <Stack align="center" gap="md">
          {status === 'loading' && (
            <>
              <Loader size="xl" />
              <Title order={3}>Completing Sign In...</Title>
              <Text c="dimmed" size="sm" ta="center">
                Processing your authentication. Please wait.
              </Text>
            </>
          )}

          {status === 'success' && (
            <>
              <IconShieldCheck size={48} color="var(--mantine-color-green-6)" />
              <Title order={3}>Sign In Successful</Title>
              <Text c="dimmed" size="sm" ta="center">
                Redirecting to dashboard...
              </Text>
            </>
          )}

          {status === 'error' && (
            <>
              <IconAlertCircle size={48} color="var(--mantine-color-red-6)" />
              <Title order={3}>Sign In Failed</Title>
              <Text c="dimmed" size="sm" ta="center">
                {errorMessage}
              </Text>
              <Button variant="outline" onClick={() => navigate('/login')}>
                Back to Login
              </Button>
            </>
          )}
        </Stack>
      </Card>
    </Center>
  );
}
