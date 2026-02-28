import { Card, Grid, Group, Badge, Stack, Text, Title, Skeleton } from '@mantine/core';
import { IconClipboardList, IconCash, IconMessage } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { portalClientApi } from '../api/services';
import { usePortalAuthStore } from '../stores/portalAuthStore';

const statusColor: Record<string, string> = {
  open: 'blue',
  pending: 'yellow',
  closed: 'gray',
  archived: 'dark',
  sent: 'blue',
  paid: 'green',
  overdue: 'red',
  void: 'gray',
};

export default function PortalDashboard() {
  const { clientUser } = usePortalAuthStore();
  const navigate = useNavigate();

  const { data: mattersData, isLoading: mattersLoading } = useQuery({
    queryKey: ['portal-matters-dashboard'],
    queryFn: () => portalClientApi.listMatters({ page: 1, page_size: 5 }),
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['portal-invoices-dashboard'],
    queryFn: () => portalClientApi.listInvoices({ page: 1, page_size: 5 }),
  });

  const { data: unreadData } = useQuery({
    queryKey: ['portal-unread'],
    queryFn: () => portalClientApi.getUnreadCount(),
  });

  const matters = mattersData?.data?.items ?? [];
  const invoices = invoicesData?.data?.items ?? [];
  const unreadCount = unreadData?.data?.unread_count ?? 0;

  return (
    <Stack gap="lg">
      <Title order={2}>Welcome, {clientUser?.first_name ?? 'Client'}</Title>

      <Grid>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder style={{ cursor: 'pointer' }} onClick={() => navigate('/portal/matters')}>
            <Group>
              <IconClipboardList size={32} color="var(--mantine-color-blue-6)" />
              <div>
                <Text size="xl" fw={700}>{mattersData?.data?.total ?? 0}</Text>
                <Text size="sm" c="dimmed">Matters</Text>
              </div>
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder style={{ cursor: 'pointer' }} onClick={() => navigate('/portal/invoices')}>
            <Group>
              <IconCash size={32} color="var(--mantine-color-green-6)" />
              <div>
                <Text size="xl" fw={700}>{invoicesData?.data?.total ?? 0}</Text>
                <Text size="sm" c="dimmed">Invoices</Text>
              </div>
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder style={{ cursor: 'pointer' }} onClick={() => navigate('/portal/messages')}>
            <Group>
              <IconMessage size={32} color="var(--mantine-color-red-6)" />
              <div>
                <Text size="xl" fw={700}>{unreadCount}</Text>
                <Text size="sm" c="dimmed">Unread Messages</Text>
              </div>
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={4} mb="md">Recent Matters</Title>
            {mattersLoading ? (
              <Stack gap="xs">
                {[1, 2, 3].map((i) => <Skeleton key={i} height={40} />)}
              </Stack>
            ) : matters.length === 0 ? (
              <Text c="dimmed" size="sm">No matters found.</Text>
            ) : (
              <Stack gap="xs">
                {matters.map((m) => (
                  <Card
                    key={m.id}
                    padding="sm"
                    radius="sm"
                    withBorder
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/portal/matters/${m.id}`)}
                  >
                    <Group justify="space-between">
                      <div>
                        <Text fw={500} size="sm">{m.title}</Text>
                        <Text size="xs" c="dimmed">{m.attorney_name ?? 'No attorney assigned'}</Text>
                      </div>
                      <Badge color={statusColor[m.status] ?? 'gray'} variant="light" size="sm">
                        {m.status}
                      </Badge>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={4} mb="md">Recent Invoices</Title>
            {invoicesLoading ? (
              <Stack gap="xs">
                {[1, 2, 3].map((i) => <Skeleton key={i} height={40} />)}
              </Stack>
            ) : invoices.length === 0 ? (
              <Text c="dimmed" size="sm">No invoices found.</Text>
            ) : (
              <Stack gap="xs">
                {invoices.map((inv) => (
                  <Card key={inv.id} padding="sm" radius="sm" withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text fw={500} size="sm">
                          Invoice #{inv.invoice_number ?? '--'}
                        </Text>
                        <Text size="xs" c="dimmed">{inv.matter_title ?? ''}</Text>
                      </div>
                      <Group gap="xs">
                        <Text fw={600} size="sm">
                          ${(inv.total_cents / 100).toFixed(2)}
                        </Text>
                        <Badge color={statusColor[inv.status] ?? 'gray'} variant="light" size="sm">
                          {inv.status}
                        </Badge>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
