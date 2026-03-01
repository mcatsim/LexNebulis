import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconBuildingBank,
  IconMinus,
  IconPlus,
  IconRefresh,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DataTable from '../../components/DataTable';
import { trustApi, clientsApi, mattersApi } from '../../api/services';
import type { TrustAccount, TrustLedgerEntry } from '../../types';

const formatMoney = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

// ---------------------------------------------------------------------------
// Account Detail (Ledger View)
// ---------------------------------------------------------------------------
function AccountDetail({
  account,
  onBack,
}: {
  account: TrustAccount;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<'deposit' | 'disbursement'>('deposit');
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);

  const entryForm = useForm({
    initialValues: {
      client_id: '',
      matter_id: '',
      amount_cents: 0,
      description: '',
      reference_number: '',
      entry_date: new Date().toISOString().slice(0, 10),
    },
    validate: {
      client_id: (v) => (v ? null : 'Client is required'),
      amount_cents: (v) => (v > 0 ? null : 'Amount must be > 0'),
      description: (v) => (v.trim() ? null : 'Description is required'),
      entry_date: (v) => (v ? null : 'Date is required'),
    },
  });

  const reconcileForm = useForm({
    initialValues: {
      statement_balance_cents: 0,
      reconciliation_date: new Date().toISOString().slice(0, 10),
      notes: '',
    },
    validate: {
      statement_balance_cents: (v) => (v >= 0 ? null : 'Balance must be >= 0'),
      reconciliation_date: (v) => (v ? null : 'Date is required'),
    },
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients', { page: 1, page_size: 200 }],
    queryFn: () => clientsApi.list({ page: 1, page_size: 200 }),
  });

  const { data: mattersData } = useQuery({
    queryKey: ['matters', { page: 1, page_size: 200 }],
    queryFn: () => mattersApi.list({ page: 1, page_size: 200 }),
  });

  const clientOptions = useMemo(
    () =>
      (clientsData?.data?.items ?? []).map((c) => ({
        value: c.id,
        label: c.organization_name ?? `${c.first_name} ${c.last_name}`,
      })),
    [clientsData],
  );

  const clientLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clientsData?.data?.items ?? []) {
      map.set(c.id, c.organization_name ?? `${c.first_name} ${c.last_name}`);
    }
    return map;
  }, [clientsData]);

  const matterOptions = useMemo(
    () =>
      [
        { value: '', label: '(No matter)' },
        ...(mattersData?.data?.items ?? []).map((m) => ({
          value: m.id,
          label: `${m.matter_number} - ${m.title}`,
        })),
      ],
    [mattersData],
  );

  const queryParams = useMemo(
    () => ({
      page,
      client_id: clientFilter ?? undefined,
    }),
    [page, clientFilter],
  );

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['trust-ledger', account.id, queryParams],
    queryFn: () => trustApi.listLedger(account.id, queryParams),
  });

  const entryMutation = useMutation({
    mutationFn: (data: Parameters<typeof trustApi.createLedgerEntry>[0]) =>
      trustApi.createLedgerEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trust-ledger', account.id] });
      queryClient.invalidateQueries({ queryKey: ['trust-accounts'] });
      notifications.show({ title: 'Success', message: 'Ledger entry created', color: 'green' });
      setEntryModalOpen(false);
      entryForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create entry', color: 'red' });
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: (data: Parameters<typeof trustApi.createReconciliation>[0]) =>
      trustApi.createReconciliation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trust-accounts'] });
      notifications.show({ title: 'Success', message: 'Reconciliation recorded', color: 'green' });
      setReconcileModalOpen(false);
      reconcileForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to reconcile', color: 'red' });
    },
  });

  const handleEntry = (values: typeof entryForm.values) => {
    entryMutation.mutate({
      trust_account_id: account.id,
      client_id: values.client_id,
      matter_id: values.matter_id || undefined,
      entry_type: entryType,
      amount_cents: values.amount_cents,
      description: values.description,
      reference_number: values.reference_number || undefined,
      entry_date: values.entry_date,
    });
  };

  const handleReconcile = (values: typeof reconcileForm.values) => {
    reconcileMutation.mutate({
      trust_account_id: account.id,
      statement_balance_cents: values.statement_balance_cents,
      reconciliation_date: values.reconciliation_date,
      notes: values.notes || undefined,
    });
  };

  const openEntryModal = (type: 'deposit' | 'disbursement') => {
    setEntryType(type);
    entryForm.reset();
    setEntryModalOpen(true);
  };

  const entries = ledgerData?.data?.items ?? [];
  const total = ledgerData?.data?.total ?? 0;

  const columns = [
    {
      key: 'entry_date',
      label: 'Date',
      render: (e: TrustLedgerEntry) => new Date(e.entry_date).toLocaleDateString(),
    },
    {
      key: 'entry_type',
      label: 'Type',
      render: (e: TrustLedgerEntry) => (
        <Badge
          color={e.entry_type === 'deposit' ? 'green' : e.entry_type === 'disbursement' ? 'red' : 'blue'}
          variant="light"
          size="sm"
        >
          {e.entry_type.charAt(0).toUpperCase() + e.entry_type.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'client_id',
      label: 'Client',
      render: (e: TrustLedgerEntry) => clientLookup.get(e.client_id) ?? e.client_id.slice(0, 8),
    },
    { key: 'description', label: 'Description' },
    { key: 'reference_number', label: 'Reference' },
    {
      key: 'amount_cents',
      label: 'Amount',
      render: (e: TrustLedgerEntry) => (
        <Text
          size="sm"
          c={e.entry_type === 'deposit' ? 'green' : 'red'}
          fw={600}
        >
          {e.entry_type === 'deposit' ? '+' : '-'}{formatMoney(e.amount_cents)}
        </Text>
      ),
    },
    {
      key: 'running_balance_cents',
      label: 'Running Balance',
      render: (e: TrustLedgerEntry) => (
        <Text size="sm" fw={600}>{formatMoney(e.running_balance_cents)}</Text>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
            Back to Accounts
          </Button>
          <Title order={3}>{account.account_name}</Title>
          <Badge variant="light" size="lg">
            Balance: {formatMoney(account.balance_cents)}
          </Badge>
        </Group>
        <Group>
          <Select
            placeholder="Filter by client"
            data={clientOptions}
            searchable
            clearable
            value={clientFilter}
            onChange={setClientFilter}
            w={220}
          />
          <Button
            color="green"
            leftSection={<IconPlus size={16} />}
            onClick={() => openEntryModal('deposit')}
          >
            Deposit
          </Button>
          <Button
            color="red"
            leftSection={<IconMinus size={16} />}
            onClick={() => openEntryModal('disbursement')}
          >
            Disburse
          </Button>
          <Button
            variant="outline"
            leftSection={<IconRefresh size={16} />}
            onClick={() => setReconcileModalOpen(true)}
          >
            Reconcile
          </Button>
        </Group>
      </Group>

      <DataTable<TrustLedgerEntry>
        columns={columns}
        data={entries}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        loading={isLoading}
      />

      {/* Deposit / Disburse Modal */}
      <Modal
        opened={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        title={entryType === 'deposit' ? 'Record Deposit' : 'Record Disbursement'}
        size="md"
      >
        <form onSubmit={entryForm.onSubmit(handleEntry)}>
          <Stack>
            <Select
              label="Client"
              placeholder="Select client"
              data={clientOptions}
              searchable
              required
              {...entryForm.getInputProps('client_id')}
            />
            <Select
              label="Matter (optional)"
              placeholder="Select matter"
              data={matterOptions}
              searchable
              clearable
              {...entryForm.getInputProps('matter_id')}
            />
            <NumberInput
              label="Amount (cents)"
              min={1}
              required
              description={`Amount: ${formatMoney(entryForm.values.amount_cents)}`}
              {...entryForm.getInputProps('amount_cents')}
            />
            <TextInput
              label="Description"
              required
              {...entryForm.getInputProps('description')}
            />
            <TextInput
              label="Reference Number"
              placeholder="Optional"
              {...entryForm.getInputProps('reference_number')}
            />
            <TextInput
              label="Entry Date"
              type="date"
              required
              {...entryForm.getInputProps('entry_date')}
            />
            <Button
              type="submit"
              color={entryType === 'deposit' ? 'green' : 'red'}
              loading={entryMutation.isPending}
            >
              {entryType === 'deposit' ? 'Record Deposit' : 'Record Disbursement'}
            </Button>
          </Stack>
        </form>
      </Modal>

      {/* Reconcile Modal */}
      <Modal
        opened={reconcileModalOpen}
        onClose={() => setReconcileModalOpen(false)}
        title="Reconcile Account"
        size="md"
      >
        <form onSubmit={reconcileForm.onSubmit(handleReconcile)}>
          <Stack>
            <NumberInput
              label="Statement Balance (cents)"
              min={0}
              required
              description={`Balance: ${formatMoney(reconcileForm.values.statement_balance_cents)}`}
              {...reconcileForm.getInputProps('statement_balance_cents')}
            />
            <TextInput
              label="Reconciliation Date"
              type="date"
              required
              {...reconcileForm.getInputProps('reconciliation_date')}
            />
            <Textarea
              label="Notes"
              placeholder="Optional notes"
              {...reconcileForm.getInputProps('notes')}
            />
            <Button type="submit" loading={reconcileMutation.isPending}>
              Submit Reconciliation
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Trust Page (main)
// ---------------------------------------------------------------------------
export default function TrustPage() {
  const queryClient = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState<TrustAccount | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const accountForm = useForm({
    initialValues: {
      account_name: '',
      bank_name: '',
      account_number: '',
      routing_number: '',
    },
    validate: {
      account_name: (v) => (v.trim() ? null : 'Account name is required'),
      bank_name: (v) => (v.trim() ? null : 'Bank name is required'),
      account_number: (v) => (v.trim() ? null : 'Account number is required'),
      routing_number: (v) => (v.trim() ? null : 'Routing number is required'),
    },
  });

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['trust-accounts'],
    queryFn: () => trustApi.listAccounts(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof trustApi.createAccount>[0]) =>
      trustApi.createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trust-accounts'] });
      notifications.show({ title: 'Success', message: 'Trust account created', color: 'green' });
      setCreateModalOpen(false);
      accountForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create trust account', color: 'red' });
    },
  });

  const handleCreate = (values: typeof accountForm.values) => {
    createMutation.mutate(values);
  };

  if (selectedAccount) {
    return (
      <AccountDetail
        account={selectedAccount}
        onBack={() => setSelectedAccount(null)}
      />
    );
  }

  const accounts: TrustAccount[] = Array.isArray(accountsData?.data)
    ? accountsData.data
    : [];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={1}>Trust Accounts</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
          New Trust Account
        </Button>
      </Group>

      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : accounts.length === 0 ? (
        <Card shadow="sm" padding="xl" radius="md" withBorder>
          <Text c="dimmed" ta="center">
            No trust accounts found. Create your first trust account to get started.
          </Text>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {accounts.map((acct) => (
            <Card
              key={acct.id}
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedAccount(acct)}
            >
              <Group justify="space-between" mb="sm">
                <Group>
                  <IconBuildingBank size={24} color="var(--mantine-color-blue-6)" />
                  <div>
                    <Text fw={600} size="lg">{acct.account_name}</Text>
                    <Text size="sm" c="dimmed">{acct.bank_name}</Text>
                  </div>
                </Group>
                <Badge color={acct.is_active ? 'green' : 'gray'} variant="light">
                  {acct.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </Group>
              <Group justify="space-between" mt="md">
                <Text size="sm" c="dimmed">Balance</Text>
                <Text fw={700} size="xl" c={acct.balance_cents >= 0 ? 'green' : 'red'}>
                  {formatMoney(acct.balance_cents)}
                </Text>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* Create Trust Account Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="New Trust Account"
        size="md"
      >
        <form onSubmit={accountForm.onSubmit(handleCreate)}>
          <Stack>
            <TextInput
              label="Account Name"
              placeholder="e.g. Client Trust IOLTA"
              required
              {...accountForm.getInputProps('account_name')}
            />
            <TextInput
              label="Bank Name"
              placeholder="e.g. First National Bank"
              required
              {...accountForm.getInputProps('bank_name')}
            />
            <TextInput
              label="Account Number"
              placeholder="Account number"
              required
              {...accountForm.getInputProps('account_number')}
            />
            <TextInput
              label="Routing Number"
              placeholder="Routing number"
              required
              {...accountForm.getInputProps('routing_number')}
            />
            <Button type="submit" loading={createMutation.isPending}>
              Create Account
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
