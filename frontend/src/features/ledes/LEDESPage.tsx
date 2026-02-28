import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Code,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconDownload,
  IconEdit,
  IconPlus,
  IconReceipt2,
  IconSeedling,
  IconShieldCheck,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DataTable from '../../components/DataTable';
import { billingApi, clientsApi, ledesApi } from '../../api/services';
import { useAuthStore } from '../../stores/authStore';
import type {
  BillingGuideline,
  BlockBillingResult,
  ComplianceResult,
  Invoice,
  UTBMSCode,
  UTBMSCodeType,
} from '../../types';

const formatMoney = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

const CODE_TYPE_OPTIONS: { value: UTBMSCodeType; label: string }[] = [
  { value: 'phase', label: 'Phase' },
  { value: 'task', label: 'Task' },
  { value: 'activity', label: 'Activity' },
  { value: 'expense', label: 'Expense' },
];

const PRACTICE_AREA_OPTIONS = [
  { value: 'litigation', label: 'Litigation' },
  { value: 'counseling', label: 'Counseling' },
  { value: 'ip', label: 'Intellectual Property' },
  { value: 'bankruptcy', label: 'Bankruptcy' },
];

const CODE_TYPE_COLORS: Record<UTBMSCodeType, string> = {
  phase: 'blue',
  task: 'violet',
  activity: 'green',
  expense: 'orange',
};

