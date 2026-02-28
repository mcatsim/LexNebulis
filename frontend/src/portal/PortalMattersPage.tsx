import { Badge, Card, Group, Pagination, Stack, Text, Title, Skeleton } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { portalClientApi } from '../api/services';

const statusColor: Record<string, string> = {
  open: 'blue',
  pending: 'yellow',
  closed: 'gray',
  archived: 'dark',
};

export default function PortalMattersPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['portal-matters', page],
    queryFn: () => portalClientApi.listMatters({ page, page_size: 10 }),
  });

  const matters = data?.data?.items ?? [];
  const totalPages = data?.data?.total_pages ?? 0;

  return (
    <Stack gap="lg">
      <Title order={2}>My Matters</Title>

      {isLoading ? (
        <Stack gap="sm">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={60} />)}
        </Stack>
      ) : matters.length === 0 ? (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text c="dimmed" ta="center">No matters found.</Text>
        </Card>
      ) : (
        <Stack gap="sm">
          {matters.map((m) => (
            <Card
              key={m.id}
              shadow="sm"
              padding="md"
              radius="md"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/portal/matters/${m.id}`)}
            >
              <Group justify="space-between">
                <div>
                  <Text fw={600}>{m.title}</Text>
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">Opened: {m.date_opened}</Text>
                    {m.attorney_name && (
                      <Text size="sm" c="dimmed">| Attorney: {m.attorney_name}</Text>
                    )}
                  </Group>
                </div>
                <Group gap="xs">
                  <Badge color={statusColor[m.status] ?? 'gray'} variant="light">
                    {m.status}
                  </Badge>
                  <Badge color="gray" variant="light" size="sm">
                    {m.litigation_type.replace(/_/g, ' ')}
                  </Badge>
                </Group>
              </Group>
              {m.description && (
                <Text size="sm" c="dimmed" mt="xs" lineClamp={2}>{m.description}</Text>
              )}
            </Card>
          ))}
        </Stack>
      )}

      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}
    </Stack>
  );
}
