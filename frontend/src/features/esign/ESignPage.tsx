import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Timeline,
  Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconClock,
  IconEye,
  IconPlus,
  IconSend,
  IconSignature,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DataTable from '../../components/DataTable';
import { documentsApi, esignApi, mattersApi } from '../../api/services';
import type {
  SignatureAuditEntry,
  SignatureRequest,
  SignatureRequestStatus,
} from '../../types';

const STATUS_COLORS: Record<SignatureRequestStatus, string> = {
  draft: 'gray',
  pending: 'blue',
  partially_signed: 'yellow',
  completed: 'green',
  expired: 'orange',
  cancelled: 'red',
};

const STATUS_LABELS: Record<SignatureRequestStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  partially_signed: 'Partially Signed',
  completed: 'Completed',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

const AUDIT_ICONS: Record<string, React.ReactNode> = {
  created: <IconSignature size={14} />,
  sent: <IconSend size={14} />,
  viewed: <IconEye size={14} />,
  signed: <IconCheck size={14} />,
  declined: <IconX size={14} />,
  expired: <IconClock size={14} />,
  cancelled: <IconX size={14} />,
  completed: <IconCheck size={14} />,
};

const AUDIT_COLORS: Record<string, string> = {
  created: 'gray',
  sent: 'blue',
  viewed: 'cyan',
  signed: 'green',
  declined: 'red',
  expired: 'orange',
  cancelled: 'red',
  completed: 'green',
};

