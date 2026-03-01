import { useState } from 'react';
import {
  Badge, Button, Card, Group, Modal, Pagination, PasswordInput, Select,
  Skeleton, Stack, Switch, Table, Tabs, Text, Textarea, TextInput, Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconMessage, IconFileDescription, IconUsers,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { portalStaffApi, clientsApi, mattersApi, documentsApi } from '../../api/services';

export default function PortalManagementPage() {
  return (
    <Stack gap="lg">
      <Title order={1}>Client Portal Management</Title>
      <Tabs defaultValue="users">
        <Tabs.List>
          <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>Client Users</Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFileDescription size={16} />}>Shared Documents</Tabs.Tab>
          <Tabs.Tab value="messages" leftSection={<IconMessage size={16} />}>Messages</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="users" pt="md">
          <ClientUsersTab />
        </Tabs.Panel>
        <Tabs.Panel value="documents" pt="md">
          <SharedDocumentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="messages" pt="md">
          <MessagesTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

// ── Client Users Tab ─────────────────────────────────────────────────

function ClientUsersTab() {
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients-for-portal'],
    queryFn: () => clientsApi.list({ page: 1, page_size: 200 }),
  });

  const clients = clientsData?.data?.items ?? [];

  const { data: clientUsersData, isLoading: usersLoading } = useQuery({
    queryKey: ['portal-client-users', selectedClientId],
    queryFn: () => portalStaffApi.listClientUsers(selectedClientId!),
    enabled: !!selectedClientId,
  });

  const clientUsers = clientUsersData?.data ?? [];

  const toggleMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      portalStaffApi.updateClientUser(userId, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-client-users', selectedClientId] });
      notifications.show({ title: 'Updated', message: 'Client user status updated', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to update client user', color: 'red' });
    },
  });

  const createForm = useForm({
    initialValues: { email: '', password: '', first_name: '', last_name: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 8 ? null : 'Min 8 characters'),
      first_name: (v) => (v.length > 0 ? null : 'Required'),
      last_name: (v) => (v.length > 0 ? null : 'Required'),
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { email: string; password: string; first_name: string; last_name: string; client_id: string }) =>
      portalStaffApi.createClientUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-client-users', selectedClientId] });
      setCreateModalOpen(false);
      createForm.reset();
      notifications.show({ title: 'Created', message: 'Client portal user created', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create client user. Email may already be in use.', color: 'red' });
    },
  });

  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: c.organization_name || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email || 'Unknown',
  }));

  const handleCreate = (values: { email: string; password: string; first_name: string; last_name: string }) => {
    if (!selectedClientId) return;
    createMutation.mutate({ ...values, client_id: selectedClientId });
  };

  return (
    <Stack gap="md">
      <Group>
        {clientsLoading ? (
          <Skeleton height={36} w={300} />
        ) : (
          <Select
            label="Select Client"
            placeholder="Choose a client..."
            data={clientOptions}
            value={selectedClientId}
            onChange={setSelectedClientId}
            searchable
            clearable
            w={350}
          />
        )}
        {selectedClientId && (
          <Button mt={24} onClick={() => setCreateModalOpen(true)}>
            Create Portal User
          </Button>
        )}
      </Group>

      {selectedClientId && (
        usersLoading ? (
          <Stack gap="xs">
            {[1, 2, 3].map((i) => <Skeleton key={i} height={40} />)}
          </Stack>
        ) : clientUsers.length === 0 ? (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text c="dimmed" ta="center">No portal users for this client. Create one above.</Text>
          </Card>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Name</Table.Th>
                <Table.Th scope="col">Email</Table.Th>
                <Table.Th scope="col">Status</Table.Th>
                <Table.Th scope="col">Last Login</Table.Th>
                <Table.Th scope="col">Created</Table.Th>
                <Table.Th scope="col">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {clientUsers.map((u) => (
                <Table.Tr key={u.id}>
                  <Table.Td><Text size="sm">{u.first_name} {u.last_name}</Text></Table.Td>
                  <Table.Td><Text size="sm">{u.email}</Text></Table.Td>
                  <Table.Td>
                    <Badge color={u.is_active ? 'green' : 'red'} variant="light">
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{new Date(u.created_at).toLocaleDateString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      checked={u.is_active}
                      onChange={() => toggleMutation.mutate({ userId: u.id, isActive: !u.is_active })}
                      label={u.is_active ? 'Active' : 'Inactive'}
                      size="sm"
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )
      )}

      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Client Portal User"
      >
        <form onSubmit={createForm.onSubmit(handleCreate)}>
          <Stack gap="sm">
            <TextInput label="First Name" required {...createForm.getInputProps('first_name')} />
            <TextInput label="Last Name" required {...createForm.getInputProps('last_name')} />
            <TextInput label="Email" type="email" required {...createForm.getInputProps('email')} />
            <PasswordInput label="Password" required {...createForm.getInputProps('password')} />
            <Button type="submit" loading={createMutation.isPending} fullWidth>
              Create User
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

// ── Shared Documents Tab ─────────────────────────────────────────────

function SharedDocumentsTab() {
  const queryClient = useQueryClient();
  const [selectedMatterId, setSelectedMatterId] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data: mattersData, isLoading: mattersLoading } = useQuery({
    queryKey: ['matters-for-portal'],
    queryFn: () => mattersApi.list({ page: 1, page_size: 200 }),
  });

  const matters = mattersData?.data?.items ?? [];

  const { data: sharedDocsData, isLoading: docsLoading } = useQuery({
    queryKey: ['portal-shared-docs', selectedMatterId, page],
    queryFn: () => portalStaffApi.listSharedDocuments(selectedMatterId!, { page, page_size: 15 }),
    enabled: !!selectedMatterId,
  });

  const sharedDocs = sharedDocsData?.data?.items ?? [];
  const totalPages = sharedDocsData?.data?.total_pages ?? 0;

  const { data: allDocsData } = useQuery({
    queryKey: ['docs-for-matter', selectedMatterId],
    queryFn: () => documentsApi.list({ matter_id: selectedMatterId!, page: 1, page_size: 200 }),
    enabled: !!selectedMatterId && shareModalOpen,
  });

  const allDocs = allDocsData?.data?.items ?? [];

  const shareForm = useForm({
    initialValues: { document_id: '', note: '' },
    validate: {
      document_id: (v) => (v ? null : 'Required'),
    },
  });

  const shareMutation = useMutation({
    mutationFn: (data: { document_id: string; matter_id: string; note?: string }) =>
      portalStaffApi.shareDocument(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-shared-docs', selectedMatterId] });
      setShareModalOpen(false);
      shareForm.reset();
      notifications.show({ title: 'Shared', message: 'Document shared with client portal', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to share document', color: 'red' });
    },
  });

  const matterOptions = matters.map((m) => ({
    value: m.id,
    label: m.title,
  }));

  const docOptions = allDocs.map((d) => ({
    value: d.id,
    label: d.filename,
  }));

  const handleShare = (values: { document_id: string; note: string }) => {
    if (!selectedMatterId) return;
    shareMutation.mutate({
      document_id: values.document_id,
      matter_id: selectedMatterId,
      note: values.note || undefined,
    });
  };

  return (
    <Stack gap="md">
      <Group>
        {mattersLoading ? (
          <Skeleton height={36} w={300} />
        ) : (
          <Select
            label="Select Matter"
            placeholder="Choose a matter..."
            data={matterOptions}
            value={selectedMatterId}
            onChange={(v) => {
              setSelectedMatterId(v);
              setPage(1);
            }}
            searchable
            clearable
            w={350}
          />
        )}
        {selectedMatterId && (
          <Button mt={24} onClick={() => setShareModalOpen(true)}>
            Share Document
          </Button>
        )}
      </Group>

      {selectedMatterId && (
        docsLoading ? (
          <Stack gap="xs">
            {[1, 2, 3].map((i) => <Skeleton key={i} height={40} />)}
          </Stack>
        ) : sharedDocs.length === 0 ? (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text c="dimmed" ta="center">No documents shared for this matter yet.</Text>
          </Card>
        ) : (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th scope="col">Filename</Table.Th>
                  <Table.Th scope="col">Type</Table.Th>
                  <Table.Th scope="col">Shared By</Table.Th>
                  <Table.Th scope="col">Shared At</Table.Th>
                  <Table.Th scope="col">Note</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sharedDocs.map((doc) => (
                  <Table.Tr key={doc.id}>
                    <Table.Td><Text size="sm" fw={500}>{doc.filename}</Text></Table.Td>
                    <Table.Td><Text size="sm">{doc.mime_type}</Text></Table.Td>
                    <Table.Td><Text size="sm">{doc.shared_by_name}</Text></Table.Td>
                    <Table.Td><Text size="sm">{new Date(doc.shared_at).toLocaleDateString()}</Text></Table.Td>
                    <Table.Td><Text size="sm" c="dimmed">{doc.note ?? '--'}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {totalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination total={totalPages} value={page} onChange={setPage} />
              </Group>
            )}
          </>
        )
      )}

      <Modal
        opened={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Share Document with Client Portal"
      >
        <form onSubmit={shareForm.onSubmit(handleShare)}>
          <Stack gap="sm">
            <Select
              label="Document"
              placeholder="Select a document..."
              data={docOptions}
              searchable
              required
              {...shareForm.getInputProps('document_id')}
            />
            <Textarea
              label="Note (optional)"
              placeholder="Add a note for the client..."
              {...shareForm.getInputProps('note')}
            />
            <Button type="submit" loading={shareMutation.isPending} fullWidth>
              Share
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

// ── Messages Tab ─────────────────────────────────────────────────────

function MessagesTab() {
  const queryClient = useQueryClient();
  const [selectedMatterId, setSelectedMatterId] = useState<string | null>(null);
  const [msgPage, setMsgPage] = useState(1);
  const [newMessage, setNewMessage] = useState('');
  const [newSubject, setNewSubject] = useState('');

  const { data: mattersData, isLoading: mattersLoading } = useQuery({
    queryKey: ['matters-for-portal-messages'],
    queryFn: () => mattersApi.list({ page: 1, page_size: 200 }),
  });

  const matters = mattersData?.data?.items ?? [];

  const { data: msgsData, isLoading: msgsLoading } = useQuery({
    queryKey: ['portal-staff-messages', selectedMatterId, msgPage],
    queryFn: () => portalStaffApi.getMessages(selectedMatterId!, { page: msgPage, page_size: 25 }),
    enabled: !!selectedMatterId,
  });

  const messages = msgsData?.data?.items ?? [];
  const msgsTotalPages = msgsData?.data?.total_pages ?? 0;

  const sendMutation = useMutation({
    mutationFn: (data: { matter_id: string; body: string; subject?: string }) =>
      portalStaffApi.sendMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-staff-messages', selectedMatterId] });
      setNewMessage('');
      setNewSubject('');
      notifications.show({ title: 'Sent', message: 'Message sent to client', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to send message', color: 'red' });
    },
  });

  const matterOptions = matters.map((m) => ({
    value: m.id,
    label: m.title,
  }));

  const handleSendMessage = () => {
    if (!selectedMatterId || !newMessage.trim()) return;
    sendMutation.mutate({
      matter_id: selectedMatterId,
      body: newMessage.trim(),
      subject: newSubject.trim() || undefined,
    });
  };

  return (
    <Stack gap="md">
      {mattersLoading ? (
        <Skeleton height={36} w={300} />
      ) : (
        <Select
          label="Select Matter"
          placeholder="Choose a matter to view messages..."
          data={matterOptions}
          value={selectedMatterId}
          onChange={(v) => {
            setSelectedMatterId(v);
            setMsgPage(1);
          }}
          searchable
          clearable
          w={350}
        />
      )}

      {selectedMatterId && (
        <Stack gap="md">
          {msgsLoading ? (
            <Stack gap="xs">
              {[1, 2, 3].map((i) => <Skeleton key={i} height={60} />)}
            </Stack>
          ) : messages.length === 0 ? (
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Text c="dimmed" ta="center">No messages for this matter yet.</Text>
            </Card>
          ) : (
            <Stack gap="xs">
              {messages.map((msg) => {
                const isStaff = msg.sender_type === 'staff';
                return (
                  <Card
                    key={msg.id}
                    padding="sm"
                    radius="md"
                    withBorder
                    bg={isStaff ? 'blue.0' : 'gray.0'}
                  >
                    <Group justify="space-between" mb={4}>
                      <Group gap="xs">
                        <Text fw={600} size="sm">{msg.sender_name}</Text>
                        <Badge size="xs" color={isStaff ? 'blue' : 'teal'} variant="light">
                          {msg.sender_type}
                        </Badge>
                        {!msg.is_read && (
                          <Badge size="xs" color="orange" variant="light">Unread</Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">
                        {new Date(msg.created_at).toLocaleString()}
                      </Text>
                    </Group>
                    {msg.subject && (
                      <Text fw={500} size="sm" mb={2}>{msg.subject}</Text>
                    )}
                    <Text size="sm">{msg.body}</Text>
                  </Card>
                );
              })}
            </Stack>
          )}

          {msgsTotalPages > 1 && (
            <Group justify="center">
              <Pagination total={msgsTotalPages} value={msgPage} onChange={setMsgPage} />
            </Group>
          )}

          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Stack gap="sm">
              <Title order={5}>Reply to Client</Title>
              <TextInput
                placeholder="Subject (optional)"
                value={newSubject}
                onChange={(e) => setNewSubject(e.currentTarget.value)}
              />
              <Textarea
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.currentTarget.value)}
                minRows={3}
              />
              <Button
                onClick={handleSendMessage}
                loading={sendMutation.isPending}
                disabled={!newMessage.trim()}
              >
                Send Message
              </Button>
            </Stack>
          </Card>
        </Stack>
      )}
    </Stack>
  );
}
