import { useParams, useNavigate } from 'react-router-dom';
import {
  Badge, Button, Card, Group, Pagination, Skeleton, Stack, Table, Tabs, Text,
  Textarea, Title,
} from '@mantine/core';
import {
  IconArrowLeft, IconFileDescription, IconInfoCircle, IconMessage,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { portalClientApi } from '../api/services';


const statusColor: Record<string, string> = {
  open: 'blue',
  pending: 'yellow',
  closed: 'gray',
  archived: 'dark',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PortalMatterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [docPage, setDocPage] = useState(1);
  const [msgPage, setMsgPage] = useState(1);
  const [newMessage, setNewMessage] = useState('');
  const [newSubject, setNewSubject] = useState('');

  const { data: matterData, isLoading: matterLoading } = useQuery({
    queryKey: ['portal-matter', id],
    queryFn: () => portalClientApi.getMatter(id!),
    enabled: !!id,
  });

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ['portal-matter-docs', id, docPage],
    queryFn: () => portalClientApi.getMatterDocuments(id!, { page: docPage, page_size: 10 }),
    enabled: !!id,
  });

  const { data: msgsData, isLoading: msgsLoading } = useQuery({
    queryKey: ['portal-matter-messages', id, msgPage],
    queryFn: () => portalClientApi.getMessages(id!, { page: msgPage, page_size: 25 }),
    enabled: !!id,
  });

  const sendMutation = useMutation({
    mutationFn: (data: { matter_id: string; body: string; subject?: string }) =>
      portalClientApi.sendMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-matter-messages', id] });
      setNewMessage('');
      setNewSubject('');
      notifications.show({ title: 'Sent', message: 'Message sent successfully', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to send message', color: 'red' });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (messageId: string) => portalClientApi.markRead(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-matter-messages', id] });
      queryClient.invalidateQueries({ queryKey: ['portal-unread'] });
    },
  });

  const matter = matterData?.data;
  const docs = docsData?.data?.items ?? [];
  const docsTotalPages = docsData?.data?.total_pages ?? 0;
  const messages = msgsData?.data?.items ?? [];
  const msgsTotalPages = msgsData?.data?.total_pages ?? 0;

  if (matterLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} />
        <Skeleton height={200} />
      </Stack>
    );
  }

  if (!matter) {
    return (
      <Stack gap="md">
        <Text c="dimmed">Matter not found.</Text>
        <Button variant="light" onClick={() => navigate('/portal/matters')}>Back to Matters</Button>
      </Stack>
    );
  }

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMutation.mutate({
      matter_id: id!,
      body: newMessage.trim(),
      subject: newSubject.trim() || undefined,
    });
  };

  return (
    <Stack gap="lg">
      <Group>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/portal/matters')}
        >
          Back
        </Button>
      </Group>

      <Group justify="space-between">
        <Title order={2}>{matter.title}</Title>
        <Badge color={statusColor[matter.status] ?? 'gray'} size="lg">
          {matter.status}
        </Badge>
      </Group>

      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFileDescription size={16} />}>
            Documents
          </Tabs.Tab>
          <Tabs.Tab value="messages" leftSection={<IconMessage size={16} />}>
            Messages
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="sm">
              <Group>
                <Text fw={600} w={150}>Status:</Text>
                <Badge color={statusColor[matter.status] ?? 'gray'} variant="light">{matter.status}</Badge>
              </Group>
              <Group>
                <Text fw={600} w={150}>Type:</Text>
                <Text>{matter.litigation_type.replace(/_/g, ' ')}</Text>
              </Group>
              <Group>
                <Text fw={600} w={150}>Date Opened:</Text>
                <Text>{matter.date_opened}</Text>
              </Group>
              {matter.date_closed && (
                <Group>
                  <Text fw={600} w={150}>Date Closed:</Text>
                  <Text>{matter.date_closed}</Text>
                </Group>
              )}
              {matter.attorney_name && (
                <Group>
                  <Text fw={600} w={150}>Attorney:</Text>
                  <Text>{matter.attorney_name}</Text>
                </Group>
              )}
              {matter.description && (
                <>
                  <Text fw={600}>Description:</Text>
                  <Text size="sm" c="dimmed">{matter.description}</Text>
                </>
              )}
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="documents" pt="md">
          {docsLoading ? (
            <Stack gap="xs">
              {[1, 2, 3].map((i) => <Skeleton key={i} height={40} />)}
            </Stack>
          ) : docs.length === 0 ? (
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Text c="dimmed" ta="center">No shared documents yet.</Text>
            </Card>
          ) : (
            <>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Filename</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Size</Table.Th>
                    <Table.Th>Shared By</Table.Th>
                    <Table.Th>Shared At</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {docs.map((doc) => (
                    <Table.Tr key={doc.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>{doc.filename}</Text>
                        {doc.note && <Text size="xs" c="dimmed">{doc.note}</Text>}
                      </Table.Td>
                      <Table.Td><Text size="sm">{doc.mime_type}</Text></Table.Td>
                      <Table.Td><Text size="sm">{formatFileSize(doc.size_bytes)}</Text></Table.Td>
                      <Table.Td><Text size="sm">{doc.shared_by_name}</Text></Table.Td>
                      <Table.Td><Text size="sm">{new Date(doc.shared_at).toLocaleDateString()}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              {docsTotalPages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination total={docsTotalPages} value={docPage} onChange={setDocPage} />
                </Group>
              )}
            </>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="messages" pt="md">
          <Stack gap="md">
            {msgsLoading ? (
              <Stack gap="xs">
                {[1, 2, 3].map((i) => <Skeleton key={i} height={60} />)}
              </Stack>
            ) : messages.length === 0 ? (
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Text c="dimmed" ta="center">No messages yet. Start the conversation below.</Text>
              </Card>
            ) : (
              <Stack gap="xs">
                {messages.map((msg) => {
                  const isClient = msg.sender_type === 'client';
                  const isUnread = !msg.is_read && msg.sender_type === 'staff';
                  return (
                    <Card
                      key={msg.id}
                      padding="sm"
                      radius="md"
                      withBorder
                      bg={isClient ? 'teal.0' : isUnread ? 'blue.0' : undefined}
                      onClick={() => {
                        if (isUnread) markReadMutation.mutate(msg.id);
                      }}
                      style={isUnread ? { cursor: 'pointer' } : undefined}
                    >
                      <Group justify="space-between" mb={4}>
                        <Group gap="xs">
                          <Text fw={600} size="sm">{msg.sender_name}</Text>
                          <Badge size="xs" color={isClient ? 'teal' : 'blue'} variant="light">
                            {msg.sender_type}
                          </Badge>
                          {isUnread && <Badge size="xs" color="red" variant="filled">New</Badge>}
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
                <Title order={5}>Send a Message</Title>
                <Textarea
                  placeholder="Subject (optional)"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.currentTarget.value)}
                  minRows={1}
                  maxRows={1}
                />
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.currentTarget.value)}
                  minRows={3}
                />
                <Button
                  color="teal"
                  onClick={handleSendMessage}
                  loading={sendMutation.isPending}
                  disabled={!newMessage.trim()}
                >
                  Send Message
                </Button>
              </Stack>
            </Card>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
