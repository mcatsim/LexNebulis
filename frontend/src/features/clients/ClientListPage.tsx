import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from '../../api/services';
import type { Client, ClientStatus, ClientType } from '../../types';
import DataTable from '../../components/DataTable';

const STATUS_COLORS: Record<ClientStatus, string> = {
  active: 'green',
  inactive: 'yellow',
  archived: 'gray',
};

interface CreateClientFormValues {
  client_type: ClientType;
  first_name: string;
  last_name: string;
  organization_name: string;
  email: string;
  phone: string;
  status: ClientStatus;
}

function getDisplayName(client: Client): string {
  if (client.client_type === 'organization' && client.organization_name) {
    return client.organization_name;
  }
  const parts = [client.first_name, client.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '(unnamed)';
}

export default function ClientListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { page, page_size: pageSize, search: debouncedSearch, status: statusFilter }],
    queryFn: () =>
      clientsApi.list({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      }),
  });

  const clients = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const form = useForm<CreateClientFormValues>({
    initialValues: {
      client_type: 'individual',
      first_name: '',
      last_name: '',
      organization_name: '',
      email: '',
      phone: '',
      status: 'active',
    },
    validate: {
      first_name: (value, values) =>
        values.client_type === 'individual' && !value.trim()
          ? 'First name is required for individuals'
          : null,
      last_name: (value, values) =>
        values.client_type === 'individual' && !value.trim()
          ? 'Last name is required for individuals'
          : null,
      organization_name: (value, values) =>
        values.client_type === 'organization' && !value.trim()
          ? 'Organization name is required'
          : null,
      email: (value) =>
        value && !/^\S+@\S+\.\S+$/.test(value) ? 'Invalid email address' : null,
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateClientFormValues) => {
      const payload: Partial<Client> = {
        client_type: values.client_type,
        status: values.status,
        email: values.email || null,
        phone: values.phone || null,
      };

      if (values.client_type === 'individual') {
        payload.first_name = values.first_name;
        payload.last_name = values.last_name;
        payload.organization_name = null;
      } else {
        payload.organization_name = values.organization_name;
        payload.first_name = null;
        payload.last_name = null;
      }

      return clientsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      notifications.show({
        title: 'Client created',
        message: 'The new client has been created successfully.',
        color: 'green',
      });
      setCreateModalOpen(false);
      form.reset();
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to create client. Please try again.',
        color: 'red',
      });
    },
  });

  const handleCreateSubmit = form.onSubmit((values) => {
    createMutation.mutate(values);
  });

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string | null) => {
    setStatusFilter(value);
    setPage(1);
  };

  const columns = [
    {
      key: 'client_number',
      label: 'Client #',
      render: (client: Client) => String(client.client_number),
    },
    {
      key: 'display_name',
      label: 'Name',
      render: (client: Client) => getDisplayName(client),
    },
    {
      key: 'email',
      label: 'Email',
      render: (client: Client) => client.email ?? '-',
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (client: Client) => client.phone ?? '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (client: Client) => (
        <Badge color={STATUS_COLORS[client.status]} variant="light" size="sm">
          {client.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (client: Client) => new Date(client.created_at).toLocaleDateString(),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={1}>Clients</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
          New Client
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search clients..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => handleSearchChange(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="All statuses"
          clearable
          data={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'archived', label: 'Archived' },
          ]}
          value={statusFilter}
          onChange={handleStatusFilterChange}
          w={160}
        />
      </Group>

      <DataTable<Client>
        columns={columns}
        data={clients}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onRowClick={(client) => navigate(`/clients/${client.id}`)}
        loading={isLoading}
      />

      <Modal
        opened={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          form.reset();
        }}
        title="New Client"
        size="md"
      >
        <form onSubmit={handleCreateSubmit}>
          <Stack>
            <Select
              label="Client Type"
              data={[
                { value: 'individual', label: 'Individual' },
                { value: 'organization', label: 'Organization' },
              ]}
              {...form.getInputProps('client_type')}
              onChange={(value) => {
                form.setFieldValue('client_type', (value as ClientType) ?? 'individual');
                form.clearFieldError('first_name');
                form.clearFieldError('last_name');
                form.clearFieldError('organization_name');
              }}
            />

            {form.values.client_type === 'individual' ? (
              <Group grow>
                <TextInput
                  label="First Name"
                  placeholder="John"
                  withAsterisk
                  {...form.getInputProps('first_name')}
                />
                <TextInput
                  label="Last Name"
                  placeholder="Doe"
                  withAsterisk
                  {...form.getInputProps('last_name')}
                />
              </Group>
            ) : (
              <TextInput
                label="Organization Name"
                placeholder="Acme Corp"
                withAsterisk
                {...form.getInputProps('organization_name')}
              />
            )}

            <TextInput
              label="Email"
              placeholder="email@example.com"
              {...form.getInputProps('email')}
            />

            <TextInput
              label="Phone"
              placeholder="(555) 555-5555"
              {...form.getInputProps('phone')}
            />

            <Select
              label="Status"
              data={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'archived', label: 'Archived' },
              ]}
              {...form.getInputProps('status')}
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
                Create Client
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
