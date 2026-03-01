import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Loader,
  Modal,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCopy,
  IconCreditCard,
  IconLink,
  IconSend,
  IconSettings,
  IconWebhook,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi, paymentsApi } from '../../api/services';
import type { Invoice, PaymentLink, WebhookEvent } from '../../types';

const formatMoney = (cents: number) => '$' + (cents / 100).toFixed(2);

const STATUS_COLORS: Record<string, string> = {
  active: 'blue',
  paid: 'green',
  expired: 'gray',
  cancelled: 'red',
};

// ── Payment Links Tab ─────────────────────────────────────────────────────────

function PaymentLinksTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | string>(30);

  const { data: linksData, isLoading: linksLoading } = useQuery({
    queryKey: ['payment-links', page],
    queryFn: async () => {
      const { data } = await paymentsApi.listLinks({ page, page_size: 25 });
      return data;
    },
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices-for-payment'],
    queryFn: async () => {
      const { data } = await billingApi.listInvoices({ invoice_status: 'sent' });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { invoice_id: string; description?: string; expires_in_days?: number }) =>
      paymentsApi.createLink(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
      setCreateOpen(false);
      setSelectedInvoiceId(null);
      setDescription('');
      setExpiresInDays(30);
      notifications.show({ title: 'Success', message: 'Payment link created', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create payment link', color: 'red' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.cancelLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
      notifications.show({ title: 'Cancelled', message: 'Payment link cancelled', color: 'orange' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to cancel link', color: 'red' });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.sendLink(id, {}),
    onSuccess: () => {
      notifications.show({ title: 'Sent', message: 'Payment notification sent', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to send notification', color: 'red' });
    },
  });

  const links = linksData?.items ?? [];
  const totalPages = linksData?.total_pages ?? 1;

  const invoices = invoicesData?.items ?? [];
  const invoiceOptions = invoices.map((inv: Invoice) => ({
    value: inv.id,
    label: `#${inv.invoice_number} - ${formatMoney(inv.total_cents)}`,
  }));

  const handleCreate = () => {
    if (!selectedInvoiceId) return;
    const days = typeof expiresInDays === 'number' ? expiresInDays : undefined;
    createMutation.mutate({
      invoice_id: selectedInvoiceId,
      description: description || undefined,
      expires_in_days: days,
    });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Payment Links</Title>
        <Button leftSection={<IconLink size={16} />} onClick={() => setCreateOpen(true)}>
          Create Payment Link
        </Button>
      </Group>

      {linksLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col">Invoice #</Table.Th>
              <Table.Th scope="col">Client</Table.Th>
              <Table.Th scope="col">Amount</Table.Th>
              <Table.Th scope="col">Status</Table.Th>
              <Table.Th scope="col">Created</Table.Th>
              <Table.Th scope="col">Expires</Table.Th>
              <Table.Th scope="col">Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {links.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text ta="center" c="dimmed" py="md">
                    No payment links found
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {links.map((link: PaymentLink) => (
              <Table.Tr key={link.id}>
                <Table.Td>#{link.invoice_number ?? '---'}</Table.Td>
                <Table.Td>{link.client_name ?? '---'}</Table.Td>
                <Table.Td>{formatMoney(link.amount_cents)}</Table.Td>
                <Table.Td>
                  <Badge color={STATUS_COLORS[link.status] ?? 'gray'}>{link.status}</Badge>
                </Table.Td>
                <Table.Td>{new Date(link.created_at).toLocaleDateString()}</Table.Td>
                <Table.Td>
                  {link.expires_at ? new Date(link.expires_at).toLocaleDateString() : 'Never'}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <CopyButton value={window.location.origin + '/pay/' + link.access_token}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied' : 'Copy link'}>
                          <ActionIcon variant="subtle" color={copied ? 'green' : 'blue'} aria-label="Copy payment link" onClick={copy}>
                            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                    {link.status === 'active' && (
                      <>
                        <Tooltip label="Send notification">
                          <ActionIcon
                            variant="subtle"
                            color="teal"
                            aria-label="Send payment link"
                            onClick={() => sendMutation.mutate(link.id)}
                            loading={sendMutation.isPending}
                          >
                            <IconSend size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Cancel">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label="Cancel payment link"
                            onClick={() => cancelMutation.mutate(link.id)}
                            loading={cancelMutation.isPending}
                          >
                            <IconX size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Text size="sm">
            Page {page} of {totalPages}
          </Text>
          <Button
            variant="outline"
            size="xs"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </Group>
      )}

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Create Payment Link" size="md">
        <Stack>
          <Select
            label="Invoice"
            placeholder="Select an invoice"
            data={invoiceOptions}
            value={selectedInvoiceId}
            onChange={setSelectedInvoiceId}
            searchable
            required
          />
          <TextInput
            label="Description (optional)"
            placeholder="Payment for legal services"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
          <NumberInput
            label="Expires in (days)"
            placeholder="30"
            value={expiresInDays}
            onChange={setExpiresInDays}
            min={1}
            max={365}
          />
          <Button
            onClick={handleCreate}
            loading={createMutation.isPending}
            disabled={!selectedInvoiceId}
            fullWidth
          >
            Create Payment Link
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab() {
  const queryClient = useQueryClient();
  const [processor, setProcessor] = useState<string | null>('stripe');
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [accountType, setAccountType] = useState<string | null>('operating');
  const [surchargeEnabled, setSurchargeEnabled] = useState(false);
  const [surchargeRate, setSurchargeRate] = useState<number | string>(0);
  const [loaded, setLoaded] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['payment-settings'],
    queryFn: async () => {
      const { data } = await paymentsApi.getSettings();
      return data;
    },
    retry: false,
  });

  if (settings && !loaded) {
    setProcessor(settings.processor ?? 'stripe');
    setPublishableKey(settings.publishable_key ?? '');
    setAccountType(settings.account_type ?? 'operating');
    setSurchargeEnabled(settings.surcharge_enabled ?? false);
    setSurchargeRate(settings.surcharge_rate ?? 0);
    setLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: (data: {
      processor?: string;
      is_active?: boolean;
      api_key?: string;
      webhook_secret?: string;
      publishable_key?: string;
      account_type?: string;
      surcharge_enabled?: boolean;
      surcharge_rate?: number;
    }) => paymentsApi.saveSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] });
      setApiKey('');
      setWebhookSecret('');
      notifications.show({ title: 'Saved', message: 'Payment settings updated', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to save settings', color: 'red' });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      processor: processor ?? undefined,
      api_key: apiKey || undefined,
      webhook_secret: webhookSecret || undefined,
      publishable_key: publishableKey || undefined,
      account_type: accountType ?? undefined,
      surcharge_enabled: surchargeEnabled,
      surcharge_rate: typeof surchargeRate === 'number' ? surchargeRate : 0,
    });
  };

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <Stack>
      <Title order={2}>Payment Processor Configuration</Title>

      <Card shadow="sm" padding="lg" withBorder>
        <Stack>
          <Select
            label="Processor"
            data={[
              { value: 'stripe', label: 'Stripe' },
              { value: 'lawpay', label: 'LawPay' },
              { value: 'manual', label: 'Manual' },
            ]}
            value={processor}
            onChange={setProcessor}
          />

          <PasswordInput
            label="API Key"
            placeholder={settings?.api_key_masked ?? 'Enter API key'}
            value={apiKey}
            onChange={(e) => setApiKey(e.currentTarget.value)}
            description="Leave blank to keep existing key"
          />

          <PasswordInput
            label="Webhook Secret"
            placeholder={settings?.webhook_secret_masked ?? 'Enter webhook secret'}
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.currentTarget.value)}
            description="Leave blank to keep existing secret"
          />

          <TextInput
            label="Publishable Key"
            placeholder="pk_live_..."
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.currentTarget.value)}
          />

          <Select
            label="Account Type"
            data={[
              { value: 'operating', label: 'Operating' },
              { value: 'trust', label: 'Trust' },
            ]}
            value={accountType}
            onChange={setAccountType}
          />

          <Switch
            label="Surcharge Enabled"
            description="Pass processing fees to the client"
            checked={surchargeEnabled}
            onChange={(e) => setSurchargeEnabled(e.currentTarget.checked)}
          />

          {surchargeEnabled && (
            <NumberInput
              label="Surcharge Rate"
              description="e.g. 0.03 for 3%"
              value={surchargeRate}
              onChange={setSurchargeRate}
              min={0}
              max={1}
              step={0.005}
              decimalScale={3}
            />
          )}

          <Button onClick={handleSave} loading={saveMutation.isPending}>
            Save Settings
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}

// ── Webhooks Tab ──────────────────────────────────────────────────────────────

function WebhooksTab() {
  const [page, setPage] = useState(1);

  const { data: webhooksData, isLoading } = useQuery({
    queryKey: ['payment-webhooks', page],
    queryFn: async () => {
      const { data } = await paymentsApi.listWebhooks({ page, page_size: 25 });
      return data;
    },
  });

  const webhooks = webhooksData?.items ?? [];
  const totalPages = webhooksData?.total_pages ?? 1;

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <Stack>
      <Title order={2}>Webhook Events</Title>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Processor</Table.Th>
            <Table.Th scope="col">Event Type</Table.Th>
            <Table.Th scope="col">Event ID</Table.Th>
            <Table.Th scope="col">Processed</Table.Th>
            <Table.Th scope="col">Error</Table.Th>
            <Table.Th scope="col">Time</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {webhooks.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text ta="center" c="dimmed" py="md">
                  No webhook events found
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
          {webhooks.map((wh: WebhookEvent) => (
            <Table.Tr key={wh.id}>
              <Table.Td>{wh.processor}</Table.Td>
              <Table.Td>{wh.event_type}</Table.Td>
              <Table.Td>
                <Text size="sm" ff="monospace">
                  {wh.event_id}
                </Text>
              </Table.Td>
              <Table.Td>
                {wh.processed ? (
                  <><IconCheck size={16} color="green" aria-hidden="true" /> Processed</>
                ) : (
                  <><IconX size={16} color="red" aria-hidden="true" /> Unprocessed</>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm" c={wh.error_message ? 'red' : 'dimmed'}>
                  {wh.error_message ?? '---'}
                </Text>
              </Table.Td>
              <Table.Td>{new Date(wh.created_at).toLocaleString()}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Text size="sm">
            Page {page} of {totalPages}
          </Text>
          <Button
            variant="outline"
            size="xs"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </Group>
      )}
    </Stack>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  return (
    <Stack>
      <Group>
        <IconCreditCard size={28} />
        <Title order={1}>Online Payments</Title>
      </Group>

      <Tabs defaultValue="links">
        <Tabs.List>
          <Tabs.Tab value="links" leftSection={<IconLink size={16} />}>
            Payment Links
          </Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
            Settings
          </Tabs.Tab>
          <Tabs.Tab value="webhooks" leftSection={<IconWebhook size={16} />}>
            Webhooks
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="links" pt="md">
          <PaymentLinksTab />
        </Tabs.Panel>

        <Tabs.Panel value="settings" pt="md">
          <SettingsTab />
        </Tabs.Panel>

        <Tabs.Panel value="webhooks" pt="md">
          <WebhooksTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
