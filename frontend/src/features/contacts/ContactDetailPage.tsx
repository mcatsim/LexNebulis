import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  LoadingOverlay,
  Modal,
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
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsApi, mattersApi } from '../../api/services';
import type { Contact, ContactRole, Matter } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import DataTable from '../../components/DataTable';

const ROLE_OPTIONS: { value: ContactRole; label: string }[] = [
  { value: 'judge', label: 'Judge' },
  { value: 'witness', label: 'Witness' },
  { value: 'opposing_counsel', label: 'Opposing Counsel' },
  { value: 'expert', label: 'Expert' },
  { value: 'other', label: 'Other' },
];

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

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mattersPage, setMattersPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => contactsApi.get(id!),
    enabled: !!id,
  });

  const contact = data?.data as Contact | undefined;

  // Fetch matters that may be linked to this contact.
  // We query all matters and will filter/display those associated.
  // The API may return matters associated with this contact via a query parameter.
  const { data: mattersData, isLoading: mattersLoading } = useQuery({
    queryKey: ['matters', { page: mattersPage, page_size: 25 }],
    queryFn: () => mattersApi.list({ page: mattersPage, page_size: 25 }),
    enabled: !!contact,
  });

  const relatedMatters = mattersData?.data?.items ?? [];
  const mattersTotal = mattersData?.data?.total ?? 0;

  const form = useForm({
    initialValues: {
      first_name: '',
      last_name: '',
      role: '' as ContactRole,
      organization: '',
      email: '',
      phone: '',
      notes: '',
    },
  });

  // Sync form when contact loads
  const [formInitialized, setFormInitialized] = useState(false);
  if (contact && !formInitialized) {
    form.setValues({
      first_name: contact.first_name,
      last_name: contact.last_name,
      role: contact.role,
      organization: contact.organization ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      notes: contact.notes ?? '',
    });
    setFormInitialized(true);
  }

  const updateMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      contactsApi.update(id!, {
        first_name: values.first_name,
        last_name: values.last_name,
        role: values.role,
        organization: values.organization || null,
        email: values.email || null,
        phone: values.phone || null,
        notes: values.notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      notifications.show({ title: 'Success', message: 'Contact updated successfully', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to update contact', color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => contactsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      notifications.show({ title: 'Success', message: 'Contact deleted', color: 'green' });
      navigate('/contacts');
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to delete contact', color: 'red' });
    },
  });

  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  if (!contact) {
    return (
      <Stack align="center" py="xl">
        <Text c="dimmed">Contact not found</Text>
        <Button variant="light" onClick={() => navigate('/contacts')}>
          Back to Contacts
        </Button>
      </Stack>
    );
  }

  const statusColorMap: Record<string, string> = {
    open: 'green',
    pending: 'yellow',
    closed: 'gray',
    archived: 'red',
  };

  const matterColumns = [
    {
      key: 'matter_number',
      label: 'Matter #',
      render: (item: Matter) => `M-${String(item.matter_number).padStart(5, '0')}`,
    },
    { key: 'title', label: 'Title' },
    {
      key: 'status',
      label: 'Status',
      render: (item: Matter) => (
        <Badge color={statusColorMap[item.status] ?? 'gray'} variant="light" size="sm">
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </Badge>
      ),
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
        <Group>
          <ActionIcon variant="subtle" aria-label="Go back" onClick={() => navigate('/contacts')}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={1}>
            {contact.first_name} {contact.last_name}
          </Title>
          <Badge color={ROLE_COLOR_MAP[contact.role]} variant="light" size="lg">
            {formatRole(contact.role)}
          </Badge>
        </Group>
        {user?.role === 'admin' && (
          <Button
            color="red"
            variant="outline"
            leftSection={<IconTrash size={16} />}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            Delete
          </Button>
        )}
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Organization
            </Text>
            <Text fw={500}>{contact.organization ?? '-'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Email
            </Text>
            <Text fw={500}>{contact.email ?? '-'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Phone
            </Text>
            <Text fw={500}>{contact.phone ?? '-'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Created
            </Text>
            <Text fw={500}>{new Date(contact.created_at).toLocaleDateString()}</Text>
          </div>
        </SimpleGrid>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={2} mb="md">
          Edit Contact
        </Title>
        <form onSubmit={form.onSubmit((values) => updateMutation.mutate(values))}>
          <LoadingOverlay visible={updateMutation.isPending} />
          <Stack>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label="First Name"
                required
                {...form.getInputProps('first_name')}
              />
              <TextInput
                label="Last Name"
                required
                {...form.getInputProps('last_name')}
              />
              <Select
                label="Role"
                data={ROLE_OPTIONS}
                required
                {...form.getInputProps('role')}
              />
              <TextInput
                label="Organization"
                {...form.getInputProps('organization')}
              />
              <TextInput
                label="Email"
                {...form.getInputProps('email')}
              />
              <TextInput
                label="Phone"
                {...form.getInputProps('phone')}
              />
            </SimpleGrid>
            <Textarea
              label="Notes"
              minRows={3}
              {...form.getInputProps('notes')}
            />
            <Group justify="flex-end">
              <Button type="submit" loading={updateMutation.isPending}>
                Save Changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={2} mb="md">
          Related Matters
        </Title>
        <DataTable<Matter>
          columns={matterColumns}
          data={relatedMatters}
          total={mattersTotal}
          page={mattersPage}
          pageSize={25}
          onPageChange={setMattersPage}
          onRowClick={(matter) => navigate(`/matters/${matter.id}`)}
          loading={mattersLoading}
        />
      </Card>

      <Modal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirm Deletion"
        size="sm"
      >
        <Stack>
          <Text>
            Are you sure you want to delete contact{' '}
            <Text span fw={700}>
              {contact.first_name} {contact.last_name}
            </Text>
            ? This action cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              Delete Contact
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
