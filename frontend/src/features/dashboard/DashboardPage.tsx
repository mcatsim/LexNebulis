import { Card, Grid, Group, SimpleGrid, Stack, Text, Title, ThemeIcon, Badge } from '@mantine/core';
import {
  IconCalendar, IconCash, IconClipboardList, IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { clientsApi, mattersApi, calendarApi, billingApi } from '../../api/services';
import { useAuthStore } from '../../stores/authStore';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: clients } = useQuery({
    queryKey: ['clients', { page: 1, page_size: 1 }],
    queryFn: () => clientsApi.list({ page: 1, page_size: 1 }),
  });

  const { data: matters } = useQuery({
    queryKey: ['matters', { page: 1, page_size: 1, status: 'open' }],
    queryFn: () => mattersApi.list({ page: 1, page_size: 1, status: 'open' }),
  });

  const { data: events } = useQuery({
    queryKey: ['calendar', { page: 1, page_size: 5 }],
    queryFn: () => calendarApi.list({ page: 1, page_size: 5 }),
  });

  const { data: recentTime } = useQuery({
    queryKey: ['time-entries', { page: 1, page_size: 5 }],
    queryFn: () => billingApi.listTimeEntries({ page: 1 }),
  });

  const stats = [
    { label: 'Active Clients', value: clients?.data?.total ?? 0, icon: IconUsers, color: 'blue' },
    { label: 'Open Matters', value: matters?.data?.total ?? 0, icon: IconClipboardList, color: 'green' },
    { label: 'Upcoming Events', value: events?.data?.total ?? 0, icon: IconCalendar, color: 'orange' },
    { label: 'Recent Time Entries', value: recentTime?.data?.total ?? 0, icon: IconCash, color: 'grape' },
  ];

  return (
    <Stack>
      <Title order={1}>Welcome back, {user?.first_name}</Title>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {stats.map((stat) => (
          <Card key={stat.label} shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  {stat.label}
                </Text>
                <Text fw={700} size="xl">
                  {stat.value}
                </Text>
              </div>
              <ThemeIcon color={stat.color} variant="light" size={48} radius="md">
                <stat.icon size={28} />
              </ThemeIcon>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={2} mb="md">Upcoming Events</Title>
            {events?.data?.items?.length ? (
              <Stack gap="xs">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {events.data.items.slice(0, 5).map((e: any) => (
                  <Group key={e.id} justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>{e.title}</Text>
                      <Text size="xs" c="dimmed">
                        {new Date(e.start_datetime).toLocaleDateString()}
                      </Text>
                    </div>
                    <Badge size="sm" variant="light">
                      {e.event_type}
                    </Badge>
                  </Group>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed" size="sm">No upcoming events</Text>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={2} mb="md">Recent Time Entries</Title>
            {recentTime?.data?.items?.length ? (
              <Stack gap="xs">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {recentTime.data.items.slice(0, 5).map((t: any) => (
                  <Group key={t.id} justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>{t.description}</Text>
                      <Text size="xs" c="dimmed">{t.date}</Text>
                    </div>
                    <Badge size="sm" variant="light" color="grape">
                      {t.duration_minutes} min
                    </Badge>
                  </Group>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed" size="sm">No recent time entries</Text>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
