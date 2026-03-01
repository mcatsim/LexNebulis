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
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCreditCard,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { paymentProcessingApi } from '../../api/services';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PaymentPage() {
  const { token } = useParams<{ token: string }>();
  const [completed, setCompleted] = useState(false);
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['payment-page', token],
    queryFn: () => paymentProcessingApi.getPaymentInfo(token!),
    enabled: !!token,
    retry: false,
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      paymentProcessingApi.completePayment(token!, {
        payer_name: payerName || undefined,
        payer_email: payerEmail || undefined,
      }),
    onSuccess: () => {
      setCompleted(true);
      notifications.show({ title: 'Success', message: 'Payment recorded successfully', color: 'green' });
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to record payment', color: 'red' }),
  });

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (error || !data?.data) {
    return (
      <Container size="sm" py="xl">
        <Center h="80vh">
          <Paper shadow="md" p="xl" radius="md" withBorder w="100%">
            <Stack align="center">
              <IconCreditCard size={48} color="var(--mantine-color-red-6)" />
              <Title order={3}>Payment Link Not Found</Title>
              <Text c="dimmed" ta="center">
                This payment link is invalid, has expired, or has already been used.
              </Text>
            </Stack>
          </Paper>
        </Center>
      </Container>
    );
  }

  const info = data.data;

  if (completed) {
    return (
      <Container size="sm" py="xl">
        <Center h="80vh">
          <Paper shadow="md" p="xl" radius="md" withBorder w="100%">
            <Stack align="center">
              <IconCheck size={48} color="var(--mantine-color-green-6)" />
              <Title order={3}>Payment Received</Title>
              <Text c="dimmed" ta="center">
                Thank you! Your payment of {formatCents(info.total_cents)} has been recorded.
              </Text>
            </Stack>
          </Paper>
        </Center>
      </Container>
    );
  }

  if (info.status === 'paid') {
    return (
      <Container size="sm" py="xl">
        <Center h="80vh">
          <Paper shadow="md" p="xl" radius="md" withBorder w="100%">
            <Stack align="center">
              <IconCheck size={48} color="var(--mantine-color-green-6)" />
              <Title order={3}>Already Paid</Title>
              <Text c="dimmed" ta="center">
                This invoice has already been paid. Thank you!
              </Text>
            </Stack>
          </Paper>
        </Center>
      </Container>
    );
  }

  if (info.status === 'expired') {
    return (
      <Container size="sm" py="xl">
        <Center h="80vh">
          <Paper shadow="md" p="xl" radius="md" withBorder w="100%">
            <Stack align="center">
              <IconCreditCard size={48} color="var(--mantine-color-orange-6)" />
              <Title order={3}>Payment Link Expired</Title>
              <Text c="dimmed" ta="center">
                This payment link has expired. Please contact the firm for a new link.
              </Text>
            </Stack>
          </Paper>
        </Center>
      </Container>
    );
  }

  if (info.status === 'cancelled') {
    return (
      <Container size="sm" py="xl">
        <Center h="80vh">
          <Paper shadow="md" p="xl" radius="md" withBorder w="100%">
            <Stack align="center">
              <IconCreditCard size={48} color="var(--mantine-color-gray-6)" />
              <Title order={3}>Payment Link Cancelled</Title>
              <Text c="dimmed" ta="center">
                This payment link has been cancelled. Please contact the firm if you need to make a payment.
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
              <IconCreditCard size={36} color="var(--mantine-color-blue-6)" />
            </Group>

            <Title order={3} ta="center">{info.firm_name}</Title>
            <Text ta="center" c="dimmed">Payment Request</Text>

            <Paper shadow="xs" p="md" withBorder>
              <Stack gap="xs">
                {info.invoice_number && (
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>Invoice</Text>
                    <Text size="sm">#{info.invoice_number}</Text>
                  </Group>
                )}
                {info.client_name && (
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>Client</Text>
                    <Text size="sm">{info.client_name}</Text>
                  </Group>
                )}
                {info.description && (
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>Description</Text>
                    <Text size="sm">{info.description}</Text>
                  </Group>
                )}
                <Group justify="space-between">
                  <Text size="sm" fw={600}>Amount</Text>
                  <Text size="sm">{formatCents(info.amount_cents)}</Text>
                </Group>
                {info.surcharge_cents > 0 && (
                  <>
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>Processing Fee</Text>
                      <Text size="sm">{formatCents(info.surcharge_cents)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" fw={700}>Total Due</Text>
                      <Text size="sm" fw={700}>{formatCents(info.total_cents)}</Text>
                    </Group>
                  </>
                )}
                {info.surcharge_cents === 0 && (
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>Total Due</Text>
                    <Text size="sm" fw={700}>{formatCents(info.amount_cents)}</Text>
                  </Group>
                )}
                {info.expires_at && (
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>Expires</Text>
                    <Text size="sm">{new Date(info.expires_at).toLocaleDateString()}</Text>
                  </Group>
                )}
              </Stack>
            </Paper>

            {info.processor === 'manual' && (
              <Alert variant="light" color="blue">
                <Text size="sm">
                  To complete this payment, please enter your details below and click
                  &quot;Mark as Paid&quot; after you have arranged payment with the firm.
                </Text>
              </Alert>
            )}

            {info.processor !== 'manual' && (
              <Alert variant="light" color="blue">
                <Text size="sm">
                  Online payment processing via {info.processor} will be available once the firm
                  completes their payment processor configuration.
                </Text>
              </Alert>
            )}

            <TextInput
              label="Your Name"
              placeholder="Enter your full name"
              value={payerName}
              onChange={(e) => setPayerName(e.currentTarget.value)}
            />

            <TextInput
              label="Your Email"
              placeholder="Enter your email address"
              value={payerEmail}
              onChange={(e) => setPayerEmail(e.currentTarget.value)}
            />

            <Button
              size="lg"
              fullWidth
              leftSection={<IconCreditCard size={20} />}
              onClick={() => completeMutation.mutate()}
              loading={completeMutation.isPending}
              color="green"
            >
              {info.processor === 'manual' ? 'Mark as Paid' : 'Pay Now'}
            </Button>

            <Text size="xs" c="dimmed" ta="center">
              By completing this payment, you acknowledge the amount due as stated above.
            </Text>
          </Stack>
        </Paper>
      </Center>
    </Container>
  );
}