// ---------------------------------------------------------------------------
// UTBMS Codes Tab
// ---------------------------------------------------------------------------
function UTBMSCodesTab() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<UTBMSCode | null>(null);

  const form = useForm({
    initialValues: {
      code: '',
      code_type: 'activity' as UTBMSCodeType,
      name: '',
      description: '',
      practice_area: '',
      is_active: true,
    },
    validate: {
      code: (v) => (v.trim() ? null : 'Code is required'),
      name: (v) => (v.trim() ? null : 'Name is required'),
    },
  });

  const queryParams = useMemo(() => ({
    page,
    page_size: pageSize,
    code_type: (typeFilter as UTBMSCodeType) || undefined,
    practice_area: areaFilter || undefined,
    search: searchFilter || undefined,
  }), [page, pageSize, typeFilter, areaFilter, searchFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['utbms-codes', queryParams],
    queryFn: () => ledesApi.listCodes(queryParams),
  });

  const createMutation = useMutation({
    mutationFn: (d: Parameters<typeof ledesApi.createCode>[0]) => ledesApi.createCode(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utbms-codes'] });
      notifications.show({ title: 'Success', message: 'UTBMS code created', color: 'green' });
      closeModal();
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to create code', color: 'red' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: Parameters<typeof ledesApi.updateCode>[1] }) =>
      ledesApi.updateCode(id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utbms-codes'] });
      notifications.show({ title: 'Success', message: 'UTBMS code updated', color: 'green' });
      closeModal();
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to update code', color: 'red' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ledesApi.deleteCode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utbms-codes'] });
      notifications.show({ title: 'Success', message: 'UTBMS code deleted', color: 'green' });
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to delete code', color: 'red' }),
  });

  const seedMutation = useMutation({
    mutationFn: () => ledesApi.seedCodes(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['utbms-codes'] });
      notifications.show({
        title: 'Success',
        message: `Seeded ${res.data.codes_created} UTBMS codes`,
        color: 'green',
      });
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to seed codes', color: 'red' }),
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingCode(null);
    form.reset();
  };

  const openCreate = () => {
    form.reset();
    setEditingCode(null);
    setModalOpen(true);
  };

  const openEdit = (code: UTBMSCode) => {
    setEditingCode(code);
    form.setValues({
      code: code.code,
      code_type: code.code_type,
      name: code.name,
      description: code.description || '',
      practice_area: code.practice_area || '',
      is_active: code.is_active,
    });
    setModalOpen(true);
  };

  const handleSubmit = (values: typeof form.values) => {
    const payload = {
      code: values.code,
      code_type: values.code_type,
      name: values.name,
      description: values.description || undefined,
      practice_area: values.practice_area || undefined,
      is_active: values.is_active,
    };
    if (editingCode) {
      updateMutation.mutate({ id: editingCode.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const codes = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const columns = [
    { key: 'code', label: 'Code' },
    {
      key: 'code_type',
      label: 'Type',
      render: (c: UTBMSCode) => (
        <Badge color={CODE_TYPE_COLORS[c.code_type]} variant="light" size="sm">
          {c.code_type}
        </Badge>
      ),
    },
    { key: 'name', label: 'Name' },
    { key: 'practice_area', label: 'Practice Area', render: (c: UTBMSCode) => c.practice_area || '-' },
    {
      key: 'is_active',
      label: 'Status',
      render: (c: UTBMSCode) => (
        <Badge color={c.is_active ? 'green' : 'gray'} variant="light" size="sm">
          {c.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (c: UTBMSCode) => (
        <Group gap="xs">
          <ActionIcon variant="subtle" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); openEdit(c); }}>
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              deleteMutation.mutate(c.id);
            }}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <TextInput
            placeholder="Search codes..."
            value={searchFilter}
            onChange={(e) => { setSearchFilter(e.currentTarget.value); setPage(1); }}
            w={200}
          />
          <Select
            placeholder="Filter by type"
            data={CODE_TYPE_OPTIONS}
            clearable
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
            w={160}
          />
          <Select
            placeholder="Practice area"
            data={PRACTICE_AREA_OPTIONS}
            clearable
            value={areaFilter}
            onChange={(v) => { setAreaFilter(v); setPage(1); }}
            w={180}
          />
        </Group>
        <Group>
          {isAdmin && (
            <Button
              variant="outline"
              leftSection={<IconSeedling size={16} />}
              onClick={() => seedMutation.mutate()}
              loading={seedMutation.isPending}
            >
              Seed Standard Codes
            </Button>
          )}
          {isAdmin && (
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              New Code
            </Button>
          )}
        </Group>
      </Group>

      <DataTable<UTBMSCode>
        columns={columns}
        data={codes}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        loading={isLoading}
      />

      <Modal opened={modalOpen} onClose={closeModal} title={editingCode ? 'Edit UTBMS Code' : 'New UTBMS Code'} size="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput label="Code" placeholder="e.g. A101" required {...form.getInputProps('code')} />
            <Select
              label="Code Type"
              data={CODE_TYPE_OPTIONS}
              required
              {...form.getInputProps('code_type')}
            />
            <TextInput label="Name" placeholder="Code name" required {...form.getInputProps('name')} />
            <Textarea label="Description" placeholder="Optional description" {...form.getInputProps('description')} />
            <Select
              label="Practice Area"
              data={PRACTICE_AREA_OPTIONS}
              clearable
              placeholder="Optional"
              {...form.getInputProps('practice_area')}
            />
            <Switch label="Active" {...form.getInputProps('is_active', { type: 'checkbox' })} />
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingCode ? 'Update Code' : 'Create Code'}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Billing Guidelines Tab
// ---------------------------------------------------------------------------
function BillingGuidelinesTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState<BillingGuideline | null>(null);

  const form = useForm({
    initialValues: {
      client_id: '',
      name: '',
      rate_cap_cents: 0,
      daily_hour_cap: 0,
      block_billing_prohibited: false,
      task_code_required: false,
      activity_code_required: false,
      restricted_codes_text: '',
      notes: '',
      is_active: true,
    },
    validate: {
      client_id: (v) => (v ? null : 'Client is required'),
      name: (v) => (v.trim() ? null : 'Name is required'),
    },
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients', { page: 1, page_size: 200 }],
    queryFn: () => clientsApi.list({ page: 1, page_size: 200 }),
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

  const queryParams = useMemo(() => ({
    page,
    page_size: pageSize,
    client_id: clientFilter || undefined,
  }), [page, pageSize, clientFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['billing-guidelines', queryParams],
    queryFn: () => ledesApi.listGuidelines(queryParams),
  });

  const createMutation = useMutation({
    mutationFn: (d: Parameters<typeof ledesApi.createGuideline>[0]) => ledesApi.createGuideline(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-guidelines'] });
      notifications.show({ title: 'Success', message: 'Billing guideline created', color: 'green' });
      closeModal();
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to create guideline', color: 'red' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: Parameters<typeof ledesApi.updateGuideline>[1] }) =>
      ledesApi.updateGuideline(id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-guidelines'] });
      notifications.show({ title: 'Success', message: 'Guideline updated', color: 'green' });
      closeModal();
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to update guideline', color: 'red' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ledesApi.deleteGuideline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-guidelines'] });
      notifications.show({ title: 'Success', message: 'Guideline deleted', color: 'green' });
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to delete guideline', color: 'red' }),
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingGuideline(null);
    form.reset();
  };

  const openCreate = () => {
    form.reset();
    setEditingGuideline(null);
    setModalOpen(true);
  };

  const openEdit = (g: BillingGuideline) => {
    setEditingGuideline(g);
    form.setValues({
      client_id: g.client_id,
      name: g.name,
      rate_cap_cents: g.rate_cap_cents ?? 0,
      daily_hour_cap: g.daily_hour_cap ?? 0,
      block_billing_prohibited: g.block_billing_prohibited,
      task_code_required: g.task_code_required,
      activity_code_required: g.activity_code_required,
      restricted_codes_text: g.restricted_codes ? g.restricted_codes.join(', ') : '',
      notes: g.notes || '',
      is_active: g.is_active,
    });
    setModalOpen(true);
  };

  const handleSubmit = (values: typeof form.values) => {
    const restricted = values.restricted_codes_text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      client_id: values.client_id,
      name: values.name,
      rate_cap_cents: values.rate_cap_cents || undefined,
      daily_hour_cap: values.daily_hour_cap || undefined,
      block_billing_prohibited: values.block_billing_prohibited,
      task_code_required: values.task_code_required,
      activity_code_required: values.activity_code_required,
      restricted_codes: restricted.length > 0 ? restricted : undefined,
      notes: values.notes || undefined,
      is_active: values.is_active,
    };
    if (editingGuideline) {
      updateMutation.mutate({ id: editingGuideline.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const guidelines = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const columns = [
    { key: 'name', label: 'Name' },
    {
      key: 'client_id',
      label: 'Client',
      render: (g: BillingGuideline) => clientLookup.get(g.client_id) ?? g.client_id.slice(0, 8),
    },
    {
      key: 'rate_cap_cents',
      label: 'Rate Cap',
      render: (g: BillingGuideline) => g.rate_cap_cents ? formatMoney(g.rate_cap_cents) + '/hr' : '-',
    },
    {
      key: 'daily_hour_cap',
      label: 'Daily Hour Cap',
      render: (g: BillingGuideline) => g.daily_hour_cap ? `${g.daily_hour_cap}h` : '-',
    },
    {
      key: 'rules',
      label: 'Rules',
      render: (g: BillingGuideline) => (
        <Group gap={4}>
          {g.block_billing_prohibited && <Badge size="xs" color="red" variant="light">No Block</Badge>}
          {g.task_code_required && <Badge size="xs" color="blue" variant="light">Task Req</Badge>}
          {g.activity_code_required && <Badge size="xs" color="green" variant="light">Activity Req</Badge>}
        </Group>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (g: BillingGuideline) => (
        <Badge color={g.is_active ? 'green' : 'gray'} variant="light" size="sm">
          {g.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (g: BillingGuideline) => (
        <Group gap="xs">
          <ActionIcon variant="subtle" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); openEdit(g); }}>
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              deleteMutation.mutate(g.id);
            }}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Select
          placeholder="Filter by client"
          data={clientOptions}
          searchable
          clearable
          value={clientFilter}
          onChange={(v) => { setClientFilter(v); setPage(1); }}
          w={250}
        />
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          New Guideline
        </Button>
      </Group>

      <DataTable<BillingGuideline>
        columns={columns}
        data={guidelines}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        loading={isLoading}
      />

      <Modal opened={modalOpen} onClose={closeModal} title={editingGuideline ? 'Edit Guideline' : 'New Billing Guideline'} size="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <Select
              label="Client"
              placeholder="Select client"
              data={clientOptions}
              searchable
              required
              disabled={!!editingGuideline}
              {...form.getInputProps('client_id')}
            />
            <TextInput label="Guideline Name" placeholder="e.g. Standard E-Billing Rules" required {...form.getInputProps('name')} />
            <Group grow>
              <NumberInput
                label="Rate Cap (cents/hr)"
                min={0}
                description={form.values.rate_cap_cents ? `= ${formatMoney(form.values.rate_cap_cents)}/hr` : 'No cap'}
                {...form.getInputProps('rate_cap_cents')}
              />
              <NumberInput
                label="Daily Hour Cap"
                min={0}
                step={0.5}
                decimalScale={1}
                description={form.values.daily_hour_cap ? `${form.values.daily_hour_cap}h max/day` : 'No cap'}
                {...form.getInputProps('daily_hour_cap')}
              />
            </Group>
            <Switch label="Block billing prohibited" {...form.getInputProps('block_billing_prohibited', { type: 'checkbox' })} />
            <Switch label="Task/phase code required" {...form.getInputProps('task_code_required', { type: 'checkbox' })} />
            <Switch label="Activity code required" {...form.getInputProps('activity_code_required', { type: 'checkbox' })} />
            <TextInput
              label="Restricted Codes"
              placeholder="e.g. E116, E117, E118"
              description="Comma-separated UTBMS codes that cannot be billed"
              {...form.getInputProps('restricted_codes_text')}
            />
            <Textarea label="Notes" placeholder="Optional notes" {...form.getInputProps('notes')} />
            <Switch label="Active" {...form.getInputProps('is_active', { type: 'checkbox' })} />
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingGuideline ? 'Update Guideline' : 'Create Guideline'}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Compliance Tab
// ---------------------------------------------------------------------------
function ComplianceTab() {
  // Block billing checker
  const [bbDescription, setBbDescription] = useState('');
  const [bbDuration, setBbDuration] = useState<number | string>(0);
  const [bbResult, setBbResult] = useState<BlockBillingResult | null>(null);

  const bbMutation = useMutation({
    mutationFn: (data: { description: string; duration_minutes?: number }) =>
      ledesApi.detectBlockBilling(data),
    onSuccess: (res) => setBbResult(res.data),
    onError: () => notifications.show({ title: 'Error', message: 'Detection failed', color: 'red' }),
  });

  // Compliance checker
  const [compTimeEntryId, setCompTimeEntryId] = useState('');
  const [compClientId, setCompClientId] = useState<string | null>(null);
  const [compResult, setCompResult] = useState<ComplianceResult | null>(null);

  const { data: clientsData } = useQuery({
    queryKey: ['clients', { page: 1, page_size: 200 }],
    queryFn: () => clientsApi.list({ page: 1, page_size: 200 }),
  });

  const clientOptions = useMemo(
    () =>
      (clientsData?.data?.items ?? []).map((c) => ({
        value: c.id,
        label: c.organization_name ?? `${c.first_name} ${c.last_name}`,
      })),
    [clientsData],
  );

  const compMutation = useMutation({
    mutationFn: (data: { time_entry_id: string; client_id: string }) =>
      ledesApi.checkCompliance(data),
    onSuccess: (res) => setCompResult(res.data),
    onError: () => notifications.show({ title: 'Error', message: 'Compliance check failed', color: 'red' }),
  });

  return (
    <Stack gap="xl">
      {/* Block Billing Detector */}
      <Paper shadow="xs" p="lg" withBorder>
        <Stack>
          <Title order={4}>Block Billing Detector</Title>
          <Text size="sm" c="dimmed">
            Paste a time entry description to check if it might be considered block billing.
          </Text>
          <Textarea
            label="Time Entry Description"
            placeholder="e.g. Reviewed documents and drafted motion; attended hearing and met with client regarding strategy"
            value={bbDescription}
            onChange={(e) => setBbDescription(e.currentTarget.value)}
            minRows={3}
          />
          <NumberInput
            label="Duration (minutes, optional)"
            min={0}
            value={bbDuration}
            onChange={setBbDuration}
            w={200}
          />
          <Button
            leftSection={<IconShieldCheck size={16} />}
            onClick={() => bbMutation.mutate({
              description: bbDescription,
              duration_minutes: Number(bbDuration) || undefined,
            })}
            loading={bbMutation.isPending}
            disabled={!bbDescription.trim()}
            w={200}
          >
            Analyze
          </Button>

          {bbResult && (
            <Paper shadow="xs" p="md" withBorder>
              <Stack gap="sm">
                <Group>
                  <Badge
                    color={bbResult.is_block_billing ? 'red' : 'green'}
                    variant="filled"
                    size="lg"
                  >
                    {bbResult.is_block_billing ? 'Block Billing Detected' : 'No Block Billing'}
                  </Badge>
                  <Badge variant="light" color="gray">Confidence: {bbResult.confidence}</Badge>
                </Group>
                {bbResult.reasons.length > 0 && (
                  <Stack gap="xs">
                    <Text size="sm" fw={600}>Reasons:</Text>
                    {bbResult.reasons.map((r, i) => (
                      <Text key={i} size="sm" c="dimmed">- {r}</Text>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Paper>
          )}
        </Stack>
      </Paper>

      {/* Guideline Compliance Checker */}
      <Paper shadow="xs" p="lg" withBorder>
        <Stack>
          <Title order={4}>Guideline Compliance Checker</Title>
          <Text size="sm" c="dimmed">
            Enter a time entry ID and select a client to check against their billing guidelines.
          </Text>
          <Group>
            <TextInput
              label="Time Entry ID"
              placeholder="UUID"
              value={compTimeEntryId}
              onChange={(e) => setCompTimeEntryId(e.currentTarget.value)}
              w={350}
            />
            <Select
              label="Client"
              placeholder="Select client"
              data={clientOptions}
              searchable
              value={compClientId}
              onChange={setCompClientId}
              w={300}
            />
          </Group>
          <Button
            leftSection={<IconShieldCheck size={16} />}
            onClick={() =>
              compMutation.mutate({
                time_entry_id: compTimeEntryId,
                client_id: compClientId || '',
              })
            }
            loading={compMutation.isPending}
            disabled={!compTimeEntryId.trim() || !compClientId}
            w={200}
          >
            Check Compliance
          </Button>

          {compResult && (
            <Paper shadow="xs" p="md" withBorder>
              <Stack gap="sm">
                <Badge
                  color={compResult.compliant ? 'green' : 'red'}
                  variant="filled"
                  size="lg"
                >
                  {compResult.compliant ? 'Compliant' : 'Non-Compliant'}
                </Badge>
                {compResult.violations.length > 0 && (
                  <Table striped withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Rule</Table.Th>
                        <Table.Th>Severity</Table.Th>
                        <Table.Th>Message</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {compResult.violations.map((v, i) => (
                        <Table.Tr key={i}>
                          <Table.Td><Code>{v.rule}</Code></Table.Td>
                          <Table.Td>
                            <Badge color={v.severity === 'error' ? 'red' : 'yellow'} variant="light" size="sm">
                              {v.severity}
                            </Badge>
                          </Table.Td>
                          <Table.Td><Text size="sm">{v.message}</Text></Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Stack>
            </Paper>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// LEDES Export Tab
// ---------------------------------------------------------------------------
function LEDESExportTab() {
  const [invoicePage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [ledesPreview, setLedesPreview] = useState<string | null>(null);

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', { page: invoicePage, page_size: 50 }],
    queryFn: () => billingApi.listInvoices({ page: invoicePage }),
  });

  const invoiceOptions = useMemo(
    () =>
      (invoicesData?.data?.items ?? []).map((inv) => ({
        value: inv.id,
        label: `#${inv.invoice_number} - ${formatMoney(inv.total_cents)} (${inv.status})`,
      })),
    [invoicesData],
  );

  const invoiceLookup = useMemo(() => {
    const map = new Map<string, Invoice>();
    for (const inv of invoicesData?.data?.items ?? []) {
      map.set(inv.id, inv);
    }
    return map;
  }, [invoicesData]);

  const previewMutation = useMutation({
    mutationFn: (invoiceId: string) => ledesApi.exportLedes(invoiceId),
    onSuccess: (res) => {
      const content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      setLedesPreview(content);
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to generate LEDES preview', color: 'red' }),
  });

  const handleSelectInvoice = (invoiceId: string | null) => {
    if (invoiceId) {
      const inv = invoiceLookup.get(invoiceId);
      setSelectedInvoice(inv || null);
      setLedesPreview(null);
    } else {
      setSelectedInvoice(null);
      setLedesPreview(null);
    }
  };

  const handlePreview = () => {
    if (selectedInvoice) {
      previewMutation.mutate(selectedInvoice.id);
    }
  };

  const handleDownload = () => {
    if (selectedInvoice) {
      const url = ledesApi.exportLedesUrl(selectedInvoice.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ledes_${selectedInvoice.invoice_number}.txt`;
      // Add auth token for the download
      const token = useAuthStore.getState().accessToken;
      if (token) {
        // Use fetch with auth header for download
        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
          .then((res) => res.blob())
          .then((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `ledes_${selectedInvoice.invoice_number}.txt`;
            a.click();
            URL.revokeObjectURL(blobUrl);
          })
          .catch(() => notifications.show({ title: 'Error', message: 'Download failed', color: 'red' }));
      }
    }
  };

  return (
    <Stack>
      <Paper shadow="xs" p="lg" withBorder>
        <Stack>
          <Title order={4}>LEDES 1998B Export</Title>
          <Text size="sm" c="dimmed">
            Select an invoice to preview and download in LEDES 1998B format for e-billing submission.
          </Text>

          {isLoading ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : (
            <Select
              label="Select Invoice"
              placeholder="Choose an invoice"
              data={invoiceOptions}
              searchable
              clearable
              value={selectedInvoice?.id || null}
              onChange={handleSelectInvoice}
              w={400}
            />
          )}

          {selectedInvoice && (
            <Paper shadow="xs" p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <div>
                    <Text fw={600}>Invoice #{selectedInvoice.invoice_number}</Text>
                    <Text size="sm" c="dimmed">
                      Total: {formatMoney(selectedInvoice.total_cents)} | Status: {selectedInvoice.status}
                      {selectedInvoice.issued_date && ` | Issued: ${selectedInvoice.issued_date}`}
                    </Text>
                  </div>
                  <Group>
                    <Button
                      variant="outline"
                      leftSection={<IconReceipt2 size={16} />}
                      onClick={handlePreview}
                      loading={previewMutation.isPending}
                    >
                      Preview LEDES
                    </Button>
                    <Button
                      leftSection={<IconDownload size={16} />}
                      onClick={handleDownload}
                    >
                      Download .txt
                    </Button>
                  </Group>
                </Group>
              </Stack>
            </Paper>
          )}

          {ledesPreview && (
            <Paper shadow="xs" p="md" withBorder>
              <Stack gap="sm">
                <Text fw={600} size="sm">LEDES 1998B Preview</Text>
                <Code block style={{ maxHeight: 400, overflow: 'auto', whiteSpace: 'pre', fontSize: 11 }}>
                  {ledesPreview}
                </Code>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main LEDES Page
// ---------------------------------------------------------------------------
export default function LEDESPage() {
  return (
    <Stack>
      <Title order={2}>E-Billing / LEDES</Title>

      <Tabs defaultValue="codes">
        <Tabs.List>
          <Tabs.Tab value="codes" leftSection={<IconReceipt2 size={16} />}>
            UTBMS Codes
          </Tabs.Tab>
          <Tabs.Tab value="guidelines" leftSection={<IconShieldCheck size={16} />}>
            Billing Guidelines
          </Tabs.Tab>
          <Tabs.Tab value="compliance" leftSection={<IconShieldCheck size={16} />}>
            Compliance
          </Tabs.Tab>
          <Tabs.Tab value="export" leftSection={<IconDownload size={16} />}>
            LEDES Export
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="codes" pt="md">
          <UTBMSCodesTab />
        </Tabs.Panel>

        <Tabs.Panel value="guidelines" pt="md">
          <BillingGuidelinesTab />
        </Tabs.Panel>

        <Tabs.Panel value="compliance" pt="md">
          <ComplianceTab />
        </Tabs.Panel>

        <Tabs.Panel value="export" pt="md">
          <LEDESExportTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
