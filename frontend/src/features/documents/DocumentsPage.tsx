import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Button,
  FileInput,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconDownload,
  IconSearch,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DataTable from '../../components/DataTable';
import { documentsApi, mattersApi } from '../../api/services';
import type { Document as LegalDocument } from '../../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [matterFilter, setMatterFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const uploadForm = useForm<{
    file: File | null;
    matter_id: string;
    description: string;
  }>({
    initialValues: {
      file: null,
      matter_id: '',
      description: '',
    },
    validate: {
      file: (v) => (v ? null : 'File is required'),
      matter_id: (v) => (v ? null : 'Matter is required'),
    },
  });

  const { data: mattersData } = useQuery({
    queryKey: ['matters', { page: 1, page_size: 200 }],
    queryFn: () => mattersApi.list({ page: 1, page_size: 200 }),
  });

  const matterOptions = useMemo(
    () =>
      (mattersData?.data?.items ?? []).map((m) => ({
        value: m.id,
        label: `${m.matter_number} - ${m.title}`,
      })),
    [mattersData],
  );

  const matterLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of mattersData?.data?.items ?? []) {
      map.set(m.id, `${m.matter_number} - ${m.title}`);
    }
    return map;
  }, [mattersData]);

  const queryParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      matter_id: matterFilter ?? undefined,
      search: debouncedSearch || undefined,
    }),
    [page, pageSize, matterFilter, debouncedSearch],
  );

  const { data: docsData, isLoading } = useQuery({
    queryKey: ['documents', queryParams],
    queryFn: () => documentsApi.list(queryParams),
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => documentsApi.upload(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      notifications.show({ title: 'Success', message: 'Document uploaded', color: 'green' });
      setUploadModalOpen(false);
      uploadForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to upload document', color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      notifications.show({ title: 'Success', message: 'Document deleted', color: 'green' });
      setDeleteConfirmId(null);
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to delete document', color: 'red' });
    },
  });

  const handleUpload = (values: typeof uploadForm.values) => {
    if (!values.file) return;
    const formData = new FormData();
    formData.append('file', values.file);
    formData.append('matter_id', values.matter_id);
    if (values.description) {
      formData.append('description', values.description);
    }
    uploadMutation.mutate(formData);
  };

  const handleDelete = () => {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId);
    }
  };

  const documents = docsData?.data?.items ?? [];
  const total = docsData?.data?.total ?? 0;

  const columns = [
    {
      key: 'filename',
      label: 'Filename',
      render: (doc: LegalDocument) => (
        <Text size="sm" fw={500}>{doc.filename}</Text>
      ),
    },
    {
      key: 'matter_id',
      label: 'Matter',
      render: (doc: LegalDocument) => matterLookup.get(doc.matter_id) ?? doc.matter_id.slice(0, 8),
    },
    {
      key: 'description',
      label: 'Description',
      render: (doc: LegalDocument) => doc.description ?? '-',
    },
    {
      key: 'mime_type',
      label: 'Type',
      render: (doc: LegalDocument) => doc.mime_type,
    },
    {
      key: 'size_bytes',
      label: 'Size',
      render: (doc: LegalDocument) => formatFileSize(doc.size_bytes),
    },
    {
      key: 'version',
      label: 'Version',
      render: (doc: LegalDocument) => `v${doc.version}`,
    },
    {
      key: 'created_at',
      label: 'Uploaded',
      render: (doc: LegalDocument) => new Date(doc.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (doc: LegalDocument) => (
        <Group gap="xs">
          <Tooltip label="Download">
            <ActionIcon
              variant="subtle"
              color="blue"
              component="a"
              href={documentsApi.getDownloadUrl(doc.id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setDeleteConfirmId(doc.id);
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={1}>Documents</Title>
        <Button leftSection={<IconUpload size={16} />} onClick={() => setUploadModalOpen(true)}>
          Upload Document
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by filename..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          w={300}
        />
        <Select
          placeholder="Filter by matter"
          data={matterOptions}
          searchable
          clearable
          value={matterFilter}
          onChange={(v) => {
            setMatterFilter(v);
            setPage(1);
          }}
          w={280}
        />
      </Group>

      <DataTable<LegalDocument>
        columns={columns}
        data={documents}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        loading={isLoading}
      />

      {/* Upload Modal */}
      <Modal
        opened={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Upload Document"
        size="md"
      >
        <form onSubmit={uploadForm.onSubmit(handleUpload)}>
          <Stack>
            <FileInput
              label="File"
              placeholder="Select file"
              required
              {...uploadForm.getInputProps('file')}
            />
            <Select
              label="Matter"
              placeholder="Select matter"
              data={matterOptions}
              searchable
              required
              {...uploadForm.getInputProps('matter_id')}
            />
            <Textarea
              label="Description"
              placeholder="Optional description"
              autosize
              minRows={2}
              {...uploadForm.getInputProps('description')}
            />
            <Button type="submit" loading={uploadMutation.isPending}>
              Upload
            </Button>
          </Stack>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Document"
        size="sm"
      >
        <Stack>
          <Text>Are you sure you want to delete this document? This action cannot be undone.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete} loading={deleteMutation.isPending}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
