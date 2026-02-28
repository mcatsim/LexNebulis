import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconSignature,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { esignApi } from '../../api/services';

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const [signed, setSigned] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['signing-page', token],
    queryFn: () => esignApi.getSigningPage(token!),
    enabled: !!token,
    retry: false,
  });

  const signMutation = useMutation({
    mutationFn: () => esignApi.sign(token!),
    onSuccess: () => {
      setSigned(true);
      notifications.show({ title: 'Success', message: 'Document signed successfully', color: 'green' });
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to sign document', color: 'red' }),
  });

  const declineMutation = useMutation({
    mutationFn: (reason: string) => esignApi.decline(token!, reason),
    onSuccess: () => {
      setDeclined(true);
      notifications.show({ title: 'Declined', message: 'You have declined to sign', color: 'orange' });
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to decline', color: 'red' }),
  });

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (error || !data?.data) {
    const errorMessage = (error as Error)?.message || 'This signing link is invalid or has expired.';
    return (
      <Container size="sm" py="xl">
        <Center h="80vh">
          <Paper shadow="md" p="xl" radius="md" withBorder w="100%">
            <Stack align="center">
              <IconX size={48} color="var(--mantine-color-red-6)" />
              <Title order={3}>Unable to Load</Title>
              <Text c="dimmed" ta="center">{errorMessage}</Text>
            </Stack>
          </Paper>
        </Center>
      </Container>
    );
  }

  const info = data.data;

  if (signed) {
    return (
      <Container size="sm" py="xl">
        <Center h="80vh">
          <Paper shadow="md" p="xl" radius="md" withBorder w="100%">
            <Stack align="center">
              <IconCheck size={48} color="var(--mantine-color-green-6)" />
              <Title order={3}>Document Signed</Title>
              <Text c="dimmed" ta="center">
                Thank you, {info.signer_name}. Your signature has been recorded.
              </Text>
            </Stack>
          </Paper>
        </Center>
      </Container>
    );
  }

  if (declined) {
    return (
      <Container size="sm" py="xl">
        <Center h="80vh">
          <Paper shadow="md" p="xl" radius="md" withBorder w="100%">
            <Stack align="center">
              <IconX size={48} color="var(--mantine-color-orange-6)" />
              <Title order={3}>Signing Declined</Title>
              <Text c="dimmed" ta="center">
                You have declined to sign this document. The requesting party has been notified.
              </Text>
            </Stack>
          </Paper>
        </Center>
      </Container>
    );
  }

  if (info.signer_status === 'signed') {
    return (
      <Container size="sm" py="xl">
        <Center h="80vh">
          <Paper shadow="md" p="xl" radius="md" withBorder w="100%">
            <Stack align="center">
              <IconCheck size={48} color="var(--mantine-color-green-6)" />
              <Title order={3}>Already Signed</Title>
              <Text c="dimmed" ta="center">
                You have already signed this document.
              </Text>
            </Stack>
          </Paper>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="sm" py="xl">
      <Center mih="80vh">
        <Paper shadow="md" p="xl" radius="md" withBorder w="100%">
          <Stack>
            <Group justify="center">
              <IconSignature size={36} color="var(--mantine-color-blue-6)" />
            </Group>

            <Title order={3} ta="center">{info.request_title}</Title>

            {info.message && (
              <Alert variant="light" color="blue">
                <Text size="sm">{info.message}</Text>
              </Alert>
            )}

            <Paper shadow="xs" p="md" withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={600}>Signer</Text>
                  <Text size="sm">{info.signer_name}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={600}>Email</Text>
                  <Text size="sm">{info.signer_email}</Text>
                </Group>
              </Stack>
            </Paper>

            <Button
              component="a"
              href={info.document_download_url}
              target="_blank"
              variant="outline"
              fullWidth
            >
              View Document
            </Button>

            {!showDecline ? (
              <Stack gap="sm">
                <Button
                  size="lg"
                  fullWidth
                  leftSection={<IconSignature size={20} />}
                  onClick={() => signMutation.mutate()}
                  loading={signMutation.isPending}
                  color="green"
                >
                  Sign Document
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  fullWidth
                  onClick={() => setShowDecline(true)}
                >
                  Decline to Sign
                </Button>
              </Stack>
            ) : (
              <Stack gap="sm">
                <Textarea
                  label="Reason for Declining"
                  placeholder="Please provide a reason..."
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.currentTarget.value)}
                  minRows={3}
                  required
                />
                <Group>
                  <Button
                    color="red"
                    leftSection={<IconX size={16} />}
                    onClick={() => declineMutation.mutate(declineReason)}
                    loading={declineMutation.isPending}
                    disabled={!declineReason.trim()}
                    style={{ flex: 1 }}
                  >
                    Confirm Decline
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowDecline(false)}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </Button>
                </Group>
              </Stack>
            )}

            <Text size="xs" c="dimmed" ta="center">
              By signing, you agree that your electronic signature is legally binding.
            </Text>
          </Stack>
        </Paper>
      </Center>
    </Container>
  );
}
