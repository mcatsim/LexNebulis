import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Center, Loader, Stack, Text, Title } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

export default function CloudStorageCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const providerParam = searchParams.get('provider');

    if (providerParam) {
      setProvider(providerParam);
    }

    if (success === 'true') {
      setStatus('success');
      // Auto-redirect after 2 seconds
      const timer = setTimeout(() => {
        navigate('/admin/cloud-storage');
      }, 2000);
      return () => clearTimeout(timer);
    } else if (error) {
      setStatus('error');
      setErrorMessage(error);
    } else {
      // Still loading / waiting for redirect
      setStatus('loading');
    }
  }, [searchParams, navigate]);

  if (status === 'loading') {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="xl" />
          <Text size="lg">Completing cloud storage connection...</Text>
        </Stack>
      </Center>
    );
  }

  if (status === 'success') {
    const providerLabel = provider
      ? provider.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Cloud Storage';
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <IconCheck size={48} color="var(--mantine-color-green-6)" />
          <Title order={3}>Connected Successfully</Title>
          <Text c="dimmed">
            {providerLabel} has been connected. Redirecting...
          </Text>
          <Button variant="light" onClick={() => navigate('/admin/cloud-storage')}>
            Go to Cloud Storage
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Center h="100vh">
      <Stack align="center" gap="md" maw={400}>
        <IconX size={48} color="var(--mantine-color-red-6)" />
        <Title order={3}>Connection Failed</Title>
        <Alert color="red" variant="light">
          {errorMessage || 'An unknown error occurred during the OAuth flow.'}
        </Alert>
        <Button variant="light" onClick={() => navigate('/admin/cloud-storage')}>
          Back to Cloud Storage
        </Button>
      </Stack>
    </Center>
  );
}