const STATUS_OPTIONS: { value: SignatureRequestStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'partially_signed', label: 'Partially Signed' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ── New Request Modal ──────────────────────────────────────────────────────────

interface SignerFormValues {
  name: string;
  email: string;
  role: string;
  order: number;
}

function NewRequestModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [signers, setSigners] = useState<SignerFormValues[]>([
    { name: '', email: '', role: '', order: 1 },
  ]);

  const form = useForm({
    initialValues: {
      document_id: '',
      matter_id: '',
      title: '',
      message: '',
      expires_at: null as Date | null,
    },
    validate: {
      document_id: (v) => (v ? null : 'Document is required'),
      matter_id: (v) => (v ? null : 'Matter is required'),
      title: (v) => (v.trim() ? null : 'Title is required'),
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
        label: `#${m.matter_number} - ${m.title}`,
      })),
    [mattersData],
  );

  const { data: documentsData } = useQuery({
    queryKey: ['documents', { matter_id: form.values.matter_id, page: 1, page_size: 200 }],
    queryFn: () => documentsApi.list({ matter_id: form.values.matter_id, page: 1, page_size: 200 }),
    enabled: !!form.values.matter_id,
  });

  const documentOptions = useMemo(
    () =>
      (documentsData?.data?.items ?? []).map((d) => ({
        value: d.id,
        label: d.filename,
      })),
    [documentsData],
  );

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof esignApi.create>[0]) => esignApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['esign-requests'] });
      notifications.show({ title: 'Success', message: 'Signature request created', color: 'green' });
      handleClose();
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to create request', color: 'red' }),
  });

  const addSigner = () => {
    setSigners([...signers, { name: '', email: '', role: '', order: signers.length + 1 }]);
  };

  const removeSigner = (index: number) => {
    if (signers.length <= 1) return;
    const updated = signers.filter((_, i) => i !== index);
    setSigners(updated.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const updateSigner = (index: number, field: keyof SignerFormValues, value: string | number) => {
    setSigners((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } as SignerFormValues : s))
    );
  };

  const handleClose = () => {
    form.reset();
    setSigners([{ name: '', email: '', role: '', order: 1 }]);
    onClose();
  };

  const handleSubmit = (values: typeof form.values) => {
    const validSigners = signers.filter((s) => s.name.trim() && s.email.trim());
    if (validSigners.length === 0) {
      notifications.show({ title: 'Error', message: 'At least one signer is required', color: 'red' });
      return;
    }
    createMutation.mutate({
      document_id: values.document_id,
      matter_id: values.matter_id,
      title: values.title,
      message: values.message || undefined,
      expires_at: values.expires_at ? values.expires_at.toISOString() : undefined,
      signers: validSigners.map((s) => ({
        name: s.name,
        email: s.email,
        role: s.role || undefined,
        order: s.order,
      })),
    });
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="New Signature Request" size="lg">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <Select
            label="Matter"
            placeholder="Select matter"
            data={matterOptions}
            searchable
            required
            {...form.getInputProps('matter_id')}
          />
          <Select
            label="Document"
            placeholder="Select document"
            data={documentOptions}
            searchable
            required
            disabled={!form.values.matter_id}
            {...form.getInputProps('document_id')}
          />
          <TextInput label="Title" placeholder="e.g. Engagement Letter Signature" required {...form.getInputProps('title')} />
          <Textarea label="Message to Signers" placeholder="Optional message..." {...form.getInputProps('message')} />
          <DateTimePicker
            label="Expiration Date"
            placeholder="Optional expiration"
            clearable
            {...form.getInputProps('expires_at')}
          />

          <Text fw={600} size="sm" mt="md">Signers</Text>
          {signers.map((signer, index) => (
            <Paper key={index} shadow="xs" p="sm" withBorder>
              <Group align="flex-end">
                <TextInput
                  label="Name"
                  placeholder="Full name"
                  value={signer.name}
                  onChange={(e) => updateSigner(index, 'name', e.currentTarget.value)}
                  style={{ flex: 1 }}
                  required
                />
                <TextInput
                  label="Email"
                  placeholder="email@example.com"
                  value={signer.email}
                  onChange={(e) => updateSigner(index, 'email', e.currentTarget.value)}
                  style={{ flex: 1 }}
                  required
                />
                <TextInput
                  label="Role"
                  placeholder="e.g. Client"
                  value={signer.role}
                  onChange={(e) => updateSigner(index, 'role', e.currentTarget.value)}
                  w={120}
                />
                <NumberInput
                  label="Order"
                  min={1}
                  value={signer.order}
                  onChange={(v) => updateSigner(index, 'order', typeof v === 'number' ? v : 1)}
                  w={80}
                />
                {signers.length > 1 && (
                  <ActionIcon color="red" variant="subtle" onClick={() => removeSigner(index)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>
            </Paper>
          ))}
          <Button variant="outline" leftSection={<IconPlus size={16} />} onClick={addSigner} size="sm">
            Add Signer
          </Button>

          <Button type="submit" loading={createMutation.isPending} leftSection={<IconSignature size={16} />}>
            Create Request
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Request Detail Modal ───────────────────────────────────────────────────────

function RequestDetailModal({
  request,
  onClose,
}: {
  request: SignatureRequest | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: auditData } = useQuery({
    queryKey: ['esign-audit', request?.id],
    queryFn: () => esignApi.getAuditTrail(request!.id),
    enabled: !!request,
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => esignApi.send(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['esign-requests'] });
      notifications.show({ title: 'Success', message: 'Signing request sent', color: 'green' });
      onClose();
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to send request', color: 'red' }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => esignApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['esign-requests'] });
      notifications.show({ title: 'Success', message: 'Request cancelled', color: 'green' });
      onClose();
    },
    onError: () => notifications.show({ title: 'Error', message: 'Failed to cancel request', color: 'red' }),
  });

  if (!request) return null;

  const auditEntries: SignatureAuditEntry[] = auditData?.data ?? [];

  const signerStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'gray',
      viewed: 'cyan',
      signed: 'green',
      declined: 'red',
    };
    return (
      <Badge color={colors[status] || 'gray'} variant="light" size="sm">
        {status}
      </Badge>
    );
  };

  const canSend = request.status === 'draft';
  const canCancel = !['completed', 'cancelled'].includes(request.status);

  return (
    <Modal opened={!!request} onClose={onClose} title="Signature Request Details" size="xl">
      <Stack>
        <Group justify="space-between">
          <div>
            <Title order={4}>{request.title}</Title>
            {request.message && <Text size="sm" c="dimmed" mt={4}>{request.message}</Text>}
          </div>
          <Badge color={STATUS_COLORS[request.status]} variant="filled" size="lg">
            {STATUS_LABELS[request.status]}
          </Badge>
        </Group>

        <Group>
          <Text size="sm" c="dimmed">Created: {new Date(request.created_at).toLocaleString()}</Text>
          {request.expires_at && (
            <Text size="sm" c="dimmed">Expires: {new Date(request.expires_at).toLocaleString()}</Text>
          )}
          {request.completed_at && (
            <Text size="sm" c="dimmed">Completed: {new Date(request.completed_at).toLocaleString()}</Text>
          )}
        </Group>

        <Title order={5} mt="md">Signers</Title>
        <Stack gap="xs">
          {request.signers.map((signer) => (
            <Paper key={signer.id} shadow="xs" p="sm" withBorder>
              <Group justify="space-between">
                <div>
                  <Group gap="xs">
                    <Text fw={600} size="sm">{signer.name}</Text>
                    {signer.role && <Badge variant="light" size="xs">{signer.role}</Badge>}
                  </Group>
                  <Text size="xs" c="dimmed">{signer.email}</Text>
                  {signer.signed_at && (
                    <Text size="xs" c="dimmed">Signed: {new Date(signer.signed_at).toLocaleString()}</Text>
                  )}
                  {signer.decline_reason && (
                    <Text size="xs" c="red">Declined: {signer.decline_reason}</Text>
                  )}
                </div>
                <Group gap="xs">
                  {signerStatusBadge(signer.status)}
                  <Badge variant="outline" size="xs">Order: {signer.order}</Badge>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>

        <Title order={5} mt="md">Audit Trail</Title>
        {auditEntries.length > 0 ? (
          <Timeline active={auditEntries.length - 1} bulletSize={24} lineWidth={2}>
            {auditEntries.map((entry) => (
              <Timeline.Item
                key={entry.id}
                bullet={AUDIT_ICONS[entry.action] || <IconClock size={14} />}
                color={AUDIT_COLORS[entry.action] || 'gray'}
                title={entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}
              >
                {entry.details && <Text size="sm" c="dimmed">{entry.details}</Text>}
                <Text size="xs" c="dimmed">{new Date(entry.timestamp).toLocaleString()}</Text>
                {entry.ip_address && <Text size="xs" c="dimmed">IP: {entry.ip_address}</Text>}
              </Timeline.Item>
            ))}
          </Timeline>
        ) : (
          <Text size="sm" c="dimmed">No audit entries yet.</Text>
        )}

        <Group mt="md">
          {canSend && (
            <Button
              leftSection={<IconSend size={16} />}
              onClick={() => sendMutation.mutate(request.id)}
              loading={sendMutation.isPending}
            >
              Send for Signing
            </Button>
          )}
          {canCancel && (
            <Button
              color="red"
              variant="outline"
              leftSection={<IconX size={16} />}
              onClick={() => cancelMutation.mutate(request.id)}
              loading={cancelMutation.isPending}
            >
              Cancel Request
            </Button>
          )}
          {request.status === 'completed' && request.certificate_storage_key && (
            <Button
              variant="outline"
              leftSection={<IconCheck size={16} />}
              component="a"
              href={esignApi.getCertificateUrl(request.id)}
              target="_blank"
            >
              Download Certificate
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ESignPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SignatureRequest | null>(null);

  const queryParams = useMemo(() => ({
    page,
    page_size: pageSize,
    request_status: statusFilter || undefined,
  }), [page, pageSize, statusFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['esign-requests', queryParams],
    queryFn: () => esignApi.list(queryParams),
  });

  const requests = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const columns = [
    { key: 'title', label: 'Title' },
    {
      key: 'status',
      label: 'Status',
      render: (r: SignatureRequest) => (
        <Badge color={STATUS_COLORS[r.status]} variant="light" size="sm">
          {STATUS_LABELS[r.status]}
        </Badge>
      ),
    },
    {
      key: 'signers',
      label: 'Signers',
      render: (r: SignatureRequest) => {
        const signed = r.signers.filter((s) => s.status === 'signed').length;
        return (
          <Text size="sm">
            {signed}/{r.signers.length} signed
          </Text>
        );
      },
    },
    {
      key: 'expires_at',
      label: 'Expires',
      render: (r: SignatureRequest) =>
        r.expires_at ? new Date(r.expires_at).toLocaleDateString() : '-',
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (r: SignatureRequest) => new Date(r.created_at).toLocaleDateString(),
    },
  ];

  return (
    <Stack>
      <Title order={2}>E-Signature</Title>

      <Group justify="space-between">
        <Select
          placeholder="Filter by status"
          data={STATUS_OPTIONS}
          clearable
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          w={200}
        />
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
          New Request
        </Button>
      </Group>

      <DataTable<SignatureRequest>
        columns={columns}
        data={requests}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onRowClick={setSelectedRequest}
        loading={isLoading}
      />

      <NewRequestModal opened={createOpen} onClose={() => setCreateOpen(false)} />
      <RequestDetailModal request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </Stack>
  );
}
