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
  caption?: string;
}

export default function DataTable<T extends { id?: string }>({
  columns, data, total, page, pageSize, onPageChange, onPageSizeChange, onRowClick, loading, caption,
}: Props<T>) {
  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <>
      <Table striped highlightOnHover withTableBorder>
        {caption && (
          <caption style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
            {caption}
          </caption>
        )}
        <Table.Thead>
          <Table.Tr>
            {columns.map((col) => (
              <Table.Th key={col.key} scope="col">{col.label}</Table.Th>
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
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                onKeyDown={onRowClick ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(item); } } : undefined}
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
              aria-label="Rows per page"
            />
          )}
          <Pagination total={totalPages} value={page} onChange={onPageChange} size="sm" aria-label="Pagination" />
        </Group>
      </Group>
    </>
  );
}
