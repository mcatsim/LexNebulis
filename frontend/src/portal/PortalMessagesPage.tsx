import { useState } from 'react';
import {
  Badge, Button, Card, Group, Pagination, Select, Skeleton, Stack, Text,
  Textarea, Title,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { portalClientApi } from '../api/services';

export default function PortalMessagesPage() {
  const queryClient = useQueryClient();
  const [selectedMatterId, setSelectedMatterId] = useState<string | null>(null);
  const [msgPage, setMsgPage] = useState(1);
  const [newMessage, setNewMessage] = useState('');
  const [newSubject, setNewSubject] = useState('');

  const { data: mattersData, isLoading: mattersLoading } = useQuery({
    queryKey: ['portal-matters-for-messages'],
    queryFn: () => portalClientApi.listMatters({ page: 1, page_size: 100 }),
  });

  const matters = mattersData?.data?.items ?? [];

  const { data: msgsData, isLoading: msgsLoading } = useQuery({
    queryKey: ['portal-messages', selectedMatterId, msgPage],
    queryFn: () => portalClientApi.getMessages(selectedMatterId!, { page: msgPage, page_size: 25 }),
    enabled: !!selectedMatterId,
  });

  const messages = msgsData?.data?.items ?? [];
  const msgsTotalPages = msgsData?.data?.total_pages ?? 0;

  const sendMutation = useMutation({
    mutationFn: (data: { matter_id: string; body: string; subject?: string }) =>
      portalClientApi.sendMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-messages', selectedMatterId] });
      queryClient.invalidateQueries({ queryKey: ['portal-unread'] });
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
      queryClient.invalidateQueries({ queryKey: ['portal-messages', selectedMatterId] });
      queryClient.invalidateQueries({ queryKey: ['portal-unread'] });
    },
  });

  const handleSendMessage = () => {
    if (!selectedMatterId || !newMessage.trim()) return;
    sendMutation.mutate({
      matter_id: selectedMatterId,
      body: newMessage.trim(),
      subject: newSubject.trim() || undefined,
    });
  };

  const matterOptions = matters.map((m) => ({
    value: m.id,
    label: m.title,
  }));

  return (
    <Stack gap="lg">
      <Title order={2}>Messages</Title>

      {mattersLoading ? (
        <Skeleton height={40} />
      ) : (
        <Select
          label="Select a matter to view messages"
          placeholder="Choose a matter..."
          data={matterOptions}
          value={selectedMatterId}
          onChange={(v) => {
            setSelectedMatterId(v);
            setMsgPage(1);
          }}
          searchable
          clearable
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
              <Text c="dimmed" ta="center">No messages for this matter. Start the conversation below.</Text>
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
      )}
    </Stack>
  );
}
