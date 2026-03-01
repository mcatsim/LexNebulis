import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Group,
  LoadingOverlay,
  Modal,
  Select,
  Stack,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '../../api/services';
import type { Contact, ContactRole } from '../../types';
import DataTable from '../../components/DataTable';

const ROLE_OPTIONS: { value: ContactRole | ''; label: string }[] = [
  { value: '', label: 'All Roles' },
  { value: 'judge', label: 'Judge' },
  { value: 'witness', label: 'Witness' },
  { value: 'opposing_counsel', label: 'Opposing Counsel' },
  { value: 'expert', label: 'Expert' },
  { value: 'other', label: 'Other' },
];

const ROLE_SELECT_DATA = ROLE_OPTIONS.filter((o) => o.value !== '').map((o) => ({
  value: o.value,
  label: o.label,
}));

const ROLE_COLOR_MAP: Record<ContactRole, string> = {
  judge: 'red',
  witness: 'blue',
  opposing_counsel: 'orange',
  expert: 'grape',
  other: 'gray',
};

function formatRole(role: string): string {
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function ContactListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [roleFilter, setRoleFilter] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', { page, page_size: pageSize, search: debouncedSearch, role: roleFilter }],
    queryFn: () =>
      contactsApi.list({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
      }),
  });

  const contacts = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const form = useForm({
    initialValues: {
      first_name: '',
      last_name: '',
      role: '' as ContactRole | '',
      organization: '',
      email: '',
      phone: '',
      notes: '',
    },
    validate: {
      first_name: (v) => (v.trim().length === 0 ? 'First name is required' : null),
      last_name: (v) => (v.trim().length === 0 ? 'Last name is required' : null),
      role: (v) => (v.length === 0 ? 'Role is required' : null),
      email: (v) => {
        if (!v) return null;
        return /^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email address';
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      contactsApi.create({
        first_name: values.first_name,
        last_name: values.last_name,
        role: values.role as ContactRole,
        organization: values.organization || null,
        email: values.email || null,
        phone: values.phone || null,
        notes: values.notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      notifications.show({ title: 'Success', message: 'Contact created successfully', color: 'green' });
      setCreateModalOpen(false);
      form.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create contact', color: 'red' });
    },
  });

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (item: Contact) => `${item.first_name} ${item.last_name}`,
    },
    {
      key: 'role',
      label: 'Role',
      render: (item: Contact) => (
        <Badge color={ROLE_COLOR_MAP[item.role]} variant="light" size="sm">
          {formatRole(item.role)}
        </Badge>
      ),
    },
    {
      key: 'organization',
      label: 'Organization',
      render: (item: Contact) => item.organization ?? '-',
    },
    {
      key: 'email',
      label: 'Email',
      render: (item: Contact) => item.email ?? '-',
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (item: Contact) => item.phone ?? '-',
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={1}>Contacts</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
          New Contact
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search contacts..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Select
          placeholder="Role"
          data={ROLE_OPTIONS.filter((o) => o.value !== '')}
          value={roleFilter}
          onChange={(v) => {
            setRoleFilter(v ?? '');
            setPage(1);
          }}
          clearable
          w={200}
        />
      </Group>

      <DataTable<Contact>
        columns={columns}
        data={contacts}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        onRowClick={(contact) => navigate(`/contacts/${contact.id}`)}
        loading={isLoading}
      />

      <Modal
        opened={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          form.reset();
        }}
        title="New Contact"
        size="lg"
      >
        <form onSubmit={form.onSubmit((values) => createMutation.mutate(values))}>
          <LoadingOverlay visible={createMutation.isPending} />
          <Stack>
            <Group grow>
              <TextInput
                label="First Name"
                placeholder="Enter first name"
                required
                {...form.getInputProps('first_name')}
              />
              <TextInput
                label="Last Name"
                placeholder="Enter last name"
                required
                {...form.getInputProps('last_name')}
              />
            </Group>
            <Select
              label="Role"
              placeholder="Select role"
              data={ROLE_SELECT_DATA}
              required
              {...form.getInputProps('role')}
            />
            <TextInput
              label="Organization"
              placeholder="Company or firm name"
              {...form.getInputProps('organization')}
            />
            <Group grow>
              <TextInput
                label="Email"
                placeholder="email@example.com"
                {...form.getInputProps('email')}
              />
              <TextInput
                label="Phone"
                placeholder="(555) 123-4567"
                {...form.getInputProps('phone')}
              />
            </Group>
            <Textarea
              label="Notes"
              placeholder="Additional notes"
              minRows={3}
              {...form.getInputProps('notes')}
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
                Create Contact
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
