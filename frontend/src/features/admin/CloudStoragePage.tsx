import { useEffect, useState } from 'react';
import {
  ActionIcon, Alert, Badge, Button, Group, Loader, Paper, Stack, Table, Text, Title, Tooltip,
} from '@mantine/core';
import {
  IconBrandDropbox, IconBrandGoogleDrive, IconBrandOnedrive, IconCloud,
  IconTrash,
} from '@tabler/icons-react';
import { cloudStorageApi } from '../../api/services';
import type { CloudStorageConnection } from '../../types';

const PROVIDERS = [
  { key: 'google_drive', label: 'Google Drive', icon: IconBrandGoogleDrive, color: 'green' },
  { key: 'dropbox', label: 'Dropbox', icon: IconBrandDropbox, color: 'blue' },
  { key: 'box', label: 'Box', icon: IconCloud, color: 'cyan' },
  { key: 'onedrive', label: 'OneDrive', icon: IconBrandOnedrive, color: 'indigo' },
];

function getProviderInfo(provider: string) {
  return PROVIDERS.find((p) => p.key === provider) || { label: provider, icon: IconCloud, color: 'gray' };
}

export default function CloudStoragePage() {
  const [connections, setConnections] = useState<CloudStorageConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const res = await cloudStorageApi.listConnections();
      setConnections(res.data);
    } catch {
      setError('Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const handleConnect = async (providerKey: string) => {
    const info = getProviderInfo(providerKey);
    setConnecting(providerKey);
    setError(null);
    try {
      const res = await cloudStorageApi.authorize(providerKey, {
        provider: providerKey,
        display_name: info.label,
      });
      // Redirect to OAuth authorization URL
      window.location.href = res.data.authorization_url;
    } catch {
      setError(`Failed to initiate ${info.label} connection`);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await cloudStorageApi.disconnect(id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError('Failed to disconnect');
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Cloud Storage</Title>
      </Group>

      {error && (
        <Alert color="red" onClose={() => setError(null)} withCloseButton>
          {error}
        </Alert>
      )}

      <Paper p="md" withBorder>
        <Title order={4} mb="md">Connect a Cloud Provider</Title>
        <Group>
          {PROVIDERS.map((p) => {
            const ProviderIcon = p.icon;
            const isConnected = connections.some((c) => c.provider === p.key);
            return (
              <Button
                key={p.key}
                variant={isConnected ? 'light' : 'outline'}
                color={p.color}
                leftSection={<ProviderIcon size={20} />}
                loading={connecting === p.key}
                onClick={() => handleConnect(p.key)}
              >
                {isConnected ? `Add another ${p.label}` : `Connect ${p.label}`}
              </Button>
            );
          })}
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Title order={4} mb="md">Connected Accounts</Title>
        {loading ? (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        ) : connections.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No cloud storage accounts connected yet. Use the buttons above to connect a provider.
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Provider</Table.Th>
                <Table.Th>Display Name</Table.Th>
                <Table.Th>Account</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Connected</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {connections.map((conn) => {
                const info = getProviderInfo(conn.provider);
                const ProviderIcon = info.icon;
                return (
                  <Table.Tr key={conn.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <ProviderIcon size={18} />
                        <Text size="sm">{info.label}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>{conn.display_name}</Table.Td>
                    <Table.Td>{conn.account_email || '-'}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={conn.has_access_token ? 'green' : 'red'}
                        variant="light"
                      >
                        {conn.has_access_token ? 'Connected' : 'No Token'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(conn.created_at).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Tooltip label="Disconnect">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDisconnect(conn.id)}
                            aria-label={`Disconnect ${conn.display_name}`}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}
