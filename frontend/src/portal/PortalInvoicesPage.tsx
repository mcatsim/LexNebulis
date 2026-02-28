import { Badge, Card, Group, Pagination, Stack, Table, Text, Title, Skeleton } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { portalClientApi } from '../api/services';

const statusColor: Record<string, string> = {
  sent: 'blue',
  paid: 'green',
  overdue: 'red',
  void: 'gray',
};

export default function PortalInvoicesPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['portal-invoices', page],
    queryFn: () => portalClientApi.listInvoices({ page, page_size: 15 }),
  });

  const invoices = data?.data?.items ?? [];
  const totalPages = data?.data?.total_pages ?? 0;

  return (
    <Stack gap="lg">
      <Title order={2}>My Invoices</Title>

      {isLoading ? (
        <Stack gap="sm">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={50} />)}
        </Stack>
      ) : invoices.length === 0 ? (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text c="dimmed" ta="center">No invoices found.</Text>
        </Card>
      ) : (
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Invoice #</Table.Th>
                <Table.Th>Matter</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Issued</Table.Th>
                <Table.Th>Due</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {invoices.map((inv) => (
                <Table.Tr key={inv.id}>
                  <Table.Td>
                    <Text fw={500} size="sm">#{inv.invoice_number ?? '--'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{inv.matter_title ?? '--'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={600} size="sm">${(inv.total_cents / 100).toFixed(2)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{inv.issued_date ?? '--'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{inv.due_date ?? '--'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor[inv.status] ?? 'gray'} variant="light">
                      {inv.status}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}
    </Stack>
  );
}
