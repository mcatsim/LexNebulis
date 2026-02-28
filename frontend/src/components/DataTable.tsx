import { Group, Pagination, Select, Table, Text } from '@mantine/core';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onRowClick?: (item: T) => void;
  loading?: boolean;
}

export default function DataTable<T extends { id?: string }>({
  columns, data, total, page, pageSize, onPageChange, onPageSizeChange, onRowClick, loading,
}: Props<T>) {
  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            {columns.map((col) => (
              <Table.Th key={col.key}>{col.label}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={columns.length}>
                <Text c="dimmed" ta="center" py="xl">
                  {loading ? 'Loading...' : 'No records found'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            data.map((item, idx) => (
              <Table.Tr
                key={item.id || idx}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <Table.Td key={col.key}>
                    {col.render ? col.render(item) : (item as Record<string, unknown>)[col.key] as string}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      <Group justify="space-between" mt="md">
        <Text size="sm" c="dimmed">
          {total} total records
        </Text>
        <Group>
          {onPageSizeChange && (
            <Select
              size="xs"
              w={80}
              data={['10', '25', '50', '100']}
              value={String(pageSize)}
              onChange={(v) => onPageSizeChange(Number(v))}
            />
          )}
          <Pagination total={totalPages} value={page} onChange={onPageChange} size="sm" />
        </Group>
      </Group>
    </>
  );
}
