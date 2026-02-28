import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconArrowRight,
  IconEye,
  IconPlus,
  IconTrash,
  IconUserPlus,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { intakeApi, authApi } from '../../api/services';
import type {
  IntakeForm,
  IntakeSubmission,
  Lead,
  LeadSource,
  PipelineStage,
  PipelineStageSummary,
} from '../../types';
import DataTable from '../../components/DataTable';

// ── Constants ────────────────────────────────────────────────────────

const STAGE_OPTIONS: { value: PipelineStage; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'retained', label: 'Retained' },
  { value: 'declined', label: 'Declined' },
  { value: 'lost', label: 'Lost' },
];

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'advertisement', label: 'Advertisement' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
  { value: 'other', label: 'Other' },
];

const STAGE_COLORS: Record<PipelineStage, string> = {
  new: 'blue',
  contacted: 'cyan',
  qualified: 'teal',
  proposal_sent: 'orange',
  retained: 'green',
  declined: 'red',
  lost: 'gray',
};

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

function formatCurrency(cents: number | null): string {
  if (cents === null || cents === undefined) return '-';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

// ── Pipeline Summary Cards ───────────────────────────────────────────

function PipelineSummaryCards() {
  const { data } = useQuery({
    queryKey: ['pipeline-summary'],
    queryFn: () => intakeApi.getPipelineSummary(),
  });

  const summary = data?.data;
  if (!summary) return null;

  const stageMap = new Map<PipelineStage, PipelineStageSummary>();
  for (const s of summary.stages) {
    stageMap.set(s.stage, s);
  }

  return (
    <SimpleGrid cols={{ base: 2, sm: 4, lg: 7 }} spacing="sm">
      {STAGE_OPTIONS.map((opt) => {
        const stageSummary = stageMap.get(opt.value);
        const count = stageSummary?.count ?? 0;
        const value = stageSummary?.total_value_cents ?? 0;
        return (
          <Paper key={opt.value} p="sm" radius="md" withBorder>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                {opt.label}
              </Text>
              <Badge color={STAGE_COLORS[opt.value]} variant="light" size="xs">
                {count}
              </Badge>
            </Group>
            <Text fw={700} size="lg">{count}</Text>
            <Text size="xs" c="dimmed">{formatCurrency(value)}</Text>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}

// ── Create Lead Modal ────────────────────────────────────────────────

interface CreateLeadFormValues {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  organization: string;
  source: LeadSource;
  source_detail: string;
  practice_area: string;
  description: string;
  estimated_value_cents: number | '';
  notes: string;
}

function CreateLeadModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<CreateLeadFormValues>({
    initialValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      organization: '',
      source: 'other',
      source_detail: '',
      practice_area: '',
      description: '',
      estimated_value_cents: '',
      notes: '',
    },
    validate: {
      first_name: (v) => (!v.trim() ? 'First name is required' : null),
      last_name: (v) => (!v.trim() ? 'Last name is required' : null),
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateLeadFormValues) =>
      intakeApi.createLead({
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        organization: values.organization || undefined,
        source: values.source,
        source_detail: values.source_detail || undefined,
        practice_area: values.practice_area || undefined,
        description: values.description || undefined,
        estimated_value_cents: values.estimated_value_cents !== '' ? Number(values.estimated_value_cents) : undefined,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] });
      notifications.show({ title: 'Lead created', message: 'New lead has been added.', color: 'green' });
      onClose();
      form.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create lead.', color: 'red' });
    },
  });

  return (
    <Modal opened={opened} onClose={() => { onClose(); form.reset(); }} title="New Lead" size="lg">
      <form onSubmit={form.onSubmit((v) => createMutation.mutate(v))}>
        <Stack>
          <Group grow>
            <TextInput label="First Name" withAsterisk {...form.getInputProps('first_name')} />
            <TextInput label="Last Name" withAsterisk {...form.getInputProps('last_name')} />
          </Group>
          <Group grow>
            <TextInput label="Email" type="email" {...form.getInputProps('email')} />
            <TextInput label="Phone" {...form.getInputProps('phone')} />
          </Group>
          <TextInput label="Organization" {...form.getInputProps('organization')} />
          <Group grow>
            <Select label="Source" data={SOURCE_OPTIONS} {...form.getInputProps('source')} />
            <TextInput label="Source Detail" placeholder="e.g. Referred by John Smith" {...form.getInputProps('source_detail')} />
          </Group>
          <Group grow>
            <Select label="Practice Area" clearable data={PRACTICE_AREA_OPTIONS} {...form.getInputProps('practice_area')} />
            <NumberInput
              label="Estimated Value (cents)"
              placeholder="e.g. 500000 = $5,000"
              min={0}
              {...form.getInputProps('estimated_value_cents')}
            />
          </Group>
          <Textarea label="Description" minRows={2} {...form.getInputProps('description')} />
          <Textarea label="Notes" minRows={2} {...form.getInputProps('notes')} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => { onClose(); form.reset(); }}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create Lead</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Lead Detail Modal ────────────────────────────────────────────────

function LeadDetailModal({
  lead,
  onClose,
}: {
  lead: Lead | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [convertOpen, setConvertOpen] = useState(false);

  const stageMutation = useMutation({
    mutationFn: ({ leadId, newStage }: { leadId: string; newStage: string }) =>
      intakeApi.updateLead(leadId, { stage: newStage as PipelineStage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] });
      notifications.show({ title: 'Stage updated', message: 'Lead stage has been changed.', color: 'green' });
    },
  });

  if (!lead) return null;

  return (
    <>
      <Modal opened={!!lead} onClose={onClose} title={`${lead.first_name} ${lead.last_name}`} size="lg">
        <Stack>
          <SimpleGrid cols={2} spacing="sm">
            <Box>
              <Text size="xs" c="dimmed">Email</Text>
              <Text size="sm">{lead.email || '-'}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Phone</Text>
              <Text size="sm">{lead.phone || '-'}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Organization</Text>
              <Text size="sm">{lead.organization || '-'}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Source</Text>
              <Text size="sm">{lead.source}{lead.source_detail ? ` - ${lead.source_detail}` : ''}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Practice Area</Text>
              <Text size="sm">{lead.practice_area || '-'}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Estimated Value</Text>
              <Text size="sm">{formatCurrency(lead.estimated_value_cents)}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Created</Text>
              <Text size="sm">{formatDate(lead.created_at)}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Stage</Text>
              <Select
                size="xs"
                data={STAGE_OPTIONS}
                value={lead.stage}
                onChange={(v) => {
                  if (v) stageMutation.mutate({ leadId: lead.id, newStage: v });
                }}
                w={160}
              />
            </Box>
          </SimpleGrid>

          {lead.description && (
            <Box>
              <Text size="xs" c="dimmed">Description</Text>
              <Text size="sm">{lead.description}</Text>
            </Box>
          )}

          {lead.notes && (
            <Box>
              <Text size="xs" c="dimmed">Notes</Text>
              <Text size="sm">{lead.notes}</Text>
            </Box>
          )}

          {lead.converted_client_id && (
            <Badge color="green" variant="light">
              Converted on {formatDate(lead.converted_at)}
            </Badge>
          )}

          {!lead.converted_client_id && (
            <Group justify="flex-end">
              <Button
                leftSection={<IconArrowRight size={16} />}
                onClick={() => setConvertOpen(true)}
              >
                Convert to Client
              </Button>
            </Group>
          )}
        </Stack>
      </Modal>

      {convertOpen && (
        <ConvertLeadModal
          lead={lead}
          opened={convertOpen}
          onClose={() => {
            setConvertOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

// ── Convert Lead Modal ───────────────────────────────────────────────

interface ConvertFormValues {
  client_type: string;
  organization_name: string;
  create_matter: boolean;
  matter_title: string;
  litigation_type: string;
  jurisdiction: string;
}

function ConvertLeadModal({
  lead,
  opened,
  onClose,
}: {
  lead: Lead;
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<ConvertFormValues>({
    initialValues: {
      client_type: 'individual',
      organization_name: lead.organization || '',
      create_matter: false,
      matter_title: `${lead.first_name} ${lead.last_name} - ${lead.practice_area || 'General'}`,
      litigation_type: 'other',
      jurisdiction: '',
    },
  });

  const convertMutation = useMutation({
    mutationFn: (values: ConvertFormValues) =>
      intakeApi.convertLead(lead.id, {
        client_type: values.client_type,
        organization_name: values.organization_name || undefined,
        create_matter: values.create_matter,
        matter_title: values.create_matter ? values.matter_title : undefined,
        litigation_type: values.create_matter ? values.litigation_type : undefined,
        jurisdiction: values.create_matter ? (values.jurisdiction || undefined) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      notifications.show({
        title: 'Lead converted',
        message: 'Lead has been converted to a client successfully.',
        color: 'green',
      });
      onClose();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to convert lead.', color: 'red' });
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Convert Lead to Client" size="md">
      <form onSubmit={form.onSubmit((v) => convertMutation.mutate(v))}>
        <Stack>
          <Text size="sm" c="dimmed">
            Converting {lead.first_name} {lead.last_name} into a client record.
          </Text>
          <Select
            label="Client Type"
            data={[
              { value: 'individual', label: 'Individual' },
              { value: 'organization', label: 'Organization' },
            ]}
            {...form.getInputProps('client_type')}
          />
          {form.values.client_type === 'organization' && (
            <TextInput
              label="Organization Name"
              {...form.getInputProps('organization_name')}
            />
          )}

          <Select
            label="Also create a matter?"
            data={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            value={form.values.create_matter ? 'yes' : 'no'}
            onChange={(v) => form.setFieldValue('create_matter', v === 'yes')}
          />

          {form.values.create_matter && (
            <>
              <TextInput label="Matter Title" {...form.getInputProps('matter_title')} />
              <Group grow>
                <Select
                  label="Litigation Type"
                  data={PRACTICE_AREA_OPTIONS}
                  {...form.getInputProps('litigation_type')}
                />
                <TextInput label="Jurisdiction" {...form.getInputProps('jurisdiction')} />
              </Group>
            </>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={convertMutation.isPending}>Convert</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Kanban Board View ────────────────────────────────────────────────

function KanbanView({ onSelectLead }: { onSelectLead: (lead: Lead) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['leads', { page: 1, page_size: 200 }],
    queryFn: () => intakeApi.listLeads({ page: 1, page_size: 200 }),
  });

  const leads: Lead[] = data?.data?.items ?? [];

  // Group leads by stage
  const grouped = new Map<PipelineStage, Lead[]>();
  for (const opt of STAGE_OPTIONS) {
    grouped.set(opt.value, []);
  }
  for (const lead of leads) {
    const list = grouped.get(lead.stage);
    if (list) list.push(lead);
  }

  if (isLoading) {
    return <Text c="dimmed" ta="center" py="xl">Loading pipeline...</Text>;
  }

  return (
    <Box style={{ overflowX: 'auto' }}>
      <Group align="flex-start" wrap="nowrap" gap="sm" style={{ minWidth: STAGE_OPTIONS.length * 220 }}>
        {STAGE_OPTIONS.map((opt) => {
          const stageLeads = grouped.get(opt.value) ?? [];
          return (
            <Paper
              key={opt.value}
              p="sm"
              radius="md"
              withBorder
              style={{ minWidth: 200, maxWidth: 240, flex: '1 0 200px' }}
            >
              <Group justify="space-between" mb="sm">
                <Badge color={STAGE_COLORS[opt.value]} variant="light" size="sm">
                  {opt.label}
                </Badge>
                <Text size="xs" c="dimmed">{stageLeads.length}</Text>
              </Group>
              <Stack gap="xs">
                {stageLeads.length === 0 ? (
                  <Text size="xs" c="dimmed" ta="center" py="md">No leads</Text>
                ) : (
                  stageLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      padding="xs"
                      radius="sm"
                      withBorder
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelectLead(lead)}
                    >
                      <Text size="sm" fw={500} lineClamp={1}>
                        {lead.first_name} {lead.last_name}
                      </Text>
                      {lead.organization && (
                        <Text size="xs" c="dimmed" lineClamp={1}>{lead.organization}</Text>
                      )}
                      <Group gap="xs" mt={4}>
                        <Badge size="xs" variant="outline">{lead.source}</Badge>
                        {lead.practice_area && (
                          <Badge size="xs" variant="dot">{lead.practice_area}</Badge>
                        )}
                      </Group>
                      {lead.estimated_value_cents != null && lead.estimated_value_cents > 0 && (
                        <Text size="xs" fw={600} mt={4} c="green">
                          {formatCurrency(lead.estimated_value_cents)}
                        </Text>
                      )}
                    </Card>
                  ))
                )}
              </Stack>
            </Paper>
          );
        })}
      </Group>
    </Box>
  );
}

// ── List View ────────────────────────────────────────────────────────

function ListView({ onSelectLead }: { onSelectLead: (lead: Lead) => void }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [practiceAreaFilter, setPracticeAreaFilter] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leads', { page, page_size: pageSize, stage: stageFilter, source: sourceFilter, practice_area: practiceAreaFilter, search: searchText || undefined }],
    queryFn: () =>
      intakeApi.listLeads({
        page,
        page_size: pageSize,
        stage: stageFilter || undefined,
        source: sourceFilter || undefined,
        practice_area: practiceAreaFilter || undefined,
        search: searchText || undefined,
      }),
  });

  const leads: Lead[] = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => intakeApi.deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] });
      notifications.show({ title: 'Lead deleted', message: 'The lead has been removed.', color: 'green' });
    },
  });

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (lead: Lead) => (
        <Text size="sm" fw={500}>{lead.first_name} {lead.last_name}</Text>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (lead: Lead) => <Text size="sm">{lead.email || '-'}</Text>,
    },
    {
      key: 'source',
      label: 'Source',
      render: (lead: Lead) => (
        <Badge variant="outline" size="sm">{lead.source}</Badge>
      ),
    },
    {
      key: 'practice_area',
      label: 'Practice Area',
      render: (lead: Lead) => <Text size="sm">{lead.practice_area || '-'}</Text>,
    },
    {
      key: 'stage',
      label: 'Stage',
      render: (lead: Lead) => (
        <Badge color={STAGE_COLORS[lead.stage]} variant="light" size="sm">
          {lead.stage.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'value',
      label: 'Est. Value',
      render: (lead: Lead) => (
        <Text size="sm">{formatCurrency(lead.estimated_value_cents)}</Text>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (lead: Lead) => <Text size="sm">{formatDate(lead.created_at)}</Text>,
    },
    {
      key: 'actions',
      label: '',
      render: (lead: Lead) => (
        <Group gap="xs">
          <Tooltip label="View details">
            <ActionIcon variant="subtle" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSelectLead(lead); }}>
              <IconEye size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon variant="subtle" color="red" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); deleteMutation.mutate(lead.id); }}>
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group>
        <TextInput
          placeholder="Search leads..."
          size="sm"
          w={200}
          value={searchText}
          onChange={(e) => { setSearchText(e.currentTarget.value); setPage(1); }}
        />
        <Select
          placeholder="All stages"
          clearable
          data={STAGE_OPTIONS}
          value={stageFilter}
          onChange={(v) => { setStageFilter(v); setPage(1); }}
          size="sm"
          w={160}
        />
        <Select
          placeholder="All sources"
          clearable
          data={SOURCE_OPTIONS}
          value={sourceFilter}
          onChange={(v) => { setSourceFilter(v); setPage(1); }}
          size="sm"
          w={160}
        />
        <Select
          placeholder="All practice areas"
          clearable
          data={PRACTICE_AREA_OPTIONS}
          value={practiceAreaFilter}
          onChange={(v) => { setPracticeAreaFilter(v); setPage(1); }}
          size="sm"
          w={180}
        />
      </Group>
      <DataTable<Lead>
        columns={columns}
        data={leads}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        onRowClick={onSelectLead}
        loading={isLoading}
      />
    </Stack>
  );
}

// ── Submissions Tab ──────────────────────────────────────────────────

function SubmissionsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [reviewedFilter, setReviewedFilter] = useState<string | null>('false');

  const { data, isLoading } = useQuery({
    queryKey: ['submissions', { page, is_reviewed: reviewedFilter === 'true' ? true : reviewedFilter === 'false' ? false : undefined }],
    queryFn: () =>
      intakeApi.listSubmissions({
        page,
        page_size: 25,
        is_reviewed: reviewedFilter === 'true' ? true : reviewedFilter === 'false' ? false : undefined,
      }),
  });

  const submissions: IntakeSubmission[] = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const reviewMutation = useMutation({
    mutationFn: ({ id, firstName, lastName }: { id: string; firstName: string; lastName: string }) =>
      intakeApi.reviewSubmission(id, {
        create_lead: true,
        lead_first_name: firstName,
        lead_last_name: lastName,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] });
      notifications.show({ title: 'Submission reviewed', message: 'A new lead has been created from the submission.', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to review submission.', color: 'red' });
    },
  });

  const columns = [
    {
      key: 'id',
      label: 'ID',
      render: (s: IntakeSubmission) => <Text size="xs" c="dimmed">{s.id.slice(0, 8)}...</Text>,
    },
    {
      key: 'form_id',
      label: 'Form',
      render: (s: IntakeSubmission) => <Text size="xs">{s.form_id.slice(0, 8)}...</Text>,
    },
    {
      key: 'data',
      label: 'Data Preview',
      render: (s: IntakeSubmission) => {
        const preview = JSON.stringify(s.data_json).slice(0, 80);
        return <Text size="xs" lineClamp={1}>{preview}...</Text>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (s: IntakeSubmission) => (
        <Badge color={s.is_reviewed ? 'green' : 'yellow'} variant="light" size="sm">
          {s.is_reviewed ? 'Reviewed' : 'Pending'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Submitted',
      render: (s: IntakeSubmission) => <Text size="sm">{formatDate(s.created_at)}</Text>,
    },
    {
      key: 'actions',
      label: '',
      render: (s: IntakeSubmission) => {
        if (s.is_reviewed) return null;
        // Try to extract name from the submission data
        const dataObj = s.data_json as Record<string, unknown>;
        const firstName = String(dataObj.first_name || dataObj.firstName || 'Unknown');
        const lastName = String(dataObj.last_name || dataObj.lastName || 'Submission');
        return (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconUserPlus size={12} />}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              reviewMutation.mutate({ id: s.id, firstName, lastName });
            }}
            loading={reviewMutation.isPending}
          >
            Create Lead
          </Button>
        );
      },
    },
  ];

  return (
    <Stack>
      <Group>
        <Select
          placeholder="Review status"
          clearable
          data={[
            { value: 'false', label: 'Pending Review' },
            { value: 'true', label: 'Reviewed' },
          ]}
          value={reviewedFilter}
          onChange={(v) => { setReviewedFilter(v); setPage(1); }}
          size="sm"
          w={180}
        />
      </Group>
      <DataTable<IntakeSubmission>
        columns={columns}
        data={submissions}
        total={total}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        loading={isLoading}
      />
    </Stack>
  );
}

// ── Forms Tab ────────────────────────────────────────────────────────

function FormsTab() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['intake-forms'],
    queryFn: () => intakeApi.listForms({ page: 1, page_size: 100 }),
  });

  const forms: IntakeForm[] = data?.data?.items ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => intakeApi.deleteForm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intake-forms'] });
      notifications.show({ title: 'Form deleted', message: 'Intake form has been removed.', color: 'green' });
    },
  });

  return (
    <Stack>
      <Group justify="flex-end">
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
          New Form
        </Button>
      </Group>

      {isLoading ? (
        <Text c="dimmed">Loading forms...</Text>
      ) : forms.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No intake forms yet.</Text>
      ) : (
        <Stack gap="md">
          {forms.map((formItem) => (
            <Paper key={formItem.id} p="md" radius="md" withBorder>
              <Group justify="space-between">
                <Box>
                  <Group gap="sm">
                    <Text fw={600}>{formItem.name}</Text>
                    <Badge color={formItem.is_active ? 'green' : 'gray'} variant="light" size="xs">
                      {formItem.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge color={formItem.is_public ? 'blue' : 'orange'} variant="light" size="xs">
                      {formItem.is_public ? 'Public' : 'Private'}
                    </Badge>
                  </Group>
                  {formItem.description && <Text size="sm" c="dimmed" mt={4}>{formItem.description}</Text>}
                  {formItem.practice_area && <Badge variant="dot" size="xs" mt={4}>{formItem.practice_area}</Badge>}
                  <Text size="xs" c="dimmed" mt={4}>
                    {formItem.fields_json.length} field(s) | Created {formatDate(formItem.created_at)}
                  </Text>
                </Box>
                <ActionIcon variant="subtle" color="red" onClick={() => deleteMutation.mutate(formItem.id)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <CreateFormModal opened={createOpen} onClose={() => setCreateOpen(false)} />
    </Stack>
  );
}

// ── Create Form Modal ────────────────────────────────────────────────

interface CreateFormValues {
  name: string;
  description: string;
  practice_area: string;
  fields_json_text: string;
  is_active: boolean;
  is_public: boolean;
}

function CreateFormModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const defaultFieldsJson = JSON.stringify(
    [
      { name: 'first_name', type: 'text', label: 'First Name', required: true },
      { name: 'last_name', type: 'text', label: 'Last Name', required: true },
      { name: 'email', type: 'email', label: 'Email', required: false },
      { name: 'phone', type: 'tel', label: 'Phone', required: false },
      { name: 'description', type: 'textarea', label: 'How can we help?', required: false },
    ],
    null,
    2,
  );

  const form = useForm<CreateFormValues>({
    initialValues: {
      name: '',
      description: '',
      practice_area: '',
      fields_json_text: defaultFieldsJson,
      is_active: true,
      is_public: true,
    },
    validate: {
      name: (v) => (!v.trim() ? 'Name is required' : null),
      fields_json_text: (v) => {
        try {
          const parsed = JSON.parse(v);
          if (!Array.isArray(parsed)) return 'Must be a JSON array';
          return null;
        } catch {
          return 'Invalid JSON';
        }
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateFormValues) => {
      const fieldsJson = JSON.parse(values.fields_json_text) as unknown[];
      return intakeApi.createForm({
        name: values.name,
        description: values.description || undefined,
        practice_area: values.practice_area || undefined,
        fields_json: fieldsJson,
        is_active: values.is_active,
        is_public: values.is_public,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intake-forms'] });
      notifications.show({ title: 'Form created', message: 'Intake form has been created.', color: 'green' });
      onClose();
      form.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create form.', color: 'red' });
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={() => { onClose(); form.reset(); }}
      title="New Intake Form"
      size="lg"
    >
      <form onSubmit={form.onSubmit((v) => createMutation.mutate(v))}>
        <Stack>
          <TextInput label="Form Name" withAsterisk {...form.getInputProps('name')} />
          <Textarea label="Description" minRows={2} {...form.getInputProps('description')} />
          <Select
            label="Practice Area"
            clearable
            data={PRACTICE_AREA_OPTIONS}
            {...form.getInputProps('practice_area')}
          />
          <Textarea
            label="Fields JSON"
            description="Define form fields as a JSON array. Each field: {name, type, label, required, options?}"
            minRows={10}
            autosize
            styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
            {...form.getInputProps('fields_json_text')}
          />
          <Group grow>
            <Select
              label="Active"
              data={[
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
              ]}
              value={form.values.is_active ? 'true' : 'false'}
              onChange={(v) => form.setFieldValue('is_active', v === 'true')}
            />
            <Select
              label="Public (no auth required)"
              data={[
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
              ]}
              value={form.values.is_public ? 'true' : 'false'}
              onChange={(v) => form.setFieldValue('is_public', v === 'true')}
            />
          </Group>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => { onClose(); form.reset(); }}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create Form</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Main Intake Page ─────────────────────────────────────────────────

export default function IntakePage() {
  const [activeTab, setActiveTab] = useState<string | null>('pipeline');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Prefetch users for assignee display
  useQuery({
    queryKey: ['users'],
    queryFn: () => authApi.listUsers(1, 100),
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Client Intake Pipeline</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateLeadOpen(true)}>
          New Lead
        </Button>
      </Group>

      <PipelineSummaryCards />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="pipeline">Pipeline</Tabs.Tab>
          <Tabs.Tab value="submissions">Submissions</Tabs.Tab>
          <Tabs.Tab value="forms">Forms</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="pipeline" pt="md">
          <Stack>
            <Group>
              <Select
                size="xs"
                w={120}
                data={[
                  { value: 'kanban', label: 'Board' },
                  { value: 'list', label: 'List' },
                ]}
                value={viewMode}
                onChange={(v) => setViewMode((v as 'kanban' | 'list') || 'kanban')}
              />
            </Group>

            {viewMode === 'kanban' ? (
              <KanbanView onSelectLead={setSelectedLead} />
            ) : (
              <ListView onSelectLead={setSelectedLead} />
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="submissions" pt="md">
          <SubmissionsTab />
        </Tabs.Panel>

        <Tabs.Panel value="forms" pt="md">
          <FormsTab />
        </Tabs.Panel>
      </Tabs>

      {/* Modals */}
      <CreateLeadModal opened={createLeadOpen} onClose={() => setCreateLeadOpen(false)} />
      <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </Stack>
  );
}
