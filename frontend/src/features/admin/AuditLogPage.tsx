import { useState } from 'react';
import {
  Badge, Card, Code, Group, Select, Stack, Table, Text, TextInput, Title, Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import { IconShieldLock } from '@tabler/icons-react';
import { adminApi } from '../../api/services';
import DataTable from '../../components/DataTable';

const SEVERITY_COLORS: Record<string, string> = {
  info: 'blue',
  low: 'cyan',
  medium: 'yellow',
  high: 'orange',
  critical: 'red',
};

const OUTCOME_COLORS: Record<string, string> = {
  success: 'green',
  failure: 'red',
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [entityType, setEntityType] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, pageSize, entityType, action, severity],
    queryFn: () => adminApi.listAuditLogs({
      page,
      page_size: pageSize,
      entity_type: entityType || undefined,
      action: action || undefined,
      severity: severity || undefined,
    }),
  });

  const logs = data?.data?.items || [];
  const total = data?.data?.total || 0;

  const columns = [
    {
      key: 'timestamp',
      label: 'Time',
      render: (item: Record<string, unknown>) => (
        <Text size="xs">{new Date(item.timestamp as string).toLocaleString()}</Text>
      ),
    },
    {
      key: 'user_email',
      label: 'User',
      render: (item: Record<string, unknown>) => (
        <Text size="xs">{(item.user_email as string) || 'System'}</Text>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (item: Record<string, unknown>) => (
        <Badge variant="light" size="sm">{item.action as string}</Badge>
      ),
    },
    {
      key: 'entity_type',
      label: 'Entity',
      render: (item: Record<string, unknown>) => (
        <Group gap={4}>
          <Text size="xs">{item.entity_type as string}</Text>
          <Code>{(item.entity_id as string)?.substring(0, 8)}...</Code>
        </Group>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (item: Record<string, unknown>) => (
        <Badge color={SEVERITY_COLORS[item.severity as string] || 'gray'} size="sm" variant="filled">
          {item.severity as string}
        </Badge>
      ),
    },
    {
      key: 'outcome',
      label: 'Outcome',
      render: (item: Record<string, unknown>) => (
        <Badge color={OUTCOME_COLORS[item.outcome as string] || 'gray'} size="sm" variant="dot">
          {item.outcome as string}
        </Badge>
      ),
    },
    {
      key: 'ip_address',
      label: 'IP',
      render: (item: Record<string, unknown>) => (
        <Text size="xs" c="dimmed">{(item.ip_address as string) || '-'}</Text>
      ),
    },
    {
      key: 'integrity_hash',
      label: 'Hash',
      render: (item: Record<string, unknown>) => (
        <Tooltip label={item.integrity_hash as string}>
          <Code>{(item.integrity_hash as string)?.substring(0, 12)}...</Code>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack>
      <Group>
        <IconShieldLock size={28} />
        <Title order={2}>Audit Logs</Title>
      </Group>

      <Text size="sm" c="dimmed">
        Immutable audit trail with SHA-256 hash chain for nonrepudiation. Every create, update, and delete action is recorded.
      </Text>

      <Group>
        <Select
          placeholder="Entity type"
          clearable
          value={entityType}
          onChange={setEntityType}
          data={['user', 'client', 'contact', 'matter', 'document', 'calendar_event', 'time_entry', 'invoice', 'payment', 'trust_account', 'trust_ledger_entry', 'system_setting', 'audit_log']}
          w={180}
        />
        <Select
          placeholder="Action"
          clearable
          value={action}
          onChange={setAction}
          data={['create', 'update', 'delete', 'login', 'login_failed', 'logout', 'password_change', 'settings_change', 'export']}
          w={160}
        />
        <Select
          placeholder="Severity"
          clearable
          value={severity}
          onChange={setSeverity}
          data={['info', 'low', 'medium', 'high', 'critical']}
          w={140}
        />
      </Group>

      <DataTable
        columns={columns}
        data={logs}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        loading={isLoading}
      />
    </Stack>
  );
}
