import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  FileInput,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Stepper,
  Table,
  Tabs,
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
  IconCheck,
  IconDownload,
  IconEdit,
  IconEye,
  IconFileTypography,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DataTable from '../../components/DataTable';
import { documentsApi, mattersApi, templatesApi } from '../../api/services';
import type {
  DocumentTemplate,
  GeneratedDocument,
  TemplateCategory,
} from '../../types';

// ── Constants ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  engagement_letter: 'blue',
  correspondence: 'teal',
  pleading: 'orange',
  motion: 'red',
  contract: 'green',
  discovery: 'violet',
  other: 'gray',
};

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  engagement_letter: 'Engagement Letter',
  correspondence: 'Correspondence',
  pleading: 'Pleading',
  motion: 'Motion',
  contract: 'Contract',
  discovery: 'Discovery',
  other: 'Other',
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const PRACTICE_AREA_OPTIONS = [
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

function formatPracticeArea(value: string | null): string {
  if (!value) return '-';
  const option = PRACTICE_AREA_OPTIONS.find((o) => o.value === value);
  return option ? option.label : value.replace(/_/g, ' ');
}

// ── Upload Template Modal ──────────────────────────────────────────────

function UploadTemplateModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<{
    file: File | null;
    name: string;
    description: string;
    practice_area: string;
    category: string;
  }>({
    initialValues: {
      file: null,
      name: '',
      description: '',
      practice_area: '',
      category: 'other',
    },
    validate: {
      file: (v) => (v ? null : 'File is required'),
      name: (v) => (v.trim() ? null : 'Name is required'),
      category: (v) => (v ? null : 'Category is required'),
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => templatesApi.upload(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      notifications.show({
        title: 'Template uploaded',
        message: 'The template has been uploaded successfully.',
        color: 'green',
      });
      onClose();
      form.reset();
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to upload template';
      notifications.show({ title: 'Error', message: detail, color: 'red' });
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    if (!values.file) return;
    const formData = new FormData();
    formData.append('file', values.file);
    formData.append('name', values.name);
    if (values.description) formData.append('description', values.description);
    if (values.practice_area) formData.append('practice_area', values.practice_area);
    formData.append('category', values.category);
    uploadMutation.mutate(formData);
  };

  return (
    <Modal
      opened={opened}
      onClose={() => { onClose(); form.reset(); }}
      title="Upload Document Template"
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <FileInput
            label="Template File"
            placeholder="Select .docx file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            required
            {...form.getInputProps('file')}
          />
          <TextInput
            label="Template Name"
            placeholder="e.g., Client Engagement Letter"
            required
            {...form.getInputProps('name')}
          />
          <Textarea
            label="Description"
            placeholder="Optional description of this template"
            autosize
            minRows={2}
            {...form.getInputProps('description')}
          />
          <Group grow>
            <Select
              label="Practice Area"
              placeholder="Select practice area"
              data={PRACTICE_AREA_OPTIONS}
              clearable
              searchable
              {...form.getInputProps('practice_area')}
            />
            <Select
              label="Category"
              placeholder="Select category"
              data={CATEGORY_OPTIONS}
              required
              {...form.getInputProps('category')}
            />
          </Group>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => { onClose(); form.reset(); }}>
              Cancel
            </Button>
            <Button
              type="submit"
              leftSection={<IconUpload size={16} />}
              loading={uploadMutation.isPending}
            >
              Upload Template
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Edit Template Modal ────────────────────────────────────────────────

function EditTemplateModal({
  opened,
  onClose,
  template,
}: {
  opened: boolean;
  onClose: () => void;
  template: DocumentTemplate | null;
}) {
  const queryClient = useQueryClient();

  const form = useForm<{
    name: string;
    description: string;
    practice_area: string;
    category: string;
    is_active: boolean;
  }>({
    initialValues: {
      name: template?.name ?? '',
      description: template?.description ?? '',
      practice_area: template?.practice_area ?? '',
      category: template?.category ?? 'other',
      is_active: template?.is_active ?? true,
    },
  });

  // Reset form when template changes
  if (template && form.values.name !== template.name && !form.isDirty()) {
    form.setValues({
      name: template.name,
      description: template.description ?? '',
      practice_area: template.practice_area ?? '',
      category: template.category,
      is_active: template.is_active,
    });
  }

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string; practice_area?: string; category?: string; is_active?: boolean }) =>
      templatesApi.update(template!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      notifications.show({
        title: 'Template updated',
        message: 'The template has been updated.',
        color: 'green',
      });
      onClose();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to update template.', color: 'red' });
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    updateMutation.mutate({
      name: values.name,
      description: values.description || undefined,
      practice_area: values.practice_area || undefined,
      category: values.category,
      is_active: values.is_active,
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Edit Template"
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            label="Template Name"
            required
            {...form.getInputProps('name')}
          />
          <Textarea
            label="Description"
            autosize
            minRows={2}
            {...form.getInputProps('description')}
          />
          <Group grow>
            <Select
              label="Practice Area"
              data={PRACTICE_AREA_OPTIONS}
              clearable
              searchable
              {...form.getInputProps('practice_area')}
            />
            <Select
              label="Category"
              data={CATEGORY_OPTIONS}
              {...form.getInputProps('category')}
            />
          </Group>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={updateMutation.isPending}>Save Changes</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Template Variables Modal ───────────────────────────────────────────

function TemplateVariablesModal({
  opened,
  onClose,
  template,
}: {
  opened: boolean;
  onClose: () => void;
  template: DocumentTemplate | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['template-variables', template?.id],
    queryFn: () => templatesApi.getVariables(template!.id),
    enabled: opened && !!template,
  });

  const variables = data?.data?.variables ?? [];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Template Variables: ${template?.name ?? ''}`}
      size="md"
    >
      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
          <Text size="sm">Parsing template...</Text>
        </Group>
      ) : variables.length === 0 ? (
        <Alert color="yellow">
          No variables found in this template. Variables should use the format {'{{ variable_name }}'} inside the DOCX file.
        </Alert>
      ) : (
        <Stack>
          <Text size="sm" c="dimmed">
            This template contains {variables.length} variable{variables.length === 1 ? '' : 's'} that will be populated when generating a document.
          </Text>
          <ScrollArea.Autosize mah={400}>
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th scope="col">Variable Name</Table.Th>
                  <Table.Th scope="col">Placeholder</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {variables.map((v) => (
                  <Table.Tr key={v}>
                    <Table.Td>
                      <Text size="sm" ff="monospace">{v}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" ff="monospace">{`{{ ${v} }}`}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        </Stack>
      )}
    </Modal>
  );
}

// ── Generate Document Wizard ───────────────────────────────────────────

function GenerateDocumentWizard() {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedMatterId, setSelectedMatterId] = useState<string | null>(null);
  const [contextData, setContextData] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [generatedResult, setGeneratedResult] = useState<{
    document_id: string;
    filename: string;
    template_name: string;
  } | null>(null);

  // Template search
  const [templateSearch, setTemplateSearch] = useState('');
  const [debouncedTemplateSearch] = useDebouncedValue(templateSearch, 300);

  // Load templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates', { page: 1, page_size: 100, search: debouncedTemplateSearch || undefined }],
    queryFn: () => templatesApi.list({ page: 1, page_size: 100, search: debouncedTemplateSearch || undefined }),
  });

  const templates: DocumentTemplate[] = templatesData?.data?.items ?? [];

  // Load matters
  const [matterSearch, setMatterSearch] = useState('');
  const [debouncedMatterSearch] = useDebouncedValue(matterSearch, 300);

  const { data: mattersData } = useQuery({
    queryKey: ['matters', { page: 1, page_size: 100, search: debouncedMatterSearch || undefined }],
    queryFn: () => mattersApi.list({ page: 1, page_size: 100, search: debouncedMatterSearch || undefined }),
  });

  const matterOptions = useMemo(
    () => (mattersData?.data?.items ?? []).map((m) => ({ value: m.id, label: `${m.matter_number} - ${m.title}` })),
    [mattersData],
  );

  // Preview context
  const previewMutation = useMutation({
    mutationFn: () => templatesApi.previewContext(selectedTemplateId!, selectedMatterId!),
    onSuccess: (response) => {
      const ctx = response.data.context ?? {};
      setContextData(ctx);
      setTemplateVariables(response.data.variables ?? []);
      // Initialize overrides with existing context values
      const initial: Record<string, string> = {};
      for (const key of response.data.variables ?? []) {
        initial[key] = ctx[key] ?? '';
      }
      setOverrides(initial);
      setActiveStep(2);
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to load context';
      notifications.show({ title: 'Error', message: detail, color: 'red' });
    },
  });

  // Generate
  const generateMutation = useMutation({
    mutationFn: () => {
      // Only include overrides that differ from the auto-populated context
      const customOverrides: Record<string, string> = {};
      for (const [key, value] of Object.entries(overrides)) {
        if (value !== (contextData[key] ?? '')) {
          customOverrides[key] = value;
        }
      }
      return templatesApi.generate({
        template_id: selectedTemplateId!,
        matter_id: selectedMatterId!,
        custom_overrides: Object.keys(customOverrides).length > 0 ? customOverrides : undefined,
      });
    },
    onSuccess: (response) => {
      setGeneratedResult({
        document_id: response.data.document_id,
        filename: response.data.filename,
        template_name: response.data.template_name,
      });
      setActiveStep(3);
      queryClient.invalidateQueries({ queryKey: ['generated-documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      notifications.show({
        title: 'Document generated',
        message: `${response.data.filename} has been created.`,
        color: 'green',
      });
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to generate document';
      notifications.show({ title: 'Error', message: detail, color: 'red' });
    },
  });

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setActiveStep(1);
  };

  const handleSelectMatter = () => {
    if (selectedTemplateId && selectedMatterId) {
      previewMutation.mutate();
    }
  };

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  const handleReset = () => {
    setActiveStep(0);
    setSelectedTemplateId(null);
    setSelectedMatterId(null);
    setContextData({});
    setOverrides({});
    setTemplateVariables([]);
    setGeneratedResult(null);
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <Stack>
      <Stepper active={activeStep} onStepClick={setActiveStep} allowNextStepsSelect={false}>
        {/* Step 1: Select Template */}
        <Stepper.Step label="Select Template" description="Choose a document template">
          <Stack mt="md">
            <TextInput
              placeholder="Search templates..."
              leftSection={<IconSearch size={16} />}
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.currentTarget.value)}
              w={300}
            />
            {templatesLoading ? (
              <Group justify="center" py="xl"><Loader size="sm" /></Group>
            ) : templates.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                No templates available. Upload a template first.
              </Text>
            ) : (
              <Stack gap="sm">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    withBorder
                    padding="sm"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSelectTemplate(template.id)}
                    bg={selectedTemplateId === template.id ? 'var(--mantine-color-blue-light)' : undefined}
                  >
                    <Group justify="space-between">
                      <Group>
                        <IconFileTypography size={20} />
                        <div>
                          <Text fw={500} size="sm">{template.name}</Text>
                          {template.description && (
                            <Text size="xs" c="dimmed" lineClamp={1}>{template.description}</Text>
                          )}
                        </div>
                      </Group>
                      <Group gap="xs">
                        <Badge color={CATEGORY_COLORS[template.category]} variant="light" size="sm">
                          {CATEGORY_LABELS[template.category]}
                        </Badge>
                        {template.practice_area && (
                          <Badge variant="outline" size="sm">
                            {formatPracticeArea(template.practice_area)}
                          </Badge>
                        )}
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Stepper.Step>

        {/* Step 2: Select Matter */}
        <Stepper.Step label="Select Matter" description="Choose a matter for context">
          <Stack mt="md">
            {selectedTemplate && (
              <Alert variant="light" color="blue">
                Selected template: <strong>{selectedTemplate.name}</strong> ({selectedTemplate.filename})
              </Alert>
            )}
            <Select
              label="Matter"
              placeholder="Search and select a matter"
              data={matterOptions}
              searchable
              value={selectedMatterId}
              onChange={setSelectedMatterId}
              onSearchChange={setMatterSearch}
              size="md"
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setActiveStep(0)}>
                Back
              </Button>
              <Button
                onClick={handleSelectMatter}
                disabled={!selectedMatterId}
                loading={previewMutation.isPending}
              >
                Preview Variables
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>

        {/* Step 3: Preview & Override Variables */}
        <Stepper.Step label="Preview Variables" description="Review and customize values">
          <Stack mt="md">
            <Text size="sm" c="dimmed">
              Below are the values that will be merged into the template. You can override any value before generating.
            </Text>
            <ScrollArea.Autosize mah={500}>
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th scope="col" w={250}>Variable</Table.Th>
                    <Table.Th scope="col">Value</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {templateVariables.length > 0 ? (
                    templateVariables.map((variable) => (
                      <Table.Tr key={variable}>
                        <Table.Td>
                          <Text size="sm" ff="monospace" fw={500}>{variable}</Text>
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            size="xs"
                            value={overrides[variable] ?? ''}
                            onChange={(e) =>
                              setOverrides((prev) => ({ ...prev, [variable]: e.currentTarget.value }))
                            }
                            placeholder={contextData[variable] ? undefined : 'Not available'}
                            styles={{
                              input: {
                                color: overrides[variable] !== (contextData[variable] ?? '')
                                  ? 'var(--mantine-color-blue-6)'
                                  : undefined,
                                fontWeight: overrides[variable] !== (contextData[variable] ?? '')
                                  ? 600
                                  : undefined,
                              },
                            }}
                          />
                        </Table.Td>
                      </Table.Tr>
                    ))
                  ) : (
                    // If no variables detected in template, show full context
                    Object.entries(contextData).map(([key, value]) => (
                      <Table.Tr key={key}>
                        <Table.Td>
                          <Text size="sm" ff="monospace" fw={500}>{key}</Text>
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            size="xs"
                            value={overrides[key] ?? value}
                            onChange={(e) =>
                              setOverrides((prev) => ({ ...prev, [key]: e.currentTarget.value }))
                            }
                          />
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setActiveStep(1)}>
                Back
              </Button>
              <Button
                onClick={handleGenerate}
                loading={generateMutation.isPending}
                leftSection={<IconFileTypography size={16} />}
              >
                Generate Document
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>

        {/* Step 4: Complete */}
        <Stepper.Completed>
          <Stack mt="md" align="center" py="xl">
            <IconCheck size={48} color="var(--mantine-color-green-6)" />
            <Title order={3}>Document Generated</Title>
            {generatedResult && (
              <Stack align="center" gap="xs">
                <Text size="sm">
                  Template: <strong>{generatedResult.template_name}</strong>
                </Text>
                <Text size="sm">
                  Filename: <strong>{generatedResult.filename}</strong>
                </Text>
                <Group mt="md">
                  <Button
                    variant="light"
                    leftSection={<IconDownload size={16} />}
                    component="a"
                    href={documentsApi.getDownloadUrl(generatedResult.document_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download Document
                  </Button>
                  <Button variant="default" onClick={handleReset}>
                    Generate Another
                  </Button>
                </Group>
              </Stack>
            )}
          </Stack>
        </Stepper.Completed>
      </Stepper>

      {/* Generated Documents History */}
      <GeneratedDocumentsHistory />
    </Stack>
  );
}

// ── Generated Documents History ────────────────────────────────────────

function GeneratedDocumentsHistory() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: genDocsData, isLoading } = useQuery({
    queryKey: ['generated-documents', { page, page_size: pageSize }],
    queryFn: () => templatesApi.listGenerated({ page, page_size: pageSize }),
  });

  const genDocs: GeneratedDocument[] = genDocsData?.data?.items ?? [];
  const total = genDocsData?.data?.total ?? 0;

  if (total === 0 && !isLoading) return null;

  const columns = [
    {
      key: 'template_name',
      label: 'Template',
      render: (doc: GeneratedDocument) => (
        <Text size="sm" fw={500}>{doc.template_name || '-'}</Text>
      ),
    },
    {
      key: 'created_at',
      label: 'Generated',
      render: (doc: GeneratedDocument) => new Date(doc.created_at).toLocaleString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (doc: GeneratedDocument) =>
        doc.document_id ? (
          <Tooltip label="Download">
            <ActionIcon
              variant="subtle"
              color="blue"
              aria-label="Download document"
              component="a"
              href={documentsApi.getDownloadUrl(doc.document_id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <Text size="xs" c="dimmed">N/A</Text>
        ),
    },
  ];

  return (
    <Box mt="xl">
      <Title order={2} mb="sm">Generated Document History</Title>
      <DataTable<GeneratedDocument>
        columns={columns}
        data={genDocs}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        loading={isLoading}
      />
    </Box>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>('templates');

  // Templates list state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [practiceAreaFilter, setPracticeAreaFilter] = useState<string | null>(null);

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [variablesModalOpen, setVariablesModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);

  // Query
  const queryParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      category: categoryFilter || undefined,
      practice_area: practiceAreaFilter || undefined,
    }),
    [page, pageSize, debouncedSearch, categoryFilter, practiceAreaFilter],
  );

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates', queryParams],
    queryFn: () => templatesApi.list(queryParams),
  });

  const templates: DocumentTemplate[] = templatesData?.data?.items ?? [];
  const total = templatesData?.data?.total ?? 0;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      notifications.show({ title: 'Template deleted', message: 'The template has been deactivated.', color: 'green' });
      setDeleteConfirmId(null);
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to delete template.', color: 'red' });
    },
  });

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (t: DocumentTemplate) => (
        <Text size="sm" fw={500}>{t.name}</Text>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (t: DocumentTemplate) => (
        <Badge color={CATEGORY_COLORS[t.category]} variant="light" size="sm">
          {CATEGORY_LABELS[t.category]}
        </Badge>
      ),
    },
    {
      key: 'practice_area',
      label: 'Practice Area',
      render: (t: DocumentTemplate) => formatPracticeArea(t.practice_area),
    },
    {
      key: 'filename',
      label: 'Filename',
      render: (t: DocumentTemplate) => (
        <Text size="sm" c="dimmed">{t.filename}</Text>
      ),
    },
    {
      key: 'version',
      label: 'Version',
      render: (t: DocumentTemplate) => `v${t.version}`,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (t: DocumentTemplate) => (
        <Badge color={t.is_active ? 'green' : 'red'} variant="light" size="sm">
          {t.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (t: DocumentTemplate) => new Date(t.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (t: DocumentTemplate) => (
        <Group gap="xs">
          <Tooltip label="View variables">
            <ActionIcon
              variant="subtle"
              color="blue"
              aria-label="View variables"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setSelectedTemplate(t);
                setVariablesModalOpen(true);
              }}
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Download template">
            <ActionIcon
              variant="subtle"
              color="teal"
              aria-label="Download template"
              component="a"
              href={templatesApi.downloadUrl(t.id)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Edit">
            <ActionIcon
              variant="subtle"
              color="yellow"
              aria-label="Edit template"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setSelectedTemplate(t);
                setEditModalOpen(true);
              }}
            >
              <IconEdit size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label="Delete template"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setDeleteConfirmId(t.id);
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
        <Title order={1}>Document Templates</Title>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="templates">Templates</Tabs.Tab>
          <Tabs.Tab value="generate">Generate Document</Tabs.Tab>
        </Tabs.List>

        {/* ── Templates List Tab ──────────────────────────────────── */}
        <Tabs.Panel value="templates" pt="md">
          <Stack>
            <Group justify="space-between">
              <Group>
                <TextInput
                  placeholder="Search templates..."
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.currentTarget.value);
                    setPage(1);
                  }}
                  w={250}
                />
                <Select
                  placeholder="All categories"
                  data={CATEGORY_OPTIONS}
                  clearable
                  value={categoryFilter}
                  onChange={(v) => {
                    setCategoryFilter(v);
                    setPage(1);
                  }}
                  w={200}
                />
                <Select
                  placeholder="All practice areas"
                  data={PRACTICE_AREA_OPTIONS}
                  clearable
                  searchable
                  value={practiceAreaFilter}
                  onChange={(v) => {
                    setPracticeAreaFilter(v);
                    setPage(1);
                  }}
                  w={200}
                />
              </Group>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setUploadModalOpen(true)}
              >
                Upload Template
              </Button>
            </Group>

            <DataTable<DocumentTemplate>
              columns={columns}
              data={templates}
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              loading={isLoading}
            />
          </Stack>
        </Tabs.Panel>

        {/* ── Generate Document Tab ───────────────────────────────── */}
        <Tabs.Panel value="generate" pt="md">
          <GenerateDocumentWizard />
        </Tabs.Panel>
      </Tabs>

      {/* Modals */}
      <UploadTemplateModal
        opened={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
      />
      <EditTemplateModal
        opened={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
      />
      <TemplateVariablesModal
        opened={variablesModalOpen}
        onClose={() => {
          setVariablesModalOpen(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Template"
        size="sm"
      >
        <Stack>
          <Text>
            Are you sure you want to deactivate this template? It will no longer appear
            in template listings but existing generated documents will not be affected.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              loading={deleteMutation.isPending}
            >
              Deactivate
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
