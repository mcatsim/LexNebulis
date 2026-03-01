import { useState } from 'react';
import {
  ActionIcon, Alert, Badge, Button, Code, CopyButton, Group, Modal,
  NumberInput, Paper, Stack, Table, Text, TextInput, Title, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconCheck, IconCopy, IconInfoCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import { scimApi } from '../../api/services';
import type { ScimBearerToken, ScimBearerTokenCreateResponse } from '../../types';

export default function ScimSettingsPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newToken, setNewToken] = useState<ScimBearerTokenCreateResponse | null>(null);
  const [description, setDescription] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [revokeTarget, setRevokeTarget] = useState<ScimBearerToken | null>(null);
  const queryClient = useQueryClient();

  const { data: tokens, isLoading } = useQuery({
    queryKey: ['scim-tokens'],
    queryFn: async () => {
      const { data } = await scimApi.listTokens();
      return data as ScimBearerToken[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await scimApi.createToken({
        description,
        expires_in_days: expiresInDays || null,
      });
      return data as ScimBearerTokenCreateResponse;
    },
    onSuccess: (data) => {
      setNewToken(data);
      setDescription('');
      setExpiresInDays(undefined);
      setCreateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['scim-tokens'] });
      notifications.show({ title: 'Token created', message: 'Copy the token now - it will not be shown again.', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create SCIM token', color: 'red' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await scimApi.revokeToken(id);
    },
    onSuccess: () => {
      setRevokeTarget(null);
      queryClient.invalidateQueries({ queryKey: ['scim-tokens'] });
      notifications.show({ title: 'Token revoked', message: 'The SCIM token has been revoked.', color: 'orange' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to revoke token', color: 'red' });
    },
  });

  const getStatusBadge = (token: ScimBearerToken) => {
    if (!token.is_active) {
      return <Badge color="red">Revoked</Badge>;
    }
    if (token.expires_at && new Date(token.expires_at) < new Date()) {
      return <Badge color="orange">Expired</Badge>;
    }
    return <Badge color="green">Active</Badge>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>SCIM Provisioning</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
          Create Token
        </Button>
      </Group>

      {newToken && (
        <Alert
          icon={<IconInfoCircle size={16} />}
          title="New SCIM Bearer Token Created"
          color="blue"
          withCloseButton
          onClose={() => setNewToken(null)}
        >
          <Text size="sm" mb="xs">
            Copy this token now. It will not be shown again.
          </Text>
          <Group gap="xs">
            <Code style={{ flex: 1, wordBreak: 'break-all' }}>{newToken.token}</Code>
            <CopyButton value={newToken.token}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy token'}>
                  <ActionIcon color={copied ? 'teal' : 'gray'} onClick={copy} variant="subtle">
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        </Alert>
      )}

      <Paper p="md" withBorder>
        <Title order={4} mb="md">Bearer Tokens</Title>
        {isLoading ? (
          <Text c="dimmed">Loading tokens...</Text>
        ) : tokens && tokens.length > 0 ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Description</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th>Last Used</Table.Th>
                <Table.Th>Expires</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tokens.map((token) => (
                <Table.Tr key={token.id}>
                  <Table.Td>{token.description}</Table.Td>
                  <Table.Td>{formatDate(token.created_at)}</Table.Td>
                  <Table.Td>{formatDate(token.last_used_at)}</Table.Td>
                  <Table.Td>{token.expires_at ? formatDate(token.expires_at) : 'Never'}</Table.Td>
                  <Table.Td>{getStatusBadge(token)}</Table.Td>
                  <Table.Td>
                    {token.is_active && (
                      <Tooltip label="Revoke token">
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => setRevokeTarget(token)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed">No SCIM tokens created yet.</Text>
        )}
      </Paper>

      <Paper p="md" withBorder>
        <Title order={4} mb="md">SCIM Endpoint Configuration</Title>
        <Text size="sm" c="dimmed" mb="md">
          Configure your Identity Provider (IdP) with these endpoint URLs.
        </Text>
        <Stack gap="sm">
          <Group gap="xs">
            <Text fw={500} size="sm" style={{ minWidth: 200 }}>Base URL:</Text>
            <Code>{window.location.origin}/api/scim/v2</Code>
          </Group>
          <Group gap="xs">
            <Text fw={500} size="sm" style={{ minWidth: 200 }}>Users Endpoint:</Text>
            <Code>{window.location.origin}/api/scim/v2/Users</Code>
          </Group>
          <Group gap="xs">
            <Text fw={500} size="sm" style={{ minWidth: 200 }}>Service Provider Config:</Text>
            <Code>{window.location.origin}/api/scim/v2/ServiceProviderConfig</Code>
          </Group>
        </Stack>
      </Paper>

      {/* Create Token Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create SCIM Bearer Token"
      >
        <Stack gap="md">
          <TextInput
            label="Description"
            placeholder="e.g., Okta SCIM Integration"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            required
          />
          <NumberInput
            label="Expires in (days)"
            placeholder="Leave blank for no expiry"
            value={expiresInDays}
            onChange={(val) => setExpiresInDays(val === '' ? undefined : Number(val))}
            min={1}
            max={3650}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!description.trim()}
            >
              Create Token
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Revoke Confirmation Modal */}
      <Modal
        opened={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        title="Revoke SCIM Token"
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to revoke the token "{revokeTarget?.description}"?
            This action cannot be undone. Any IdP using this token will lose access.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}
              loading={revokeMutation.isPending}
            >
              Revoke Token
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
