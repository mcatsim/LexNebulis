import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconEdit,
  IconFileDescription,
  IconInfoCircle,
  IconScale,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clientsApi, mattersApi, documentsApi } from '../../api/services';
import { useAuthStore } from '../../stores/authStore';
import type { Client, ClientStatus, ClientType, Matter, Document as DocType } from '../../types';
import DataTable from '../../components/DataTable';

const STATUS_COLORS: Record<ClientStatus, string> = {
  active: 'green',
  inactive: 'yellow',
  archived: 'gray',
};

interface EditFormValues {
  client_type: ClientType;
  first_name: string;
  last_name: string;
  organization_name: string;
  email: string;
  phone: string;
  notes: string;
  status: ClientStatus;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [editing, setEditing] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [mattersPage, setMattersPage] = useState(1);
  const [documentsPage, setDocumentsPage] = useState(1);

  const { data: clientResponse, isLoading: clientLoading } = useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientsApi.get(id!),
    enabled: !!id,
  });

  const client = clientResponse?.data ?? null;

  const { data: mattersResponse, isLoading: mattersLoading } = useQuery({
    queryKey: ['matters', { client_id: id, page: mattersPage }],
    queryFn: () => mattersApi.list({ client_id: id!, page: mattersPage, page_size: 10 }),
    enabled: !!id,
  });

  const matters = mattersResponse?.data?.items ?? [];
  const mattersTotal = mattersResponse?.data?.total ?? 0;

  const { data: documentsResponse, isLoading: documentsLoading } = useQuery({
    queryKey: ['documents', { client_id: id, page: documentsPage }],
    queryFn: async () => {
      const matterIds = mattersResponse?.data?.items?.map((m: Matter) => m.id) ?? [];
      if (matterIds.length === 0) {
        return { data: { items: [], total: 0, page: 1, page_size: 10, total_pages: 0 } };
      }
      return documentsApi.list({ matter_id: matterIds[0], page: documentsPage, page_size: 10 });
    },
    enabled: !!id && !!mattersResponse,
  });

  const documents = documentsResponse?.data?.items ?? [];
  const documentsTotal = documentsResponse?.data?.total ?? 0;

  const editForm = useForm<EditFormValues>({
    initialValues: {
      client_type: 'individual',
      first_name: '',
      last_name: '',
      organization_name: '',
      email: '',
      phone: '',
      notes: '',
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

  const startEditing = () => {
    if (!client) return;
    editForm.setValues({
      client_type: client.client_type,
      first_name: client.first_name ?? '',
      last_name: client.last_name ?? '',
      organization_name: client.organization_name ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      notes: client.notes ?? '',
      status: client.status,
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    editForm.reset();
  };

  const updateMutation = useMutation({
    mutationFn: (values: EditFormValues) => {
      const payload: Partial<Client> = {
        client_type: values.client_type,
        status: values.status,
        email: values.email || null,
        phone: values.phone || null,
        notes: values.notes || null,
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

      return clientsApi.update(id!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      notifications.show({
        title: 'Client updated',
        message: 'Client information has been saved.',
        color: 'green',
      });
      setEditing(false);
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to update client. Please try again.',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => clientsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      notifications.show({
        title: 'Client deleted',
        message: 'The client has been permanently removed.',
        color: 'green',
      });
      navigate('/clients');
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete client. Please try again.',
        color: 'red',
      });
    },
  });

  const handleEditSubmit = editForm.onSubmit((values) => {
    updateMutation.mutate(values);
  });

  const getDisplayName = (): string => {
    if (!client) return '';
    if (client.client_type === 'organization' && client.organization_name) {
      return client.organization_name;
    }
    const parts = [client.first_name, client.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '(unnamed)';
  };

  const matterColumns = [
    {
      key: 'matter_number',
      label: 'Matter #',
      render: (matter: Matter) => String(matter.matter_number),
    },
    {
      key: 'title',
      label: 'Title',
      render: (matter: Matter) => matter.title,
    },
    {
      key: 'litigation_type',
      label: 'Type',
      render: (matter: Matter) => (
        <Badge variant="light" size="sm">
          {matter.litigation_type.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (matter: Matter) => {
        const colors: Record<string, string> = {
          open: 'green',
          pending: 'yellow',
          closed: 'gray',
          archived: 'gray',
        };
        return (
          <Badge color={colors[matter.status] ?? 'gray'} variant="light" size="sm">
            {matter.status}
          </Badge>
        );
      },
    },
    {
      key: 'date_opened',
      label: 'Opened',
      render: (matter: Matter) => new Date(matter.date_opened).toLocaleDateString(),
    },
  ];

  const documentColumns = [
    {
      key: 'filename',
      label: 'Filename',
      render: (doc: DocType) => doc.filename,
    },
    {
      key: 'description',
      label: 'Description',
      render: (doc: DocType) => doc.description ?? '-',
    },
    {
      key: 'version',
      label: 'Version',
      render: (doc: DocType) => String(doc.version),
    },
    {
      key: 'size_bytes',
      label: 'Size',
      render: (doc: DocType) => formatFileSize(doc.size_bytes),
    },
    {
      key: 'created_at',
      label: 'Uploaded',
      render: (doc: DocType) => new Date(doc.created_at).toLocaleDateString(),
    },
  ];

  if (clientLoading) {
    return (
      <Stack align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text c="dimmed">Loading client...</Text>
      </Stack>
    );
  }

  if (!client) {
    return (
      <Stack align="center" justify="center" h={400}>
        <Text c="dimmed" size="lg">Client not found</Text>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/clients')}>
          Back to Clients
        </Button>
      </Stack>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate('/clients')}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={2}>{getDisplayName()}</Title>
          <Badge color={STATUS_COLORS[client.status]} variant="light">
            {client.status}
          </Badge>
        </Group>
        <Group>
          {!editing && (
            <Button variant="light" leftSection={<IconEdit size={16} />} onClick={startEditing}>
              Edit
            </Button>
          )}
          {user?.role === 'admin' && (
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={() => setDeleteModalOpen(true)}
            >
              Delete
            </Button>
          )}
        </Group>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        {editing ? (
          <form onSubmit={handleEditSubmit}>
            <Stack>
              <Select
                label="Client Type"
                data={[
                  { value: 'individual', label: 'Individual' },
                  { value: 'organization', label: 'Organization' },
                ]}
                {...editForm.getInputProps('client_type')}
                onChange={(value) => {
                  editForm.setFieldValue('client_type', (value as ClientType) ?? 'individual');
                  editForm.clearFieldError('first_name');
                  editForm.clearFieldError('last_name');
                  editForm.clearFieldError('organization_name');
                }}
              />

              {editForm.values.client_type === 'individual' ? (
                <Group grow>
                  <TextInput
                    label="First Name"
                    withAsterisk
                    {...editForm.getInputProps('first_name')}
                  />
                  <TextInput
                    label="Last Name"
                    withAsterisk
                    {...editForm.getInputProps('last_name')}
                  />
                </Group>
              ) : (
                <TextInput
                  label="Organization Name"
                  withAsterisk
                  {...editForm.getInputProps('organization_name')}
                />
              )}

              <Group grow>
                <TextInput
                  label="Email"
                  {...editForm.getInputProps('email')}
                />
                <TextInput
                  label="Phone"
                  {...editForm.getInputProps('phone')}
                />
              </Group>

              <Select
                label="Status"
                data={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'archived', label: 'Archived' },
                ]}
                {...editForm.getInputProps('status')}
              />

              <Textarea
                label="Notes"
                autosize
                minRows={3}
                maxRows={6}
                {...editForm.getInputProps('notes')}
              />

              <Group justify="flex-end">
                <Button variant="default" leftSection={<IconX size={16} />} onClick={cancelEditing}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  leftSection={<IconDeviceFloppy size={16} />}
                  loading={updateMutation.isPending}
                >
                  Save Changes
                </Button>
              </Group>
            </Stack>
          </form>
        ) : (
          <Stack gap="sm">
            <Group>
              <Text fw={600} w={140}>Client #:</Text>
              <Text>{client.client_number}</Text>
            </Group>
            <Group>
              <Text fw={600} w={140}>Type:</Text>
              <Badge variant="light" size="sm">
                {client.client_type}
              </Badge>
            </Group>
            {client.client_type === 'individual' ? (
              <>
                <Group>
                  <Text fw={600} w={140}>First Name:</Text>
                  <Text>{client.first_name ?? '-'}</Text>
                </Group>
                <Group>
                  <Text fw={600} w={140}>Last Name:</Text>
                  <Text>{client.last_name ?? '-'}</Text>
                </Group>
              </>
            ) : (
              <Group>
                <Text fw={600} w={140}>Organization:</Text>
                <Text>{client.organization_name ?? '-'}</Text>
              </Group>
            )}
            <Group>
              <Text fw={600} w={140}>Email:</Text>
              <Text>{client.email ?? '-'}</Text>
            </Group>
            <Group>
              <Text fw={600} w={140}>Phone:</Text>
              <Text>{client.phone ?? '-'}</Text>
            </Group>
            <Group>
              <Text fw={600} w={140}>Status:</Text>
              <Badge color={STATUS_COLORS[client.status]} variant="light">
                {client.status}
              </Badge>
            </Group>
            <Group>
              <Text fw={600} w={140}>Notes:</Text>
              <Text>{client.notes ?? '-'}</Text>
            </Group>
            <Group>
              <Text fw={600} w={140}>Created:</Text>
              <Text>{new Date(client.created_at).toLocaleString()}</Text>
            </Group>
            <Group>
              <Text fw={600} w={140}>Updated:</Text>
              <Text>{new Date(client.updated_at).toLocaleString()}</Text>
            </Group>
          </Stack>
        )}
      </Card>

      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="matters" leftSection={<IconScale size={16} />}>
            Matters ({mattersTotal})
          </Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFileDescription size={16} />}>
            Documents ({documentsTotal})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Title order={5} mb="sm">Summary</Title>
              <Group gap="xl">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total Matters</Text>
                  <Text fw={700} size="xl">{mattersTotal}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Client Type</Text>
                  <Text fw={700} size="xl" tt="capitalize">{client.client_type}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Member Since</Text>
                  <Text fw={700} size="xl">{new Date(client.created_at).toLocaleDateString()}</Text>
                </div>
              </Group>
            </Card>

            {client.notes && (
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Title order={5} mb="sm">Notes</Title>
                <Text style={{ whiteSpace: 'pre-wrap' }}>{client.notes}</Text>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="matters" pt="md">
          <DataTable<Matter>
            columns={matterColumns}
            data={matters}
            total={mattersTotal}
            page={mattersPage}
            pageSize={10}
            onPageChange={setMattersPage}
            onRowClick={(matter) => navigate(`/matters/${matter.id}`)}
            loading={mattersLoading}
          />
        </Tabs.Panel>

        <Tabs.Panel value="documents" pt="md">
          <DataTable<DocType>
            columns={documentColumns}
            data={documents}
            total={documentsTotal}
            page={documentsPage}
            pageSize={10}
            onPageChange={setDocumentsPage}
            loading={documentsLoading}
          />
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Client"
        size="sm"
      >
        <Stack>
          <Text>
            Are you sure you want to permanently delete{' '}
            <Text span fw={700}>{getDisplayName()}</Text>? This action cannot be undone.
          </Text>
          <Text size="sm" c="dimmed">
            All associated matters, documents, and billing records may also be affected.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Delete Client
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
