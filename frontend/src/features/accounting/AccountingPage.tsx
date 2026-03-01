import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconCalculator,
  IconCheck,
  IconDownload,
  IconEdit,
  IconEye,
  IconFileSpreadsheet,
  IconHistory,
  IconLink,
  IconPlus,
  IconSeedling,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountingApi } from '../../api/services';
import type {
  AccountMapping,
  AccountType,
  ChartOfAccount,
  ExportFormat,
  ExportHistory,
  ExportPreview,
  ExportPreviewRow,
  PaginatedResponse,
} from '../../types';

const formatMoney = (cents: number) => '$' + (cents / 100).toFixed(2);

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  income: 'green',
  expense: 'red',
  asset: 'blue',
  liability: 'orange',
  equity: 'grape',
};

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
];

const SOURCE_TYPE_OPTIONS = [
  { value: 'invoice_income', label: 'Invoice Income' },
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'trust_deposit', label: 'Trust Deposit' },
  { value: 'trust_disbursement', label: 'Trust Disbursement' },
  { value: 'time_entry_wip', label: 'Time Entry WIP' },
  { value: 'expense', label: 'Expense' },
];

const EXPORT_FORMAT_OPTIONS = [
  { value: 'iif', label: 'IIF (QuickBooks)' },
  { value: 'csv', label: 'CSV' },
  { value: 'qbo_json', label: 'QBO JSON' },
];

const EXPORT_TYPE_OPTIONS = [
  { value: 'invoices', label: 'Invoices' },
  { value: 'payments', label: 'Payments' },
  { value: 'time_entries', label: 'Time Entries' },
  { value: 'trust_transactions', label: 'Trust Transactions' },
];

// ── Chart of Accounts Tab ─────────────────────────────────────────────────────

function ChartOfAccountsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);

  const form = useForm({
    initialValues: {
      code: '',
      name: '',
      account_type: 'asset',
      description: '',
      quickbooks_account_name: '',
      xero_account_code: '',
      is_active: true,
    },
    validate: {
      code: (v) => (v.trim() ? null : 'Code is required'),
      name: (v) => (v.trim() ? null : 'Name is required'),
    },
  });

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['chart-of-accounts', page],
    queryFn: async () => {
      const { data } = await accountingApi.listAccounts({ page, page_size: 25 });
      return data;
    },
  });

  const accounts = accountsData?.items ?? [];
  const totalPages = accountsData?.total_pages ?? 1;

  const createMutation = useMutation({
    mutationFn: (data: {
      code: string; name: string; account_type: AccountType; parent_code?: string;
      description?: string; is_active?: boolean; quickbooks_account_name?: string; xero_account_code?: string;
    }) => accountingApi.createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      notifications.show({ title: 'Success', message: 'Account created', color: 'green' });
      closeModal();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create account', color: 'red' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: {
      code?: string; name?: string; account_type?: AccountType; parent_code?: string;
      description?: string; is_active?: boolean; quickbooks_account_name?: string; xero_account_code?: string;
    } }) => accountingApi.updateAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      notifications.show({ title: 'Success', message: 'Account updated', color: 'green' });
      closeModal();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to update account', color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountingApi.deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      notifications.show({ title: 'Success', message: 'Account deleted', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to delete account', color: 'red' });
    },
  });

  const seedMutation = useMutation({
    mutationFn: (data: { template: string }) => accountingApi.seedAccounts(data.template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      notifications.show({ title: 'Success', message: 'Default accounts seeded', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to seed accounts', color: 'red' });
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingAccount(null);
    form.reset();
  };

  const openCreate = () => {
    form.reset();
    setEditingAccount(null);
    setModalOpen(true);
  };

  const openEdit = (account: ChartOfAccount) => {
    setEditingAccount(account);
    form.setValues({
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      description: account.description ?? '',
      quickbooks_account_name: account.quickbooks_account_name ?? '',
      xero_account_code: account.xero_account_code ?? '',
      is_active: account.is_active,
    });
    setModalOpen(true);
  };

  const handleSubmit = (values: typeof form.values) => {
    const payload = {
      code: values.code,
      name: values.name,
      account_type: values.account_type as AccountType,
      description: values.description || undefined,
      quickbooks_account_name: values.quickbooks_account_name || undefined,
      xero_account_code: values.xero_account_code || undefined,
      is_active: values.is_active,
    };
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Chart of Accounts</Title>
        <Group>
          <Button
            variant="outline"
            leftSection={<IconSeedling size={16} />}
            onClick={() => seedMutation.mutate({ template: 'law_firm_default' })}
            loading={seedMutation.isPending}
          >
            Seed Defaults
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Create Account
          </Button>
        </Group>
      </Group>

      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Code</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>QB Name</Table.Th>
              <Table.Th>Xero Code</Table.Th>
              <Table.Th>Active</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {accounts.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text ta="center" c="dimmed" py="md">
                    No accounts found. Click "Seed Defaults" to create standard law firm accounts.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {accounts.map((account: ChartOfAccount) => (
              <Table.Tr key={account.id}>
                <Table.Td>{account.code}</Table.Td>
                <Table.Td>{account.name}</Table.Td>
                <Table.Td>
                  <Badge color={ACCOUNT_TYPE_COLORS[account.account_type] ?? 'gray'} variant="light">
                    {account.account_type}
                  </Badge>
                </Table.Td>
                <Table.Td>{account.quickbooks_account_name ?? '---'}</Table.Td>
                <Table.Td>{account.xero_account_code ?? '---'}</Table.Td>
                <Table.Td>
                  <Switch checked={account.is_active} readOnly size="sm" />
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(account)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => deleteMutation.mutate(account.id)}
                      loading={deleteMutation.isPending}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Text size="sm">
            Page {page} of {totalPages}
          </Text>
          <Button
            variant="outline"
            size="xs"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </Group>
      )}

      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={editingAccount ? 'Edit Account' : 'Create Account'}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <Group grow>
              <TextInput label="Code" placeholder="e.g. 4000" required {...form.getInputProps('code')} />
              <Select
                label="Account Type"
                data={ACCOUNT_TYPE_OPTIONS}
                required
                {...form.getInputProps('account_type')}
              />
            </Group>
            <TextInput label="Name" placeholder="Account name" required {...form.getInputProps('name')} />
            <TextInput
              label="Description"
              placeholder="Optional description"
              {...form.getInputProps('description')}
            />
            <Group grow>
              <TextInput
                label="QuickBooks Account Name"
                placeholder="QB mapping name"
                {...form.getInputProps('quickbooks_account_name')}
              />
              <TextInput
                label="Xero Account Code"
                placeholder="Xero code"
                {...form.getInputProps('xero_account_code')}
              />
            </Group>
            <Switch label="Active" {...form.getInputProps('is_active', { type: 'checkbox' })} />
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingAccount ? 'Update Account' : 'Create Account'}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

// ── Account Mappings Tab ──────────────────────────────────────────────────────

function AccountMappingsTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<AccountMapping | null>(null);

  const form = useForm({
    initialValues: {
      source_type: '',
      account_id: '',
      is_default: false,
    },
    validate: {
      source_type: (v) => (v ? null : 'Source type is required'),
      account_id: (v) => (v ? null : 'Account is required'),
    },
  });

  const { data: mappingsData, isLoading } = useQuery({
    queryKey: ['account-mappings'],
    queryFn: async () => {
      const { data } = await accountingApi.listMappings({});
      return data;
    },
  });

  const { data: accountsData } = useQuery({
    queryKey: ['chart-of-accounts-all'],
    queryFn: async () => {
      const { data } = await accountingApi.listAccounts({ page: 1, page_size: 500 });
      return data;
    },
  });

  const mappings = Array.isArray(mappingsData) ? mappingsData : (mappingsData as PaginatedResponse<AccountMapping> | undefined)?.items ?? [];
  const allAccounts = accountsData?.items ?? [];

  const accountOptions = allAccounts.map((a: ChartOfAccount) => ({
    value: a.id,
    label: `${a.code} - ${a.name}`,
  }));

  const createMutation = useMutation({
    mutationFn: (data: { source_type: string; account_id: string; description?: string; is_default?: boolean }) => accountingApi.createMapping(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-mappings'] });
      notifications.show({ title: 'Success', message: 'Mapping created', color: 'green' });
      closeModal();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create mapping', color: 'red' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { source_type?: string; account_id?: string; description?: string; is_default?: boolean } }) => accountingApi.updateMapping(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-mappings'] });
      notifications.show({ title: 'Success', message: 'Mapping updated', color: 'green' });
      closeModal();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to update mapping', color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountingApi.deleteMapping(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-mappings'] });
      notifications.show({ title: 'Success', message: 'Mapping deleted', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to delete mapping', color: 'red' });
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingMapping(null);
    form.reset();
  };

  const openCreate = () => {
    form.reset();
    setEditingMapping(null);
    setModalOpen(true);
  };

  const openEdit = (mapping: AccountMapping) => {
    setEditingMapping(mapping);
    form.setValues({
      source_type: mapping.source_type,
      account_id: mapping.account_id,
      is_default: mapping.is_default,
    });
    setModalOpen(true);
  };

  const handleSubmit = (values: typeof form.values) => {
    const payload = {
      source_type: values.source_type,
      account_id: values.account_id,
      is_default: values.is_default,
    };
    if (editingMapping) {
      updateMutation.mutate({ id: editingMapping.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Account Mappings</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Create Mapping
        </Button>
      </Group>

      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Source Type</Table.Th>
              <Table.Th>Account</Table.Th>
              <Table.Th>Default</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {mappings.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text ta="center" c="dimmed" py="md">
                    No account mappings found
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {mappings.map((mapping: AccountMapping) => (
              <Table.Tr key={mapping.id}>
                <Table.Td>
                  <Badge variant="light">{mapping.source_type}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {mapping.account_name ?? '---'}
                    {mapping.account_code ? ` (${mapping.account_code})` : ''}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {mapping.is_default ? (
                    <IconCheck size={16} color="green" />
                  ) : (
                    <Text size="sm" c="dimmed">
                      ---
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(mapping)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => deleteMutation.mutate(mapping.id)}
                      loading={deleteMutation.isPending}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={editingMapping ? 'Edit Mapping' : 'Create Mapping'}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <Select
              label="Source Type"
              placeholder="Select source type"
              data={SOURCE_TYPE_OPTIONS}
              required
              {...form.getInputProps('source_type')}
            />
            <Select
              label="Account"
              placeholder="Select account"
              data={accountOptions}
              searchable
              required
              {...form.getInputProps('account_id')}
            />
            <Switch label="Default mapping" {...form.getInputProps('is_default', { type: 'checkbox' })} />
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingMapping ? 'Update Mapping' : 'Create Mapping'}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

// ── Export Tab ─────────────────────────────────────────────────────────────────

function ExportTab() {
  const [exportFormat, setExportFormat] = useState<string | null>('csv');
  const [exportType, setExportType] = useState<string | null>('invoices');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preview, setPreview] = useState<ExportPreview | null>(null);

  const previewMutation = useMutation({
    mutationFn: (data: { format: ExportFormat; export_type: string; start_date: string; end_date: string }) => accountingApi.previewExport(data),
    onSuccess: (res) => {
      setPreview(res.data);
      notifications.show({ title: 'Preview Ready', message: 'Export preview generated', color: 'blue' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to generate preview', color: 'red' });
    },
  });

  const exportMutation = useMutation({
    mutationFn: (data: { format: ExportFormat; export_type: string; start_date: string; end_date: string }) => accountingApi.generateExport(data),
    onSuccess: (res) => {
      const blob = res instanceof Blob ? res : new Blob([res.data ?? res]);
      const ext = exportFormat === 'json' ? 'json' : exportFormat ?? 'csv';
      const filename = `export_${exportType}_${startDate}_${endDate}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      notifications.show({ title: 'Success', message: 'Export downloaded', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Export failed', color: 'red' });
    },
  });

  const canSubmit = exportFormat && exportType && startDate && endDate;

  const handlePreview = () => {
    if (!exportFormat || !exportType || !startDate || !endDate) return;
    previewMutation.mutate({
      format: exportFormat as ExportFormat,
      export_type: exportType,
      start_date: startDate,
      end_date: endDate,
    });
  };

  const handleExport = () => {
    if (!exportFormat || !exportType || !startDate || !endDate) return;
    exportMutation.mutate({
      format: exportFormat as ExportFormat,
      export_type: exportType,
      start_date: startDate,
      end_date: endDate,
    });
  };

  const previewData = preview;
  const sampleRows: ExportPreviewRow[] = previewData?.sample_rows ?? [];
  const firstRow = sampleRows.length > 0 ? sampleRows[0] : undefined;
  const sampleKeys = firstRow ? Object.keys(firstRow.values) : [];

  return (
    <Stack>
      <Card shadow="sm" padding="lg" withBorder>
        <Stack>
          <Title order={4}>Export Accounting Data</Title>

          <Group grow>
            <Select
              label="Format"
              data={EXPORT_FORMAT_OPTIONS}
              value={exportFormat}
              onChange={setExportFormat}
            />
            <Select
              label="Export Type"
              data={EXPORT_TYPE_OPTIONS}
              value={exportType}
              onChange={setExportType}
            />
          </Group>

          <Group grow>
            <TextInput
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.currentTarget.value)}
            />
            <TextInput
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.currentTarget.value)}
            />
          </Group>

          <Group>
            <Button
              variant="outline"
              leftSection={<IconEye size={16} />}
              onClick={handlePreview}
              loading={previewMutation.isPending}
              disabled={!canSubmit}
            >
              Preview
            </Button>
            <Button
              leftSection={<IconDownload size={16} />}
              onClick={handleExport}
              loading={exportMutation.isPending}
              disabled={!canSubmit}
            >
              Export
            </Button>
          </Group>
        </Stack>
      </Card>

      {previewData && (
        <Card shadow="sm" padding="lg" withBorder>
          <Stack>
            <Group justify="space-between">
              <Title order={4}>Preview</Title>
              <Group>
                <Badge variant="light" size="lg">
                  {previewData.row_count ?? 0} records
                </Badge>
                <Badge variant="light" color="green" size="lg">
                  Total: {formatMoney(previewData.total_amount_cents ?? 0)}
                </Badge>
              </Group>
            </Group>

            {sampleRows.length > 0 ? (
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    {sampleKeys.map((key) => (
                      <Table.Th key={key}>{key}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sampleRows.map((row: ExportPreviewRow, i: number) => {
                    const rowValues = row.values;
                    return (
                      <Table.Tr key={i}>
                        {sampleKeys.map((key) => (
                          <Table.Td key={key}>
                            <Text size="sm">{String(rowValues[key] ?? '')}</Text>
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            ) : (
              <Text ta="center" c="dimmed" py="md">
                No records found for the selected criteria
              </Text>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

// ── Export History Tab ─────────────────────────────────────────────────────────

function ExportHistoryTab() {
  const [page, setPage] = useState(1);

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['export-history', page],
    queryFn: async () => {
      const { data } = await accountingApi.listExportHistory({ page, page_size: 25 });
      return data;
    },
  });

  const history = historyData?.items ?? [];
  const totalPages = historyData?.total_pages ?? 1;

  const FORMAT_COLORS: Record<string, string> = {
    iif: 'blue',
    csv: 'green',
    json: 'violet',
  };

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <Stack>
      <Title order={4}>Export History</Title>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Format</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Date Range</Table.Th>
            <Table.Th>Records</Table.Th>
            <Table.Th>Exported By</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {history.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text ta="center" c="dimmed" py="md">
                  No export history found
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
          {history.map((entry: ExportHistory) => (
            <Table.Tr key={entry.id}>
              <Table.Td>{new Date(entry.created_at).toLocaleString()}</Table.Td>
              <Table.Td>
                <Badge color={FORMAT_COLORS[entry.export_format] ?? 'gray'} variant="light">
                  {(entry.export_format ?? '').toUpperCase()}
                </Badge>
              </Table.Td>
              <Table.Td>{entry.export_type}</Table.Td>
              <Table.Td>
                {entry.start_date} - {entry.end_date}
              </Table.Td>
              <Table.Td>{entry.record_count}</Table.Td>
              <Table.Td>{entry.exported_by ?? '---'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Text size="sm">
            Page {page} of {totalPages}
          </Text>
          <Button
            variant="outline"
            size="xs"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </Group>
      )}
    </Stack>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  return (
    <Stack>
      <Group>
        <IconCalculator size={28} />
        <Title order={2}>Accounting Integration</Title>
      </Group>

      <Tabs defaultValue="accounts">
        <Tabs.List>
          <Tabs.Tab value="accounts" leftSection={<IconCalculator size={16} />}>
            Chart of Accounts
          </Tabs.Tab>
          <Tabs.Tab value="mappings" leftSection={<IconLink size={16} />}>
            Account Mappings
          </Tabs.Tab>
          <Tabs.Tab value="export" leftSection={<IconFileSpreadsheet size={16} />}>
            Export
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
            Export History
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="accounts" pt="md">
          <ChartOfAccountsTab />
        </Tabs.Panel>

        <Tabs.Panel value="mappings" pt="md">
          <AccountMappingsTab />
        </Tabs.Panel>

        <Tabs.Panel value="export" pt="md">
          <ExportTab />
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <ExportHistoryTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
