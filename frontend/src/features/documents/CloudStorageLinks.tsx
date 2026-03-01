import { useEffect, useState } from 'react';
import {
  ActionIcon, Badge, Button, Group, Loader, Stack, Table, Text, Title, Tooltip,
} from '@mantine/core';
import {
  IconBrandDropbox, IconBrandGoogleDrive, IconBrandOnedrive, IconCloud,
  IconExternalLink, IconTrash,
} from '@tabler/icons-react';
import { cloudStorageApi } from '../../api/services';
import type { CloudFileItem, CloudStorageConnection, CloudStorageLink } from '../../types';
import CloudFileBrowser from './CloudFileBrowser';

interface CloudStorageLinksProps {
  matterId: string;
}

function getProviderIcon(provider: string) {
  switch (provider) {
    case 'google_drive':
      return <IconBrandGoogleDrive size={16} />;
    case 'dropbox':
      return <IconBrandDropbox size={16} />;
    case 'onedrive':
      return <IconBrandOnedrive size={16} />;
    case 'box':
      return <IconCloud size={16} />;
    default:
      return <IconCloud size={16} />;
  }
}

function getLinkTypeBadge(linkType: string) {
  switch (linkType) {
    case 'link':
      return <Badge color="blue" variant="light" size="sm">Link</Badge>;
    case 'imported':
      return <Badge color="green" variant="light" size="sm">Imported</Badge>;
    case 'exported':
      return <Badge color="orange" variant="light" size="sm">Exported</Badge>;
    default:
      return <Badge variant="light" size="sm">{linkType}</Badge>;
  }
}

export default function CloudStorageLinks({ matterId }: CloudStorageLinksProps) {
  const [links, setLinks] = useState<CloudStorageLink[]>([]);
  const [connections, setConnections] = useState<CloudStorageConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [linksRes, connsRes] = await Promise.all([
        cloudStorageApi.listLinks(matterId),
        cloudStorageApi.listConnections(),
      ]);
      setLinks(linksRes.data);
      setConnections(connsRes.data);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [matterId]);

  const handleRemoveLink = async (linkId: string) => {
    try {
      await cloudStorageApi.deleteLink(linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch {
      // fail silently
    }
  };

  const handleLink = async (file: CloudFileItem) => {
    if (!selectedConnectionId) return;
    try {
      await cloudStorageApi.createLink({
        matter_id: matterId,
        connection_id: selectedConnectionId,
        cloud_file_id: file.id,
        cloud_file_name: file.name,
        cloud_file_url: file.web_url || undefined,
        cloud_mime_type: file.mime_type || undefined,
        cloud_size_bytes: file.size || undefined,
        cloud_modified_at: file.modified_at || undefined,
        link_type: 'link',
      });
      setBrowserOpen(false);
      loadData();
    } catch {
      // fail silently
    }
  };

  const handleImport = async (file: CloudFileItem) => {
    if (!selectedConnectionId) return;
    try {
      await cloudStorageApi.importFile({
        connection_id: selectedConnectionId,
        cloud_file_id: file.id,
        matter_id: matterId,
      });
      setBrowserOpen(false);
      loadData();
    } catch {
      // fail silently
    }
  };

  const openBrowser = (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    setBrowserOpen(true);
  };

  if (loading) {
    return (
      <Group justify="center" p="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={5}>Cloud Storage Links</Title>
        {connections.length > 0 && (
          <Group gap="xs">
            {connections.map((conn) => (
              <Button
                key={conn.id}
                variant="light"
                size="xs"
                leftSection={getProviderIcon(conn.provider)}
                onClick={() => openBrowser(conn.id)}
              >
                Browse {conn.display_name}
              </Button>
            ))}
          </Group>
        )}
      </Group>

      {connections.length === 0 && (
        <Text c="dimmed" size="sm">
          No cloud storage accounts connected. Go to Admin {'>'} Cloud Storage to set up connections.
        </Text>
      )}

      {links.length === 0 ? (
        <Text c="dimmed" size="sm" ta="center" py="md">
          No cloud files linked to this matter.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Provider</Table.Th>
              <Table.Th>File Name</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Link Type</Table.Th>
              <Table.Th>Linked</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {links.map((link) => (
              <Table.Tr key={link.id}>
                <Table.Td>
                  <Group gap="xs">
                    {getProviderIcon(link.connection_provider || '')}
                    <Text size="sm">{link.connection_display_name || '-'}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  {link.cloud_file_url ? (
                    <Text
                      component="a"
                      href={link.cloud_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      c="blue"
                    >
                      {link.cloud_file_name}
                    </Text>
                  ) : (
                    <Text size="sm">{link.cloud_file_name}</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{link.cloud_mime_type || '-'}</Text>
                </Table.Td>
                <Table.Td>{getLinkTypeBadge(link.link_type)}</Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {new Date(link.created_at).toLocaleDateString()}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {link.cloud_file_url && (
                      <Tooltip label="Open in Cloud">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          component="a"
                          href={link.cloud_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${link.cloud_file_name} in cloud`}
                        >
                          <IconExternalLink size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    <Tooltip label="Remove Link">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleRemoveLink(link.id)}
                        aria-label={`Remove link to ${link.cloud_file_name}`}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {selectedConnectionId && (
        <CloudFileBrowser
          connectionId={selectedConnectionId}
          matterId={matterId}
          opened={browserOpen}
          onClose={() => setBrowserOpen(false)}
          onLink={handleLink}
          onImport={handleImport}
        />
      )}
    </Stack>
  );
}
