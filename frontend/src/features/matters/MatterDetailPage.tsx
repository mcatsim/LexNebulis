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
  IconArrowLeft,
  IconCalendar,
  IconClock,
  IconFile,
  IconInfoCircle,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  mattersApi,
  clientsApi,
  contactsApi,
  authApi,
  documentsApi,
  billingApi,
  calendarApi,
} from '../../api/services';
import type {
  Matter,
  MatterStatus,
  LitigationType,
  Contact,
  TimeEntry,
  CalendarEvent,
} from '../../types';
import { useAuthStore } from '../../stores/authStore';
import DataTable from '../../components/DataTable';

const STATUS_OPTIONS: { value: MatterStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

const LITIGATION_TYPE_OPTIONS: { value: LitigationType; label: string }[] = [
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

// --- Overview Tab ---

function OverviewTab({ matter }: { matter: Matter }) {
  const queryClient = useQueryClient();

  const { data: clientsData } = useQuery({
    queryKey: ['clients', { page: 1, page_size: 200 }],
    queryFn: () => clientsApi.list({ page: 1, page_size: 200 }),
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
  });

  const attorneySelectData = (usersData?.data?.items ?? [])
    .filter((u) => u.role === 'attorney' || u.role === 'admin')
    .map((u) => ({
      value: u.id,
      label: `${u.first_name} ${u.last_name}`,
    }));

  const form = useForm({
    initialValues: {
      title: matter.title,
      client_id: matter.client_id,
      status: matter.status as MatterStatus,
      litigation_type: matter.litigation_type as LitigationType,
      jurisdiction: matter.jurisdiction ?? '',
      court_name: matter.court_name ?? '',
      case_number: matter.case_number ?? '',
      assigned_attorney_id: matter.assigned_attorney_id ?? '',
      description: matter.description ?? '',
      notes: matter.notes ?? '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      mattersApi.update(matter.id, {
        title: values.title,
        client_id: values.client_id,
        status: values.status,
        litigation_type: values.litigation_type,
        jurisdiction: values.jurisdiction || null,
        court_name: values.court_name || null,
        case_number: values.case_number || null,
        assigned_attorney_id: values.assigned_attorney_id || null,
        description: values.description || null,
        notes: values.notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matter', matter.id] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      notifications.show({ title: 'Success', message: 'Matter updated successfully', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to update matter', color: 'red' });
    },
  });

  return (
    <form onSubmit={form.onSubmit((values) => updateMutation.mutate(values))}>
      <LoadingOverlay visible={updateMutation.isPending} />
      <Stack>
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <TextInput label="Title" required {...form.getInputProps('title')} />
          <Select
            label="Client"
            data={clientSelectData}
            searchable
            required
            {...form.getInputProps('client_id')}
          />
          <Select
            label="Status"
            data={STATUS_OPTIONS}
            required
            {...form.getInputProps('status')}
          />
          <Select
            label="Litigation Type"
            data={LITIGATION_TYPE_OPTIONS}
            required
            {...form.getInputProps('litigation_type')}
          />
          <TextInput label="Jurisdiction" {...form.getInputProps('jurisdiction')} />
          <TextInput label="Court Name" {...form.getInputProps('court_name')} />
          <TextInput label="Case Number" {...form.getInputProps('case_number')} />
          <Select
            label="Assigned Attorney"
            data={attorneySelectData}
            searchable
            clearable
            {...form.getInputProps('assigned_attorney_id')}
          />
        </SimpleGrid>
        <Textarea label="Description" minRows={3} {...form.getInputProps('description')} />
        <Textarea label="Notes" minRows={2} {...form.getInputProps('notes')} />
        <Group justify="flex-end">
          <Button type="submit" loading={updateMutation.isPending}>
            Save Changes
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

// --- Contacts Tab ---

interface MatterContact {
  id: string;
  contact_id: string;
  relationship_type: string;
  contact?: Contact;
  first_name?: string;
  last_name?: string;
  role?: string;
  organization?: string;
}

function ContactsTab({ matterId }: { matterId: string }) {
  const queryClient = useQueryClient();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);
  const [relationshipType, setRelationshipType] = useState<string | null>(null);

  const { data: matterContactsRaw } = useQuery({
    queryKey: ['matter-contacts', matterId],
    queryFn: () => mattersApi.get(matterId),
  });

  // The matter contacts are typically returned as part of the matter or via a sub-resource.
  // We'll list contacts linked to this matter via the contacts list endpoint.
  const { data: allContactsData } = useQuery({
    queryKey: ['contacts', { page: 1, page_size: 500 }],
    queryFn: () => contactsApi.list({ page: 1, page_size: 500 }),
  });

  const contactSelectData = (allContactsData?.data?.items ?? []).map((c: Contact) => ({
    value: c.id,
    label: `${c.first_name} ${c.last_name}`,
  }));

  const addContactMutation = useMutation({
    mutationFn: () => mattersApi.addContact(matterId, contactId!, relationshipType ?? 'related'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matter-contacts', matterId] });
      queryClient.invalidateQueries({ queryKey: ['matter', matterId] });
      notifications.show({ title: 'Success', message: 'Contact added to matter', color: 'green' });
      setAddModalOpen(false);
      setContactId(null);
      setRelationshipType(null);
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to add contact', color: 'red' });
    },
  });

  const removeContactMutation = useMutation({
    mutationFn: (matterContactId: string) => mattersApi.removeContact(matterId, matterContactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matter-contacts', matterId] });
      queryClient.invalidateQueries({ queryKey: ['matter', matterId] });
      notifications.show({ title: 'Success', message: 'Contact removed from matter', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to remove contact', color: 'red' });
    },
  });

  // The matter detail response may include contacts array
  const matterData = matterContactsRaw?.data as Matter & { contacts?: MatterContact[] };
  const matterContacts: MatterContact[] = matterData?.contacts ?? [];

  return (
    <Stack>
      <Group justify="flex-end">
        <Button leftSection={<IconUsers size={16} />} onClick={() => setAddModalOpen(true)}>
          Add Contact
        </Button>
      </Group>

      {matterContacts.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No contacts linked to this matter
        </Text>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Relationship</Table.Th>
              <Table.Th>Organization</Table.Th>
              <Table.Th w={60}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {matterContacts.map((mc) => (
              <Table.Tr key={mc.id}>
                <Table.Td>
                  {mc.first_name ?? mc.contact?.first_name ?? ''}{' '}
                  {mc.last_name ?? mc.contact?.last_name ?? ''}
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm">
                    {mc.role ?? mc.contact?.role ?? '-'}
                  </Badge>
                </Table.Td>
                <Table.Td>{mc.relationship_type}</Table.Td>
                <Table.Td>{mc.organization ?? mc.contact?.organization ?? '-'}</Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => removeContactMutation.mutate(mc.id)}
                    loading={removeContactMutation.isPending}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setContactId(null);
          setRelationshipType(null);
        }}
        title="Add Contact to Matter"
      >
        <Stack>
          <Select
            label="Contact"
            placeholder="Search for a contact"
            data={contactSelectData}
            searchable
            required
            value={contactId}
            onChange={setContactId}
          />
          <Select
            label="Relationship Type"
            placeholder="Select relationship"
            data={[
              { value: 'plaintiff', label: 'Plaintiff' },
              { value: 'defendant', label: 'Defendant' },
              { value: 'witness', label: 'Witness' },
              { value: 'expert', label: 'Expert' },
              { value: 'judge', label: 'Judge' },
              { value: 'opposing_counsel', label: 'Opposing Counsel' },
              { value: 'related', label: 'Related' },
            ]}
            value={relationshipType}
            onChange={setRelationshipType}
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setAddModalOpen(false);
                setContactId(null);
                setRelationshipType(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => addContactMutation.mutate()}
              loading={addContactMutation.isPending}
              disabled={!contactId}
            >
              Add Contact
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// --- Documents Tab ---

function DocumentsTab({ matterId }: { matterId: string }) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', { matter_id: matterId, page, page_size: pageSize }],
    queryFn: () => documentsApi.list({ matter_id: matterId, page, page_size: pageSize }),
  });

  const documents = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const columns = [
    { key: 'filename', label: 'Filename' },
    {
      key: 'mime_type',
      label: 'Type',
      render: (item: { mime_type: string }) => item.mime_type.split('/').pop()?.toUpperCase() ?? item.mime_type,
    },
    {
      key: 'size_bytes',
      label: 'Size',
      render: (item: { size_bytes: number }) => {
        const kb = item.size_bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        return `${(kb / 1024).toFixed(1)} MB`;
      },
    },
    {
      key: 'version',
      label: 'Version',
      render: (item: { version: number }) => `v${item.version}`,
    },
    {
      key: 'created_at',
      label: 'Uploaded',
      render: (item: { created_at: string }) => new Date(item.created_at).toLocaleDateString(),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={documents}
      total={total}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      loading={isLoading}
    />
  );
}

// --- Time Entries Tab ---

function TimeEntriesTab({ matterId }: { matterId: string }) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ['time-entries', { matter_id: matterId, page }],
    queryFn: () => billingApi.listTimeEntries({ matter_id: matterId, page }),
  });

  const entries = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const columns = [
    {
      key: 'date',
      label: 'Date',
      render: (item: TimeEntry) => new Date(item.date).toLocaleDateString(),
    },
    { key: 'description', label: 'Description' },
    {
      key: 'duration_minutes',
      label: 'Duration',
      render: (item: TimeEntry) => {
        const hours = Math.floor(item.duration_minutes / 60);
        const minutes = item.duration_minutes % 60;
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      },
    },
    {
      key: 'billable',
      label: 'Billable',
      render: (item: TimeEntry) => (
        <Badge color={item.billable ? 'green' : 'gray'} variant="light" size="sm">
          {item.billable ? 'Yes' : 'No'}
        </Badge>
      ),
    },
    {
      key: 'rate_cents',
      label: 'Rate',
      render: (item: TimeEntry) => `$${(item.rate_cents / 100).toFixed(2)}/hr`,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={entries}
      total={total}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      loading={isLoading}
    />
  );
}

// --- Calendar Events Tab ---

function CalendarEventsTab({ matterId }: { matterId: string }) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', { matter_id: matterId, page, page_size: pageSize }],
    queryFn: () => calendarApi.list({ matter_id: matterId, page, page_size: pageSize }),
  });

  const events = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const eventTypeColorMap: Record<string, string> = {
    court_date: 'red',
    deadline: 'orange',
    filing: 'blue',
    meeting: 'green',
    reminder: 'grape',
  };

  const columns = [
    { key: 'title', label: 'Title' },
    {
      key: 'event_type',
      label: 'Type',
      render: (item: CalendarEvent) => (
        <Badge color={eventTypeColorMap[item.event_type] ?? 'gray'} variant="light" size="sm">
          {item.event_type.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'start_datetime',
      label: 'Start',
      render: (item: CalendarEvent) => new Date(item.start_datetime).toLocaleString(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: CalendarEvent) => (
        <Badge
          color={
            item.status === 'scheduled' ? 'blue' : item.status === 'completed' ? 'green' : 'gray'
          }
          variant="light"
          size="sm"
        >
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      render: (item: CalendarEvent) => item.location ?? '-',
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={events}
      total={total}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      loading={isLoading}
    />
  );
}

// --- Main Detail Page ---

export default function MatterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['matter', id],
    queryFn: () => mattersApi.get(id!),
    enabled: !!id,
  });

  const matter = data?.data as Matter | undefined;

  const deleteMutation = useMutation({
    mutationFn: () => mattersApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      notifications.show({ title: 'Success', message: 'Matter deleted', color: 'green' });
      navigate('/matters');
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to delete matter', color: 'red' });
    },
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  if (!matter) {
    return (
      <Stack align="center" py="xl">
        <Text c="dimmed">Matter not found</Text>
        <Button variant="light" onClick={() => navigate('/matters')}>
          Back to Matters
        </Button>
      </Stack>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate('/matters')}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={2}>
            M-{String(matter.matter_number).padStart(5, '0')}: {matter.title}
          </Title>
          <Badge color={STATUS_COLOR_MAP[matter.status]} variant="light" size="lg">
            {matter.status.charAt(0).toUpperCase() + matter.status.slice(1)}
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
              Litigation Type
            </Text>
            <Text fw={500}>{formatLitigationType(matter.litigation_type)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Jurisdiction
            </Text>
            <Text fw={500}>{matter.jurisdiction ?? '-'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Court
            </Text>
            <Text fw={500}>{matter.court_name ?? '-'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Date Opened
            </Text>
            <Text fw={500}>{new Date(matter.date_opened).toLocaleDateString()}</Text>
          </div>
        </SimpleGrid>
      </Card>

      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="contacts" leftSection={<IconUsers size={16} />}>
            Contacts
          </Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFile size={16} />}>
            Documents
          </Tabs.Tab>
          <Tabs.Tab value="time-entries" leftSection={<IconClock size={16} />}>
            Time Entries
          </Tabs.Tab>
          <Tabs.Tab value="calendar" leftSection={<IconCalendar size={16} />}>
            Calendar Events
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <OverviewTab matter={matter} />
        </Tabs.Panel>

        <Tabs.Panel value="contacts" pt="md">
          <ContactsTab matterId={matter.id} />
        </Tabs.Panel>

        <Tabs.Panel value="documents" pt="md">
          <DocumentsTab matterId={matter.id} />
        </Tabs.Panel>

        <Tabs.Panel value="time-entries" pt="md">
          <TimeEntriesTab matterId={matter.id} />
        </Tabs.Panel>

        <Tabs.Panel value="calendar" pt="md">
          <CalendarEventsTab matterId={matter.id} />
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirm Deletion"
        size="sm"
      >
        <Stack>
          <Text>
            Are you sure you want to delete matter{' '}
            <Text span fw={700}>
              M-{String(matter.matter_number).padStart(5, '0')}: {matter.title}
            </Text>
            ? This action cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={() => deleteMutation.mutate()} loading={deleteMutation.isPending}>
              Delete Matter
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
