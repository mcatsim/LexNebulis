import { useEffect, useState } from 'react';
import {
  ActionIcon, Breadcrumbs, Group, Loader, Modal, Stack, Table, Text, Tooltip,
} from '@mantine/core';
import {
  IconDownload, IconFile, IconFolder, IconLink, IconArrowLeft,
} from '@tabler/icons-react';
import { cloudStorageApi } from '../../api/services';
import type { CloudFileItem } from '../../types';

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface CloudFileBrowserProps {
  connectionId: string;
  matterId: string;
  opened: boolean;
  onClose: () => void;
  onLink: (file: CloudFileItem) => void;
  onImport: (file: CloudFileItem) => void;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function CloudFileBrowser({
  connectionId,
  opened,
  onClose,
  onLink,
  onImport,
}: CloudFileBrowserProps) {
  const [items, setItems] = useState<CloudFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: 'Root' },
  ]);

  const loadFolder = async (folderId: string | null) => {
    setLoading(true);
    try {
      const res = await cloudStorageApi.browse(connectionId, folderId || undefined);
      setItems(res.data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      setBreadcrumbs([{ id: null, name: 'Root' }]);
      loadFolder(null);
    }
  }, [opened, connectionId]);

  const handleFolderClick = (folder: CloudFileItem) => {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    loadFolder(folder.id);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    loadFolder(newBreadcrumbs[newBreadcrumbs.length - 1]?.id ?? null);
  };

  const handleBack = () => {
    if (breadcrumbs.length > 1) {
      handleBreadcrumbClick(breadcrumbs.length - 2);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Browse Cloud Storage"
      size="xl"
    >
      <Stack gap="md">
        <Group gap="xs">
          {breadcrumbs.length > 1 && (
            <Tooltip label="Go back">
              <ActionIcon variant="subtle" onClick={handleBack} aria-label="Go back">
                <IconArrowLeft size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Breadcrumbs>
            {breadcrumbs.map((bc, idx) => (
              <Text
                key={idx}
                size="sm"
                c={idx === breadcrumbs.length - 1 ? undefined : 'blue'}
                style={{ cursor: idx < breadcrumbs.length - 1 ? 'pointer' : 'default' }}
                onClick={() => idx < breadcrumbs.length - 1 && handleBreadcrumbClick(idx)}
              >
                {bc.name}
              </Text>
            ))}
          </Breadcrumbs>
        </Group>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : items.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            This folder is empty.
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th>Modified</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Group gap="xs">
                      {item.is_folder ? (
                        <IconFolder size={18} color="var(--mantine-color-yellow-6)" />
                      ) : (
                        <IconFile size={18} color="var(--mantine-color-blue-6)" />
                      )}
                      {item.is_folder ? (
                        <Text
                          size="sm"
                          c="blue"
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleFolderClick(item)}
                        >
                          {item.name}
                        </Text>
                      ) : (
                        <Text size="sm">{item.name}</Text>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{item.is_folder ? '-' : formatFileSize(item.size)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {item.modified_at
                        ? new Date(item.modified_at).toLocaleDateString()
                        : '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {!item.is_folder && (
                      <Group gap="xs">
                        <Tooltip label="Link to matter">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => onLink(item)}
                            aria-label={`Link ${item.name}`}
                          >
                            <IconLink size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Import to MinIO">
                          <ActionIcon
                            variant="subtle"
                            color="green"
                            onClick={() => onImport(item)}
                            aria-label={`Import ${item.name}`}
                          >
                            <IconDownload size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Modal>
  );
}
