import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Group,
  Modal,
  Select,
  Stack,
  TextInput,
  Textarea,
  Title,
  Badge,
  LoadingOverlay,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mattersApi, clientsApi, authApi } from '../../api/services';
import type { Matter, MatterStatus, LitigationType } from '../../types';
import DataTable from '../../components/DataTable';

const STATUS_OPTIONS: { value: MatterStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

const LITIGATION_TYPE_OPTIONS: { value: LitigationType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'civil', label: 'Civil' },
  { value: 'criminal', label: 'Criminal' },
  { value: 'family', label: 'Family' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'immigration', label: 'Immigration' },
  { value: 'bankruptcy', label: 'Bankruptcy' },
  { value: 'tax', label: 'Tax' },
  { value: 'labor', label: 'Labor' },
  { value: 'intellectual_property', label: 'Intellectual Property' },
  { value: 'estate_planning', label: 'Estate Planning' },
  { value: 'personal_injury', label: 'Personal Injury' },
  { value: 'other', label: 'Other' },
];

const LITIGATION_TYPE_SELECT_DATA = LITIGATION_TYPE_OPTIONS.filter((o) => o.value !== '').map(
  (o) => ({ value: o.value, label: o.label }),
);

const STATUS_COLOR_MAP: Record<MatterStatus, string> = {
  open: 'green',
  pending: 'yellow',
  closed: 'gray',
  archived: 'red',
};

function formatLitigationType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function MatterListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [litigationTypeFilter, setLitigationTypeFilter] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['matters', { page, page_size: pageSize, search: debouncedSearch, status: statusFilter, litigation_type: litigationTypeFilter }],
    queryFn: () =>
      mattersApi.list({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      }),
  });

  const matters = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  // Filter by litigation_type client-side since API may not support it directly
  const filteredMatters = litigationTypeFilter
    ? matters.filter((m: Matter) => m.litigation_type === litigationTypeFilter)
    : matters;
  const filteredTotal = litigationTypeFilter
    ? filteredMatters.length
    : total;

  const { data: clientsData } = useQuery({
    queryKey: ['clients', { page: 1, page_size: 200 }],
    queryFn: () => clientsApi.list({ page: 1, page_size: 200 }),
    enabled: createModalOpen,
  });

  const clientSelectData = (clientsData?.data?.items ?? []).map((c) => ({
    value: c.id,
    label: c.organization_name
      ? c.organization_name
      : `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(),
  }));

  const { data: usersData } = useQuery({
    queryKey: ['users', { page: 1, page_size: 200 }],
    queryFn: () => authApi.listUsers(1, 200),
    enabled: createModalOpen,
  });

  const attorneySelectData = (usersData?.data?.items ?? [])
    .filter((u) => u.role === 'attorney' || u.role === 'admin')
    .map((u) => ({
      value: u.id,
      label: `${u.first_name} ${u.last_name}`,
    }));

  const form = useForm({
    initialValues: {
      title: '',
      client_id: '',
      litigation_type: '' as LitigationType | '',
      jurisdiction: '',
      court_name: '',
      case_number: '',
      assigned_attorney_id: '',
      description: '',
    },
    validate: {
      title: (v) => (v.trim().length === 0 ? 'Title is required' : null),
      client_id: (v) => (v.length === 0 ? 'Client is required' : null),
      litigation_type: (v) => (v.length === 0 ? 'Litigation type is required' : null),
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      mattersApi.create({
        title: values.title,
        client_id: values.client_id,
        litigation_type: values.litigation_type as LitigationType,
        jurisdiction: values.jurisdiction || null,
        court_name: values.court_name || null,
        case_number: values.case_number || null,
        assigned_attorney_id: values.assigned_attorney_id || null,
        description: values.description || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      notifications.show({ title: 'Success', message: 'Matter created successfully', color: 'green' });
      setCreateModalOpen(false);
      form.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create matter', color: 'red' });
    },
  });

  const columns = [
    {
      key: 'matter_number',
      label: 'Matter #',
      render: (item: Matter) => `M-${String(item.matter_number).padStart(5, '0')}`,
    },
    {
      key: 'title',
      label: 'Title',
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: Matter) => (
        <Badge color={STATUS_COLOR_MAP[item.status]} variant="light" size="sm">
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'litigation_type',
      label: 'Type',
      render: (item: Matter) => formatLitigationType(item.litigation_type),
    },
    {
      key: 'date_opened',
      label: 'Date Opened',
      render: (item: Matter) => new Date(item.date_opened).toLocaleDateString(),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Matters</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
          New Matter
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search matters..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Select
          placeholder="Status"
          data={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v ?? '');
            setPage(1);
          }}
          clearable
          w={160}
        />
        <Select
          placeholder="Litigation Type"
          data={LITIGATION_TYPE_OPTIONS.filter((o) => o.value !== '')}
          value={litigationTypeFilter}
          onChange={(v) => {
            setLitigationTypeFilter(v ?? '');
            setPage(1);
          }}
          clearable
          w={200}
        />
      </Group>

      <DataTable<Matter>
        columns={columns}
        data={filteredMatters}
        total={filteredTotal}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        onRowClick={(matter) => navigate(`/matters/${matter.id}`)}
        loading={isLoading}
      />

      <Modal
        opened={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          form.reset();
        }}
        title="New Matter"
        size="lg"
      >
        <form onSubmit={form.onSubmit((values) => createMutation.mutate(values))}>
          <LoadingOverlay visible={createMutation.isPending} />
          <Stack>
            <TextInput
              label="Title"
              placeholder="Enter matter title"
              required
              {...form.getInputProps('title')}
            />
            <Select
              label="Client"
              placeholder="Select a client"
              data={clientSelectData}
              searchable
              required
              {...form.getInputProps('client_id')}
            />
            <Select
              label="Litigation Type"
              placeholder="Select type"
              data={LITIGATION_TYPE_SELECT_DATA}
              required
              {...form.getInputProps('litigation_type')}
            />
            <TextInput
              label="Jurisdiction"
              placeholder="e.g. State of California"
              {...form.getInputProps('jurisdiction')}
            />
            <TextInput
              label="Court Name"
              placeholder="e.g. Superior Court of Los Angeles"
              {...form.getInputProps('court_name')}
            />
            <TextInput
              label="Case Number"
              placeholder="e.g. 2024-CV-12345"
              {...form.getInputProps('case_number')}
            />
            <Select
              label="Assigned Attorney"
              placeholder="Select an attorney"
              data={attorneySelectData}
              searchable
              clearable
              {...form.getInputProps('assigned_attorney_id')}
            />
            <Textarea
              label="Description"
              placeholder="Brief description of the matter"
              minRows={3}
              {...form.getInputProps('description')}
            />
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  setCreateModalOpen(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Create Matter
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
