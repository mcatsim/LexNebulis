import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
  Divider,
  Loader,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconClock,
  IconFileInvoice,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlus,
  IconArrowLeft,
  IconCash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DataTable from '../../components/DataTable';
import { billingApi, clientsApi, mattersApi } from '../../api/services';
import { useTimerStore } from '../../stores/timerStore';
import type {
  Invoice,
  InvoiceStatus,
  PaymentMethod,
  TimeEntry,
} from '../../types';

const formatMoney = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'gray',
  sent: 'blue',
  paid: 'green',
  overdue: 'red',
  void: 'dark',
};

// ---------------------------------------------------------------------------
// Timer Button
// ---------------------------------------------------------------------------
function TimerButton({ onTimerStop }: { onTimerStop: (data: { matterId: string; description: string; durationMinutes: number }) => void }) {
  const { isRunning, elapsed, start, stop, tick, reset } = useTimerStore();
  const [timerModalOpen, setTimerModalOpen] = useState(false);

  const timerForm = useForm({
    initialValues: { matter_id: '', description: '' },
    validate: {
      matter_id: (v) => (v ? null : 'Matter is required'),
      description: (v) => (v.trim() ? null : 'Description is required'),
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

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => tick(), 1000);
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStart = (values: { matter_id: string; description: string }) => {
    start(values.matter_id, values.description);
    setTimerModalOpen(false);
    timerForm.reset();
  };

  const handleStop = () => {
    const result = stop();
    if (result.matterId) {
      const durationMinutes = Math.max(1, Math.ceil(result.elapsed / 60));
      onTimerStop({
        matterId: result.matterId,
        description: result.description,
        durationMinutes,
      });
    }
    reset();
  };

  return (
    <>
      {isRunning ? (
        <Button
          color="red"
          leftSection={<IconPlayerStop size={18} />}
          onClick={handleStop}
          variant="filled"
        >
          Stop Timer ({formatTimer(elapsed)})
        </Button>
      ) : (
        <Button
          color="green"
          leftSection={<IconPlayerPlay size={18} />}
          onClick={() => setTimerModalOpen(true)}
          variant="filled"
        >
          Start Timer
        </Button>
      )}

      <Modal
        opened={timerModalOpen}
        onClose={() => setTimerModalOpen(false)}
        title="Start Timer"
      >
        <form onSubmit={timerForm.onSubmit(handleStart)}>
          <Stack>
            <Select
              label="Matter"
              placeholder="Select matter"
              data={matterOptions}
              searchable
              required
              {...timerForm.getInputProps('matter_id')}
            />
            <TextInput
              label="Description"
              placeholder="What are you working on?"
              required
              {...timerForm.getInputProps('description')}
            />
            <Button type="submit" leftSection={<IconPlayerPlay size={16} />}>
              Start
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Time Entries Tab
// ---------------------------------------------------------------------------
function TimeEntriesTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [matterFilter, setMatterFilter] = useState<string | null>(null);
  const [billableFilter, setBillableFilter] = useState<boolean | undefined>(undefined);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);

  const timeForm = useForm({
    initialValues: {
      matter_id: '',
      date: new Date().toISOString().slice(0, 10),
      duration_minutes: 30,
      description: '',
      billable: true,
      rate_cents: 25000,
    },
    validate: {
      matter_id: (v) => (v ? null : 'Matter is required'),
      date: (v) => (v ? null : 'Date is required'),
      duration_minutes: (v) => (v > 0 ? null : 'Must be > 0'),
      description: (v) => (v.trim() ? null : 'Description is required'),
      rate_cents: (v) => (v >= 0 ? null : 'Rate must be >= 0'),
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
      matter_id: matterFilter ?? undefined,
      billable: billableFilter,
      start_date: startDate ? startDate.toISOString().slice(0, 10) : undefined,
      end_date: endDate ? endDate.toISOString().slice(0, 10) : undefined,
    }),
    [page, matterFilter, billableFilter, startDate, endDate],
  );

  const { data: entriesData, isLoading } = useQuery({
    queryKey: ['time-entries', queryParams],
    queryFn: () => billingApi.listTimeEntries(queryParams),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof billingApi.createTimeEntry>[0]) =>
      billingApi.createTimeEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      notifications.show({ title: 'Success', message: 'Time entry created', color: 'green' });
      setLogModalOpen(false);
      timeForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create time entry', color: 'red' });
    },
  });

  const handleLogTime = (values: typeof timeForm.values) => {
    createMutation.mutate({
      matter_id: values.matter_id,
      date: values.date,
      duration_minutes: values.duration_minutes,
      description: values.description,
      billable: values.billable,
      rate_cents: values.rate_cents,
    });
  };

  const handleTimerStop = useCallback(
    (data: { matterId: string; description: string; durationMinutes: number }) => {
      createMutation.mutate({
        matter_id: data.matterId,
        date: new Date().toISOString().slice(0, 10),
        duration_minutes: data.durationMinutes,
        description: data.description,
        billable: true,
        rate_cents: 25000,
      });
    },
    [createMutation],
  );

  const entries = entriesData?.data?.items ?? [];
  const total = entriesData?.data?.total ?? 0;

  const columns = [
    {
      key: 'date',
      label: 'Date',
      render: (e: TimeEntry) => new Date(e.date).toLocaleDateString(),
    },
    {
      key: 'matter_id',
      label: 'Matter',
      render: (e: TimeEntry) => matterLookup.get(e.matter_id) ?? e.matter_id.slice(0, 8),
    },
    { key: 'description', label: 'Description' },
    {
      key: 'duration_minutes',
      label: 'Duration',
      render: (e: TimeEntry) => `${e.duration_minutes} min`,
    },
    {
      key: 'rate_cents',
      label: 'Rate',
      render: (e: TimeEntry) => formatMoney(e.rate_cents) + '/hr',
    },
    {
      key: 'billable',
      label: 'Billable',
      render: (e: TimeEntry) => (
        <Badge color={e.billable ? 'green' : 'gray'} variant="light" size="sm">
          {e.billable ? 'Yes' : 'No'}
        </Badge>
      ),
    },
    {
      key: 'invoice_id',
      label: 'Invoiced',
      render: (e: TimeEntry) => (
        <Badge color={e.invoice_id ? 'blue' : 'orange'} variant="light" size="sm">
          {e.invoice_id ? 'Yes' : 'No'}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Filter by matter"
            data={matterOptions}
            searchable
            clearable
            value={matterFilter}
            onChange={setMatterFilter}
            w={250}
          />
          <DatePickerInput
            placeholder="Start date"
            value={startDate}
            onChange={setStartDate}
            clearable
            w={160}
          />
          <DatePickerInput
            placeholder="End date"
            value={endDate}
            onChange={setEndDate}
            clearable
            w={160}
          />
          <Select
            placeholder="Billable"
            data={[
              { value: 'true', label: 'Billable' },
              { value: 'false', label: 'Non-billable' },
            ]}
            clearable
            value={billableFilter === undefined ? null : String(billableFilter)}
            onChange={(v) =>
              setBillableFilter(v === null ? undefined : v === 'true')
            }
            w={140}
          />
        </Group>
        <Group>
          <TimerButton onTimerStop={handleTimerStop} />
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setLogModalOpen(true)}
          >
            Log Time
          </Button>
        </Group>
      </Group>

      <DataTable<TimeEntry>
        columns={columns}
        data={entries}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        loading={isLoading}
      />

      {/* Log Time Modal */}
      <Modal
        opened={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        title="Log Time Entry"
        size="md"
      >
        <form onSubmit={timeForm.onSubmit(handleLogTime)}>
          <Stack>
            <Select
              label="Matter"
              placeholder="Select matter"
              data={matterOptions}
              searchable
              required
              {...timeForm.getInputProps('matter_id')}
            />
            <TextInput
              label="Date"
              type="date"
              required
              {...timeForm.getInputProps('date')}
            />
            <NumberInput
              label="Duration (minutes)"
              min={1}
              required
              {...timeForm.getInputProps('duration_minutes')}
            />
            <Textarea
              label="Description"
              required
              autosize
              minRows={2}
              {...timeForm.getInputProps('description')}
            />
            <Checkbox
              label="Billable"
              {...timeForm.getInputProps('billable', { type: 'checkbox' })}
            />
            <NumberInput
              label="Rate (cents per hour)"
              min={0}
              required
              description={`Rate: ${formatMoney(timeForm.values.rate_cents)}/hr`}
              {...timeForm.getInputProps('rate_cents')}
            />
            <Button type="submit" loading={createMutation.isPending}>
              Save Time Entry
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Invoice Detail View
// ---------------------------------------------------------------------------
function InvoiceDetail({
  invoiceId,
  onBack,
}: {
  invoiceId: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const paymentForm = useForm({
    initialValues: {
      amount_cents: 0,
      payment_date: new Date().toISOString().slice(0, 10),
      method: 'check' as PaymentMethod,
      reference_number: '',
      notes: '',
    },
    validate: {
      amount_cents: (v) => (v > 0 ? null : 'Amount must be > 0'),
      payment_date: (v) => (v ? null : 'Date is required'),
      method: (v) => (v ? null : 'Method is required'),
    },
  });

  const { data: invoiceData, isLoading: invoiceLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => billingApi.getInvoice(invoiceId),
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', invoiceId],
    queryFn: () => billingApi.listPayments(invoiceId),
  });

  const { data: timeEntriesData } = useQuery({
    queryKey: ['time-entries', { matter_id: invoiceData?.data?.matter_id }],
    queryFn: () =>
      billingApi.listTimeEntries({
        page: 1,
        matter_id: invoiceData?.data?.matter_id,
      }),
    enabled: !!invoiceData?.data?.matter_id,
  });

  const paymentMutation = useMutation({
    mutationFn: (data: Parameters<typeof billingApi.createPayment>[0]) =>
      billingApi.createPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      notifications.show({ title: 'Success', message: 'Payment recorded', color: 'green' });
      setPaymentModalOpen(false);
      paymentForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to record payment', color: 'red' });
    },
  });

  const handlePayment = (values: typeof paymentForm.values) => {
    paymentMutation.mutate({
      invoice_id: invoiceId,
      amount_cents: values.amount_cents,
      payment_date: values.payment_date,
      method: values.method,
      reference_number: values.reference_number || undefined,
      notes: values.notes || undefined,
    });
  };

  if (invoiceLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
      </Stack>
    );
  }

  const invoice = invoiceData?.data;
  if (!invoice) {
    return (
      <Stack>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          Back to Invoices
        </Button>
        <Text c="red">Invoice not found</Text>
      </Stack>
    );
  }

  const payments = Array.isArray(paymentsData?.data) ? paymentsData.data : [];
  const lineItems = (timeEntriesData?.data?.items ?? []).filter(
    (e: TimeEntry) => e.invoice_id === invoiceId,
  );

  const totalPaid = payments.reduce((sum, p) => sum + p.amount_cents, 0);
  const balance = invoice.total_cents - totalPaid;

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
            Back to Invoices
          </Button>
          <Title order={3}>Invoice #{invoice.invoice_number}</Title>
          <Badge color={INVOICE_STATUS_COLORS[invoice.status]} variant="filled">
            {invoice.status.toUpperCase()}
          </Badge>
        </Group>
        <Button
          leftSection={<IconCash size={16} />}
          onClick={() => setPaymentModalOpen(true)}
          disabled={invoice.status === 'paid' || invoice.status === 'void'}
        >
          Record Payment
        </Button>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <div>
            <Text size="sm" c="dimmed">Issued Date</Text>
            <Text>{invoice.issued_date ? new Date(invoice.issued_date).toLocaleDateString() : 'N/A'}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Due Date</Text>
            <Text>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Subtotal</Text>
            <Text fw={600}>{formatMoney(invoice.subtotal_cents)}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Tax</Text>
            <Text fw={600}>{formatMoney(invoice.tax_cents)}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Total</Text>
            <Text fw={700} size="lg">{formatMoney(invoice.total_cents)}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Paid</Text>
            <Text fw={600} c="green">{formatMoney(totalPaid)}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Balance</Text>
            <Text fw={700} size="lg" c={balance > 0 ? 'red' : 'green'}>
              {formatMoney(balance)}
            </Text>
          </div>
        </Group>
        {invoice.notes && (
          <>
            <Divider my="sm" />
            <Text size="sm" c="dimmed">Notes: {invoice.notes}</Text>
          </>
        )}
      </Card>

      <Title order={2}>Line Items (Time Entries)</Title>
      <DataTable<TimeEntry>
        columns={[
          { key: 'date', label: 'Date', render: (e) => new Date(e.date).toLocaleDateString() },
          { key: 'description', label: 'Description' },
          { key: 'duration_minutes', label: 'Duration', render: (e) => `${e.duration_minutes} min` },
          { key: 'rate_cents', label: 'Rate', render: (e) => formatMoney(e.rate_cents) + '/hr' },
          {
            key: 'amount',
            label: 'Amount',
            render: (e) => formatMoney(Math.round((e.duration_minutes / 60) * e.rate_cents)),
          },
        ]}
        data={lineItems}
        total={lineItems.length}
        page={1}
        pageSize={lineItems.length || 10}
        onPageChange={() => {}}
      />

      <Title order={2}>Payments</Title>
      {paymentsLoading ? (
        <Loader size="sm" />
      ) : payments.length === 0 ? (
        <Text c="dimmed" size="sm">No payments recorded</Text>
      ) : (
        <DataTable
          columns={[
            {
              key: 'payment_date',
              label: 'Date',
              render: (p: (typeof payments)[0]) =>
                new Date(p.payment_date).toLocaleDateString(),
            },
            {
              key: 'amount_cents',
              label: 'Amount',
              render: (p: (typeof payments)[0]) => formatMoney(p.amount_cents),
            },
            {
              key: 'method',
              label: 'Method',
              render: (p: (typeof payments)[0]) => (
                <Badge variant="light">{p.method}</Badge>
              ),
            },
            { key: 'reference_number', label: 'Reference' },
            { key: 'notes', label: 'Notes' },
          ]}
          data={payments}
          total={payments.length}
          page={1}
          pageSize={payments.length || 10}
          onPageChange={() => {}}
        />
      )}

      {/* Record Payment Modal */}
      <Modal
        opened={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Record Payment"
        size="md"
      >
        <form onSubmit={paymentForm.onSubmit(handlePayment)}>
          <Stack>
            <NumberInput
              label="Amount (cents)"
              min={1}
              required
              description={`Amount: ${formatMoney(paymentForm.values.amount_cents)}`}
              {...paymentForm.getInputProps('amount_cents')}
            />
            <TextInput
              label="Payment Date"
              type="date"
              required
              {...paymentForm.getInputProps('payment_date')}
            />
            <Select
              label="Payment Method"
              data={[
                { value: 'check', label: 'Check' },
                { value: 'ach', label: 'ACH' },
                { value: 'credit_card', label: 'Credit Card' },
                { value: 'cash', label: 'Cash' },
                { value: 'other', label: 'Other' },
              ]}
              required
              {...paymentForm.getInputProps('method')}
            />
            <TextInput
              label="Reference Number"
              placeholder="Optional"
              {...paymentForm.getInputProps('reference_number')}
            />
            <Textarea
              label="Notes"
              placeholder="Optional"
              {...paymentForm.getInputProps('notes')}
            />
            <Button type="submit" loading={paymentMutation.isPending}>
              Record Payment
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Invoices Tab
// ---------------------------------------------------------------------------
function InvoicesTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [matterFilter, setMatterFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const invoiceForm = useForm({
    initialValues: {
      client_id: '',
      matter_id: '',
      time_entry_ids: [] as string[],
      issued_date: new Date().toISOString().slice(0, 10),
      due_date: '',
      notes: '',
    },
    validate: {
      client_id: (v) => (v ? null : 'Client is required'),
      matter_id: (v) => (v ? null : 'Matter is required'),
      time_entry_ids: (v) => (v.length > 0 ? null : 'Select at least one time entry'),
    },
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients', { page: 1, page_size: 200 }],
    queryFn: () => clientsApi.list({ page: 1, page_size: 200 }),
  });

  const { data: mattersData } = useQuery({
    queryKey: ['matters', { page: 1, page_size: 200 }],
    queryFn: () => mattersApi.list({ page: 1, page_size: 200 }),
  });

  const clientOptions = useMemo(
    () =>
      (clientsData?.data?.items ?? []).map((c) => ({
        value: c.id,
        label: c.organization_name ?? `${c.first_name} ${c.last_name}`,
      })),
    [clientsData],
  );

  const clientLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clientsData?.data?.items ?? []) {
      map.set(c.id, c.organization_name ?? `${c.first_name} ${c.last_name}`);
    }
    return map;
  }, [clientsData]);

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

  // Unbilled time entries for selected matter in the invoice creation modal
  const { data: unbilledData } = useQuery({
    queryKey: ['time-entries-unbilled', invoiceForm.values.matter_id],
    queryFn: () =>
      billingApi.listTimeEntries({
        matter_id: invoiceForm.values.matter_id,
        page: 1,
      }),
    enabled: !!invoiceForm.values.matter_id,
  });

  const unbilledEntries = useMemo(
    () => (unbilledData?.data?.items ?? []).filter((e) => !e.invoice_id && e.billable),
    [unbilledData],
  );

  const queryParams = useMemo(
    () => ({
      page,
      client_id: clientFilter ?? undefined,
      matter_id: matterFilter ?? undefined,
      invoice_status: statusFilter ?? undefined,
    }),
    [page, clientFilter, matterFilter, statusFilter],
  );

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', queryParams],
    queryFn: () => billingApi.listInvoices(queryParams),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof billingApi.createInvoice>[0]) =>
      billingApi.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      notifications.show({ title: 'Success', message: 'Invoice created', color: 'green' });
      setCreateModalOpen(false);
      invoiceForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create invoice', color: 'red' });
    },
  });

  const handleCreate = (values: typeof invoiceForm.values) => {
    createMutation.mutate({
      client_id: values.client_id,
      matter_id: values.matter_id,
      time_entry_ids: values.time_entry_ids,
      issued_date: values.issued_date || undefined,
      due_date: values.due_date || undefined,
      notes: values.notes || undefined,
    });
  };

  if (selectedInvoiceId) {
    return (
      <InvoiceDetail
        invoiceId={selectedInvoiceId}
        onBack={() => setSelectedInvoiceId(null)}
      />
    );
  }

  const invoices = invoicesData?.data?.items ?? [];
  const total = invoicesData?.data?.total ?? 0;

  const columns = [
    {
      key: 'invoice_number',
      label: 'Invoice #',
      render: (inv: Invoice) => `#${inv.invoice_number}`,
    },
    {
      key: 'client_id',
      label: 'Client',
      render: (inv: Invoice) => clientLookup.get(inv.client_id) ?? inv.client_id.slice(0, 8),
    },
    {
      key: 'matter_id',
      label: 'Matter',
      render: (inv: Invoice) => matterLookup.get(inv.matter_id) ?? inv.matter_id.slice(0, 8),
    },
    {
      key: 'total_cents',
      label: 'Total',
      render: (inv: Invoice) => formatMoney(inv.total_cents),
    },
    {
      key: 'issued_date',
      label: 'Issued',
      render: (inv: Invoice) =>
        inv.issued_date ? new Date(inv.issued_date).toLocaleDateString() : 'N/A',
    },
    {
      key: 'due_date',
      label: 'Due',
      render: (inv: Invoice) =>
        inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A',
    },
    {
      key: 'status',
      label: 'Status',
      render: (inv: Invoice) => (
        <Badge color={INVOICE_STATUS_COLORS[inv.status]} variant="filled" size="sm">
          {inv.status.toUpperCase()}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Filter by client"
            data={clientOptions}
            searchable
            clearable
            value={clientFilter}
            onChange={setClientFilter}
            w={220}
          />
          <Select
            placeholder="Filter by matter"
            data={matterOptions}
            searchable
            clearable
            value={matterFilter}
            onChange={setMatterFilter}
            w={250}
          />
          <Select
            placeholder="Status"
            data={[
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'void', label: 'Void' },
            ]}
            clearable
            value={statusFilter}
            onChange={setStatusFilter}
            w={140}
          />
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
          Create Invoice
        </Button>
      </Group>

      <DataTable<Invoice>
        columns={columns}
        data={invoices}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onRowClick={(inv) => setSelectedInvoiceId(inv.id)}
        loading={isLoading}
      />

      {/* Create Invoice Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Invoice"
        size="lg"
      >
        <form onSubmit={invoiceForm.onSubmit(handleCreate)}>
          <Stack>
            <Select
              label="Client"
              placeholder="Select client"
              data={clientOptions}
              searchable
              required
              {...invoiceForm.getInputProps('client_id')}
            />
            <Select
              label="Matter"
              placeholder="Select matter"
              data={matterOptions}
              searchable
              required
              {...invoiceForm.getInputProps('matter_id')}
            />
            <TextInput
              label="Issued Date"
              type="date"
              {...invoiceForm.getInputProps('issued_date')}
            />
            <TextInput
              label="Due Date"
              type="date"
              {...invoiceForm.getInputProps('due_date')}
            />
            <Textarea
              label="Notes"
              placeholder="Optional notes"
              {...invoiceForm.getInputProps('notes')}
            />

            {invoiceForm.values.matter_id && (
              <>
                <Divider label="Unbilled Time Entries" labelPosition="center" />
                {unbilledEntries.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No unbilled time entries for this matter
                  </Text>
                ) : (
                  <Stack gap="xs">
                    {unbilledEntries.map((entry) => (
                      <Checkbox
                        key={entry.id}
                        label={`${new Date(entry.date).toLocaleDateString()} - ${entry.description} (${entry.duration_minutes} min, ${formatMoney(entry.rate_cents)}/hr)`}
                        checked={invoiceForm.values.time_entry_ids.includes(entry.id)}
                        onChange={(e) => {
                          const ids = invoiceForm.values.time_entry_ids;
                          if (e.currentTarget.checked) {
                            invoiceForm.setFieldValue('time_entry_ids', [...ids, entry.id]);
                          } else {
                            invoiceForm.setFieldValue(
                              'time_entry_ids',
                              ids.filter((id) => id !== entry.id),
                            );
                          }
                        }}
                      />
                    ))}
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() =>
                        invoiceForm.setFieldValue(
                          'time_entry_ids',
                          unbilledEntries.map((e) => e.id),
                        )
                      }
                    >
                      Select All
                    </Button>
                  </Stack>
                )}
                {invoiceForm.errors.time_entry_ids && (
                  <Text size="sm" c="red">
                    {invoiceForm.errors.time_entry_ids}
                  </Text>
                )}
              </>
            )}

            <Button type="submit" loading={createMutation.isPending}>
              Create Invoice
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Billing Page (main)
// ---------------------------------------------------------------------------
export default function BillingPage() {
  return (
    <Stack>
      <Title order={1}>Billing</Title>
      <Tabs defaultValue="time-entries">
        <Tabs.List>
          <Tabs.Tab value="time-entries" leftSection={<IconClock size={16} />}>
            Time Entries
          </Tabs.Tab>
          <Tabs.Tab value="invoices" leftSection={<IconFileInvoice size={16} />}>
            Invoices
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="time-entries" pt="md">
          <TimeEntriesTab />
        </Tabs.Panel>

        <Tabs.Panel value="invoices" pt="md">
          <InvoicesTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
