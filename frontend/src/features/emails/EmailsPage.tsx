import { useCallback, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Timeline,
  Title,
  Tooltip,
  TypographyStylesProvider,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDebouncedValue } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconArrowRight,
  IconMailForward,
  IconMailOpened,
  IconPaperclip,
  IconPlus,
  IconSearch,
  IconTag,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DataTable from '../../components/DataTable';
import { emailsApi, mattersApi } from '../../api/services';
import type { FiledEmail, MatterSuggestion } from '../../types';

// ── File Email Form Values ──────────────────────────────────────────
interface FileEmailFormValues {
  matter_id: string;
  direction: string;
  subject: string;
  from_address: string;
  to_addresses: string;
  cc_addresses: string;
  bcc_addresses: string;
  date_sent: Date | null;
  body_text: string;
  body_html: string;
  tags: string;
  notes: string;
  source: string;
}

// ── Update Email Form Values ────────────────────────────────────────
interface UpdateEmailFormValues {
  notes: string;
  tags: string;
  matter_id: string;
}

const DIRECTION_OPTIONS = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
];

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual Entry' },
  { value: 'forwarded', label: 'Forwarded' },
  { value: 'outlook_plugin', label: 'Outlook Plugin' },
  { value: 'gmail_plugin', label: 'Gmail Plugin' },
];

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === 'outbound') {
    return <IconArrowRight size={16} color="var(--mantine-color-blue-6)" />;
  }
  return <IconArrowLeft size={16} color="var(--mantine-color-green-6)" />;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EmailsPage() {
  const queryClient = useQueryClient();

  // ── List State ────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [matterFilter, setMatterFilter] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);

  // ── Modal State ───────────────────────────────────────────────────
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [detailEmail, setDetailEmail] = useState<FiledEmail | null>(null);
  const [threadEmails, setThreadEmails] = useState<FiledEmail[]>([]);
  const [threadModalOpen, setThreadModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Matter Suggestions ────────────────────────────────────────────
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [debouncedSuggestionQuery] = useDebouncedValue(suggestionQuery, 400);
  const { data: suggestionsData } = useQuery({
    queryKey: ['email-suggestions', debouncedSuggestionQuery],
    queryFn: () => emailsApi.suggestMatter(debouncedSuggestionQuery),
    enabled: debouncedSuggestionQuery.length > 2,
  });
  const suggestions: MatterSuggestion[] = suggestionsData?.data ?? [];

  // ── Matters Data ──────────────────────────────────────────────────
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

  // ── List Query ────────────────────────────────────────────────────
  const queryParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      matter_id: matterFilter ?? undefined,
      direction: directionFilter ?? undefined,
      search: debouncedSearch || undefined,
    }),
    [page, pageSize, matterFilter, directionFilter, debouncedSearch],
  );

  const { data: emailsData, isLoading } = useQuery({
    queryKey: ['emails', queryParams],
    queryFn: () => emailsApi.list(queryParams),
  });

  const emails = emailsData?.data?.items ?? [];
  const total = emailsData?.data?.total ?? 0;

  // ── File Email Form ───────────────────────────────────────────────
  const fileForm = useForm<FileEmailFormValues>({
    initialValues: {
      matter_id: '',
      direction: 'inbound',
      subject: '',
      from_address: '',
      to_addresses: '',
      cc_addresses: '',
      bcc_addresses: '',
      date_sent: null,
      body_text: '',
      body_html: '',
      tags: '',
      notes: '',
      source: 'manual',
    },
    validate: {
      matter_id: (v) => (v ? null : 'Matter is required'),
    },
  });

  // ── Edit Email Form ───────────────────────────────────────────────
  const editForm = useForm<UpdateEmailFormValues>({
    initialValues: {
      notes: '',
      tags: '',
      matter_id: '',
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────
  const fileMutation = useMutation({
    mutationFn: (values: FileEmailFormValues) => {
      const splitAddresses = (s: string): string[] | undefined => {
        const parts = s.split(',').map((a) => a.trim()).filter(Boolean);
        return parts.length > 0 ? parts : undefined;
      };
      return emailsApi.create({
        matter_id: values.matter_id,
        direction: values.direction,
        subject: values.subject || undefined,
        from_address: values.from_address || undefined,
        to_addresses: splitAddresses(values.to_addresses),
        cc_addresses: splitAddresses(values.cc_addresses),
        bcc_addresses: splitAddresses(values.bcc_addresses),
        date_sent: values.date_sent ? values.date_sent.toISOString() : undefined,
        body_text: values.body_text || undefined,
        body_html: values.body_html || undefined,
        tags: values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        notes: values.notes || undefined,
        source: values.source || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      notifications.show({ title: 'Success', message: 'Email filed to matter', color: 'green' });
      setFileModalOpen(false);
      fileForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to file email', color: 'red' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { notes?: string; tags?: string[]; matter_id?: string } }) =>
      emailsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      notifications.show({ title: 'Success', message: 'Email updated', color: 'green' });
      setEditModalOpen(false);
      setDetailEmail(null);
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to update email', color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      notifications.show({ title: 'Success', message: 'Email deleted', color: 'green' });
      setDeleteConfirmId(null);
      setDetailEmail(null);
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to delete email', color: 'red' });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────
  const handleFileEmail = (values: FileEmailFormValues) => {
    fileMutation.mutate(values);
  };

  const handleUpdateEmail = (values: UpdateEmailFormValues) => {
    if (!detailEmail) return;
    updateMutation.mutate({
      id: detailEmail.id,
      data: {
        notes: values.notes || undefined,
        tags: values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        matter_id: values.matter_id || undefined,
      },
    });
  };

  const handleOpenDetail = useCallback((email: FiledEmail) => {
    setDetailEmail(email);
  }, []);

  const handleOpenEdit = useCallback(() => {
    if (!detailEmail) return;
    editForm.setValues({
      notes: detailEmail.notes ?? '',
      tags: detailEmail.tags?.join(', ') ?? '',
      matter_id: detailEmail.matter_id,
    });
    setEditModalOpen(true);
  }, [detailEmail, editForm]);

  const handleOpenThread = useCallback(async () => {
    if (!detailEmail) return;
    try {
      const res = await emailsApi.getThread(detailEmail.id);
      setThreadEmails(res.data.emails);
      setThreadModalOpen(true);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load thread', color: 'red' });
    }
  }, [detailEmail]);

  const handleFromAddressChange = useCallback(
    (addr: string) => {
      setSuggestionQuery(addr);
    },
    [],
  );

  // ── Table Columns ─────────────────────────────────────────────────
  const columns = useMemo(
    () => [
      {
        key: 'direction',
        label: '',
        render: (email: FiledEmail) => (
          <Tooltip label={email.direction === 'inbound' ? 'Inbound' : 'Outbound'}>
            <span><DirectionIcon direction={email.direction} /></span>
          </Tooltip>
        ),
      },
      {
        key: 'subject',
        label: 'Subject',
        render: (email: FiledEmail) => (
          <Text size="sm" fw={500} lineClamp={1}>
            {email.subject ?? '(no subject)'}
          </Text>
        ),
      },
      {
        key: 'from_address',
        label: 'From',
        render: (email: FiledEmail) => (
          <Text size="sm" lineClamp={1}>{email.from_address ?? '-'}</Text>
        ),
      },
      {
        key: 'date_sent',
        label: 'Date',
        render: (email: FiledEmail) => (
          <Text size="sm">{formatDate(email.date_sent)}</Text>
        ),
      },
      {
        key: 'matter_id',
        label: 'Matter',
        render: (email: FiledEmail) => (
          <Text size="sm" lineClamp={1}>
            {matterLookup.get(email.matter_id) ?? email.matter_id.slice(0, 8)}
          </Text>
        ),
      },
      {
        key: 'attachment_count',
        label: '',
        render: (email: FiledEmail) =>
          email.has_attachments ? (
            <Tooltip label={`${email.attachment_count} attachment${email.attachment_count !== 1 ? 's' : ''}`}>
              <Group gap={2}>
                <IconPaperclip size={14} />
                <Text size="xs">{email.attachment_count}</Text>
              </Group>
            </Tooltip>
          ) : null,
      },
      {
        key: 'tags',
        label: 'Tags',
        render: (email: FiledEmail) => (
          <Group gap={4}>
            {(email.tags ?? []).slice(0, 3).map((tag) => (
              <Badge key={tag} size="xs" variant="light">
                {tag}
              </Badge>
            ))}
          </Group>
        ),
      },
      {
        key: 'actions',
        label: '',
        render: (email: FiledEmail) => (
          <Tooltip label="Delete">
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setDeleteConfirmId(email.id);
              }}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [matterLookup],
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Emails</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setFileModalOpen(true)}>
          File Email
        </Button>
      </Group>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <Group>
        <TextInput
          placeholder="Search subject, from, body..."
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
        <Select
          placeholder="Direction"
          data={DIRECTION_OPTIONS}
          clearable
          value={directionFilter}
          onChange={(v) => {
            setDirectionFilter(v);
            setPage(1);
          }}
          w={140}
        />
      </Group>

      {/* ── Table ───────────────────────────────────────────────── */}
      <DataTable<FiledEmail>
        columns={columns}
        data={emails}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onRowClick={handleOpenDetail}
        loading={isLoading}
      />

      {/* ── File Email Modal ────────────────────────────────────── */}
      <Modal
        opened={fileModalOpen}
        onClose={() => setFileModalOpen(false)}
        title="File Email to Matter"
        size="lg"
      >
        <form onSubmit={fileForm.onSubmit(handleFileEmail)}>
          <Stack>
            <Select
              label="Matter"
              placeholder="Select matter"
              data={matterOptions}
              searchable
              required
              {...fileForm.getInputProps('matter_id')}
            />

            {suggestions.length > 0 && (
              <Paper p="xs" withBorder>
                <Text size="xs" fw={600} mb={4}>Suggested Matters (based on address)</Text>
                {suggestions.map((s) => (
                  <Text
                    key={s.matter_id}
                    size="xs"
                    c="blue"
                    style={{ cursor: 'pointer' }}
                    onClick={() => fileForm.setFieldValue('matter_id', s.matter_id)}
                  >
                    {s.matter_title} (used {s.use_count}x)
                  </Text>
                ))}
              </Paper>
            )}

            <Select
              label="Direction"
              data={DIRECTION_OPTIONS}
              {...fileForm.getInputProps('direction')}
            />

            <TextInput label="Subject" {...fileForm.getInputProps('subject')} />

            <TextInput
              label="From"
              placeholder="sender@example.com"
              {...fileForm.getInputProps('from_address')}
              onChange={(e) => {
                fileForm.getInputProps('from_address').onChange(e);
                handleFromAddressChange(e.currentTarget.value);
              }}
            />

            <TextInput
              label="To"
              placeholder="Comma-separated addresses"
              {...fileForm.getInputProps('to_addresses')}
            />

            <Group grow>
              <TextInput
                label="CC"
                placeholder="Comma-separated"
                {...fileForm.getInputProps('cc_addresses')}
              />
              <TextInput
                label="BCC"
                placeholder="Comma-separated"
                {...fileForm.getInputProps('bcc_addresses')}
              />
            </Group>

            <DatePickerInput
              label="Date Sent"
              placeholder="Select date"
              clearable
              {...fileForm.getInputProps('date_sent')}
            />

            <Tabs defaultValue="text">
              <Tabs.List>
                <Tabs.Tab value="text">Plain Text</Tabs.Tab>
                <Tabs.Tab value="html">HTML</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="text" pt="xs">
                <Textarea
                  placeholder="Email body (plain text)"
                  autosize
                  minRows={4}
                  maxRows={12}
                  {...fileForm.getInputProps('body_text')}
                />
              </Tabs.Panel>
              <Tabs.Panel value="html" pt="xs">
                <Textarea
                  placeholder="Email body (HTML)"
                  autosize
                  minRows={4}
                  maxRows={12}
                  {...fileForm.getInputProps('body_html')}
                />
              </Tabs.Panel>
            </Tabs>

            <TextInput
              label="Tags"
              placeholder="Comma-separated (e.g. important, privileged)"
              leftSection={<IconTag size={14} />}
              {...fileForm.getInputProps('tags')}
            />

            <Textarea
              label="Notes"
              placeholder="Optional notes about this email"
              autosize
              minRows={2}
              {...fileForm.getInputProps('notes')}
            />

            <Select
              label="Source"
              data={SOURCE_OPTIONS}
              {...fileForm.getInputProps('source')}
            />

            <Button type="submit" loading={fileMutation.isPending}>
              File Email
            </Button>
          </Stack>
        </form>
      </Modal>

      {/* ── Email Detail Modal ──────────────────────────────────── */}
      <Modal
        opened={detailEmail !== null && !editModalOpen && !threadModalOpen}
        onClose={() => setDetailEmail(null)}
        title={detailEmail?.subject ?? '(no subject)'}
        size="lg"
      >
        {detailEmail && (
          <Stack>
            <Group justify="space-between">
              <Group gap="xs">
                <DirectionIcon direction={detailEmail.direction} />
                <Badge variant="light">{detailEmail.direction}</Badge>
                {detailEmail.source && (
                  <Badge variant="outline" color="gray">{detailEmail.source}</Badge>
                )}
              </Group>
              <Group gap="xs">
                {detailEmail.thread_id && (
                  <Button variant="light" size="xs" onClick={handleOpenThread}>
                    View Thread
                  </Button>
                )}
                <Button variant="light" size="xs" onClick={handleOpenEdit}>
                  Edit
                </Button>
              </Group>
            </Group>

            <Paper p="sm" withBorder>
              <Stack gap={4}>
                <Group gap="xs">
                  <Text size="sm" fw={600} w={50}>From:</Text>
                  <Text size="sm">{detailEmail.from_address ?? '-'}</Text>
                </Group>
                <Group gap="xs">
                  <Text size="sm" fw={600} w={50}>To:</Text>
                  <Text size="sm">{detailEmail.to_addresses?.join(', ') ?? '-'}</Text>
                </Group>
                {detailEmail.cc_addresses && detailEmail.cc_addresses.length > 0 && (
                  <Group gap="xs">
                    <Text size="sm" fw={600} w={50}>CC:</Text>
                    <Text size="sm">{detailEmail.cc_addresses.join(', ')}</Text>
                  </Group>
                )}
                <Group gap="xs">
                  <Text size="sm" fw={600} w={50}>Date:</Text>
                  <Text size="sm">{formatDate(detailEmail.date_sent)}</Text>
                </Group>
                <Group gap="xs">
                  <Text size="sm" fw={600} w={60}>Matter:</Text>
                  <Text size="sm">{matterLookup.get(detailEmail.matter_id) ?? detailEmail.matter_id}</Text>
                </Group>
              </Stack>
            </Paper>

            {detailEmail.has_attachments && (
              <Group gap="xs">
                <IconPaperclip size={14} />
                <Text size="sm" c="dimmed">
                  {detailEmail.attachment_count} attachment{detailEmail.attachment_count !== 1 ? 's' : ''}
                </Text>
                {detailEmail.attachments.map((att) => (
                  <Badge key={att.id} variant="outline" size="sm">
                    {att.filename}
                  </Badge>
                ))}
              </Group>
            )}

            {(detailEmail.tags ?? []).length > 0 && (
              <Group gap={4}>
                <IconTag size={14} />
                {detailEmail.tags?.map((tag) => (
                  <Badge key={tag} size="sm" variant="light">
                    {tag}
                  </Badge>
                ))}
              </Group>
            )}

            {detailEmail.notes && (
              <Paper p="xs" withBorder bg="var(--mantine-color-yellow-0)">
                <Text size="sm" fw={600}>Notes</Text>
                <Text size="sm">{detailEmail.notes}</Text>
              </Paper>
            )}

            {/* Email Body */}
            <Paper p="sm" withBorder>
              {detailEmail.body_html ? (
                <TypographyStylesProvider>
                  <div dangerouslySetInnerHTML={{ __html: detailEmail.body_html }} />
                </TypographyStylesProvider>
              ) : (
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {detailEmail.body_text ?? '(no body)'}
                </Text>
              )}
            </Paper>

            {detailEmail.filed_by_name && (
              <Text size="xs" c="dimmed">
                Filed by {detailEmail.filed_by_name} on {formatDate(detailEmail.created_at)}
              </Text>
            )}
          </Stack>
        )}
      </Modal>

      {/* ── Edit Email Modal ────────────────────────────────────── */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Email"
        size="md"
      >
        <form onSubmit={editForm.onSubmit(handleUpdateEmail)}>
          <Stack>
            <Select
              label="Matter (re-file)"
              data={matterOptions}
              searchable
              {...editForm.getInputProps('matter_id')}
            />
            <TextInput
              label="Tags"
              placeholder="Comma-separated"
              leftSection={<IconTag size={14} />}
              {...editForm.getInputProps('tags')}
            />
            <Textarea
              label="Notes"
              autosize
              minRows={3}
              {...editForm.getInputProps('notes')}
            />
            <Button type="submit" loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </Stack>
        </form>
      </Modal>

      {/* ── Thread View Modal ───────────────────────────────────── */}
      <Modal
        opened={threadModalOpen}
        onClose={() => setThreadModalOpen(false)}
        title="Email Thread"
        size="xl"
      >
        <Timeline active={threadEmails.length - 1} bulletSize={28} lineWidth={2}>
          {threadEmails.map((email) => (
            <Timeline.Item
              key={email.id}
              bullet={
                email.direction === 'outbound' ? (
                  <IconMailForward size={14} />
                ) : (
                  <IconMailOpened size={14} />
                )
              }
              title={
                <Group gap="xs">
                  <Text size="sm" fw={600}>{email.subject ?? '(no subject)'}</Text>
                  <Badge size="xs" variant="light">
                    {email.direction}
                  </Badge>
                </Group>
              }
            >
              <Text size="xs" c="dimmed">
                {email.from_address} &rarr; {email.to_addresses?.join(', ') ?? '-'}
              </Text>
              <Text size="xs" c="dimmed" mb="xs">
                {formatDate(email.date_sent)}
              </Text>
              <Paper p="sm" withBorder>
                {email.body_html ? (
                  <TypographyStylesProvider>
                    <div dangerouslySetInnerHTML={{ __html: email.body_html }} />
                  </TypographyStylesProvider>
                ) : (
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {email.body_text ?? '(no body)'}
                  </Text>
                )}
              </Paper>
            </Timeline.Item>
          ))}
        </Timeline>
      </Modal>

      {/* ── Delete Confirmation Modal ───────────────────────────── */}
      <Modal
        opened={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Email"
        size="sm"
      >
        <Stack>
          <Text>Are you sure you want to delete this filed email? This action cannot be undone.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId);
              }}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
