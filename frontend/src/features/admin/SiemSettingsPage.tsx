import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconWebhook,
  IconServer,
  IconSettings,
  IconCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { siemApi } from '../../api/services';
import type { SiemConfig } from '../../types';

export default function SiemSettingsPage() {
  const queryClient = useQueryClient();

  const { data: configData, isLoading } = useQuery({
    queryKey: ['siem-config'],
    queryFn: () => siemApi.getConfig(),
  });

  const config = configData?.data as SiemConfig | undefined;

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [syslogHost, setSyslogHost] = useState('');
  const [syslogPort, setSyslogPort] = useState('514');
  const [syslogProtocol, setSyslogProtocol] = useState('udp');
  const [syslogTlsCaCert, setSyslogTlsCaCert] = useState('');
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [realtimeFormat, setRealtimeFormat] = useState('json');

  useEffect(() => {
    if (config) {
      setWebhookUrl(config.webhook_url || '');
      setWebhookSecret('');
      setSyslogHost(config.syslog_host || '');
      setSyslogPort(String(config.syslog_port || 514));
      setSyslogProtocol(config.syslog_protocol || 'udp');
      setSyslogTlsCaCert(config.syslog_tls_ca_cert || '');
      setRealtimeEnabled(config.realtime_enabled || false);
      setRealtimeFormat(config.realtime_format || 'json');
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        webhook_url: webhookUrl || null,
        syslog_host: syslogHost || null,
        syslog_port: parseInt(syslogPort, 10) || 514,
        syslog_protocol: syslogProtocol,
        syslog_tls_ca_cert: syslogTlsCaCert || null,
        realtime_enabled: realtimeEnabled,
        realtime_format: realtimeFormat,
      };
      if (webhookSecret) {
        payload.webhook_secret = webhookSecret;
      }
      return siemApi.saveConfig(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siem-config'] });
      setWebhookSecret('');
      notifications.show({ title: 'SIEM Config Saved', message: 'Configuration updated successfully', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to save SIEM configuration', color: 'red' });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: () => siemApi.testWebhook(),
    onSuccess: ({ data }) => {
      const result = data as { status: string; response_status?: number; detail?: string };
      notifications.show({
        title: 'Webhook Test',
        message: result.status === 'sent'
          ? `Sent successfully (HTTP ${result.response_status})`
          : `Error: ${result.detail}`,
        color: result.status === 'sent' ? 'green' : 'red',
      });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Configure webhook URL and save first', color: 'orange' });
    },
  });

  const testSyslogMutation = useMutation({
    mutationFn: () => siemApi.testSyslog(),
    onSuccess: ({ data }) => {
      const result = data as { status: string; message?: string; detail?: string };
      notifications.show({
        title: 'Syslog Test',
        message: result.status === 'sent'
          ? result.message || 'Test message sent'
          : `Error: ${result.detail}`,
        color: result.status === 'sent' ? 'green' : 'red',
      });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Configure syslog host and save first', color: 'orange' });
    },
  });

  if (isLoading) {
    return <Text>Loading SIEM configuration...</Text>;
  }

  return (
    <Stack>
      <Title order={1}>SIEM Settings</Title>
      <Text c="dimmed">
        Configure real-time security event forwarding to your SIEM/SOAR platform.
      </Text>

      <Tabs defaultValue="webhook">
        <Tabs.List>
          <Tabs.Tab value="webhook" leftSection={<IconWebhook size={16} />}>Webhook</Tabs.Tab>
          <Tabs.Tab value="syslog" leftSection={<IconServer size={16} />}>Syslog</Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>Settings</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="webhook" pt="md">
          <Paper withBorder p="md">
            <Stack>
              <Title order={4}>Webhook Configuration</Title>
              <Text size="sm" c="dimmed">
                Events will be sent as HMAC-SHA256 signed POST requests to your endpoint.
                The signature is in the X-LexNebulis-Signature header.
              </Text>
              <TextInput
                label="Webhook URL"
                placeholder="https://your-siem.example.com/api/events"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.currentTarget.value)}
              />
              <TextInput
                label="Webhook Secret"
                type="password"
                placeholder={config?.webhook_secret_masked ? `Current: ${config.webhook_secret_masked}` : 'Enter a shared secret for HMAC signing'}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.currentTarget.value)}
                description="Leave blank to keep existing secret. Used for HMAC-SHA256 signature verification."
              />
              <Group>
                <Button
                  variant="outline"
                  onClick={() => testWebhookMutation.mutate()}
                  loading={testWebhookMutation.isPending}
                  disabled={!webhookUrl && !config?.webhook_url}
                >
                  Test Webhook
                </Button>
              </Group>
              {testWebhookMutation.data && (
                <Alert
                  color={(testWebhookMutation.data.data as { status: string }).status === 'sent' ? 'green' : 'red'}
                  icon={(testWebhookMutation.data.data as { status: string }).status === 'sent' ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
                >
                  {(testWebhookMutation.data.data as { status: string }).status === 'sent'
                    ? `Webhook responded with HTTP ${(testWebhookMutation.data.data as { response_status: number }).response_status}`
                    : `Error: ${(testWebhookMutation.data.data as { detail: string }).detail}`
                  }
                </Alert>
              )}
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="syslog" pt="md">
          <Paper withBorder p="md">
            <Stack>
              <Title order={4}>Syslog Configuration</Title>
              <Text size="sm" c="dimmed">
                Forward events via RFC 5424 syslog to your SIEM collector.
              </Text>
              <TextInput
                label="Syslog Host"
                placeholder="siem.example.com"
                value={syslogHost}
                onChange={(e) => setSyslogHost(e.currentTarget.value)}
              />
              <TextInput
                label="Syslog Port"
                placeholder="514"
                value={syslogPort}
                onChange={(e) => setSyslogPort(e.currentTarget.value)}
              />
              <Select
                label="Protocol"
                data={[
                  { value: 'udp', label: 'UDP' },
                  { value: 'tcp', label: 'TCP' },
                  { value: 'tls', label: 'TLS (Encrypted)' },
                ]}
                value={syslogProtocol}
                onChange={(v) => setSyslogProtocol(v || 'udp')}
              />
              {syslogProtocol === 'tls' && (
                <Textarea
                  label="TLS CA Certificate (PEM)"
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  minRows={4}
                  value={syslogTlsCaCert}
                  onChange={(e) => setSyslogTlsCaCert(e.currentTarget.value)}
                  description="Paste the CA certificate in PEM format for TLS verification."
                />
              )}
              <Group>
                <Button
                  variant="outline"
                  onClick={() => testSyslogMutation.mutate()}
                  loading={testSyslogMutation.isPending}
                  disabled={!syslogHost && !config?.syslog_host}
                >
                  Test Syslog
                </Button>
              </Group>
              {testSyslogMutation.data && (
                <Alert
                  color={(testSyslogMutation.data.data as { status: string }).status === 'sent' ? 'green' : 'red'}
                  icon={(testSyslogMutation.data.data as { status: string }).status === 'sent' ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
                >
                  {(testSyslogMutation.data.data as { status: string }).status === 'sent'
                    ? (testSyslogMutation.data.data as { message: string }).message
                    : `Error: ${(testSyslogMutation.data.data as { detail: string }).detail}`
                  }
                </Alert>
              )}
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="settings" pt="md">
          <Paper withBorder p="md">
            <Stack>
              <Title order={4}>Real-Time Forwarding</Title>
              <Text size="sm" c="dimmed">
                When enabled, every audit log entry is automatically forwarded to configured destinations in real-time via Celery background tasks.
              </Text>
              <Switch
                label="Enable real-time event forwarding"
                description="Automatically push audit events to webhook and/or syslog as they occur"
                checked={realtimeEnabled}
                onChange={(e) => setRealtimeEnabled(e.currentTarget.checked)}
                size="md"
              />
              <Select
                label="Event Format"
                description="Format used for real-time event delivery"
                data={[
                  { value: 'json', label: 'JSON (Splunk / Elastic)' },
                  { value: 'cef', label: 'CEF (ArcSight / QRadar)' },
                  { value: 'syslog', label: 'Syslog (RFC 5424)' },
                ]}
                value={realtimeFormat}
                onChange={(v) => setRealtimeFormat(v || 'json')}
              />
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      <Group>
        <Button
          size="md"
          onClick={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
        >
          Save Configuration
        </Button>
      </Group>
    </Stack>
  );
}
