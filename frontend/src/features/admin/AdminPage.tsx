import { useState } from 'react';
import {
  Button, Card, Grid, Group, Modal, Select, Stack, Table, Tabs, Text, TextInput, Title, Badge,
  ActionIcon, Tooltip, Code, Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconSettings, IconUsers, IconShieldLock, IconDownload, IconCheck, IconAlertTriangle,
} from '@tabler/icons-react';
import { authApi, adminApi } from '../../api/services';
import { useAuthStore } from '../../stores/authStore';
import type { User } from '../../types';

export default function AdminPage() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [userModalOpen, setUserModalOpen] = useState(false);

  // Users
  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => authApi.listUsers(1, 100),
  });

  const createUserForm = useForm({
    initialValues: { email: '', password: '', first_name: '', last_name: '', role: 'attorney' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 8 ? null : 'Min 8 characters'),
      first_name: (v) => (v.length > 0 ? null : 'Required'),
      last_name: (v) => (v.length > 0 ? null : 'Required'),
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: typeof createUserForm.values) => authApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setUserModalOpen(false);
      createUserForm.reset();
      notifications.show({ title: 'User created', message: 'New user account has been created', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create user', color: 'red' });
    },
  });

  // Settings
  const { data: settingsData } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.listSettings(),
  });

  const [settingKey, setSettingKey] = useState('');
  const [settingValue, setSettingValue] = useState('');

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => adminApi.updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      setSettingKey('');
      setSettingValue('');
      notifications.show({ title: 'Setting updated', message: 'System setting has been saved', color: 'green' });
    },
  });

  // Audit chain verification
  const verifyMutation = useMutation({
    mutationFn: () => adminApi.verifyAuditChain(5000),
  });

  const users = (usersData?.data?.items || []) as User[];
  const settings = (settingsData?.data || []) as { key: string; value: string; updated_at: string }[];

  return (
    <Stack>
      <Title order={2}>Administration</Title>

      <Tabs defaultValue="users">
        <Tabs.List>
          <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>Users</Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>Settings</Tabs.Tab>
          <Tabs.Tab value="security" leftSection={<IconShieldLock size={16} />}>Security & SIEM</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="users" pt="md">
          <Group justify="space-between" mb="md">
            <Text fw={500}>User Accounts</Text>
            <Button onClick={() => setUserModalOpen(true)}>Create User</Button>
          </Group>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Created</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((u) => (
                <Table.Tr key={u.id}>
                  <Table.Td>{u.first_name} {u.last_name}</Table.Td>
                  <Table.Td>{u.email}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={
                      u.role === 'admin' ? 'red' : u.role === 'attorney' ? 'blue' : u.role === 'paralegal' ? 'green' : 'orange'
                    }>
                      {u.role}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={u.is_active ? 'green' : 'gray'} variant="dot">
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{new Date(u.created_at).toLocaleDateString()}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel value="settings" pt="md">
          <Stack>
            <Card withBorder>
              <Title order={5} mb="sm">System Settings</Title>
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Key</Table.Th>
                    <Table.Th>Value</Table.Th>
                    <Table.Th>Updated</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {settings.map((s) => (
                    <Table.Tr key={s.key}>
                      <Table.Td><Code>{s.key}</Code></Table.Td>
                      <Table.Td>{s.value}</Table.Td>
                      <Table.Td>{new Date(s.updated_at).toLocaleDateString()}</Table.Td>
                    </Table.Tr>
                  ))}
                  {settings.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={3}><Text c="dimmed" ta="center">No settings configured</Text></Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Card>

            <Card withBorder>
              <Title order={5} mb="sm">Add/Update Setting</Title>
              <Group>
                <TextInput placeholder="Key (e.g. firm_name)" value={settingKey} onChange={(e) => setSettingKey(e.currentTarget.value)} />
                <TextInput placeholder="Value" value={settingValue} onChange={(e) => setSettingValue(e.currentTarget.value)} style={{ flex: 1 }} />
                <Button
                  onClick={() => updateSettingMutation.mutate({ key: settingKey, value: settingValue })}
                  disabled={!settingKey || !settingValue}
                  loading={updateSettingMutation.isPending}
                >
                  Save
                </Button>
              </Group>
            </Card>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="security" pt="md">
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card withBorder>
                <Title order={5} mb="sm">Audit Chain Integrity</Title>
                <Text size="sm" c="dimmed" mb="md">
                  Verify that the audit log hash chain has not been tampered with.
                  Each entry is linked to the previous via SHA-256 hash.
                </Text>
                <Button
                  onClick={() => verifyMutation.mutate()}
                  loading={verifyMutation.isPending}
                  leftSection={<IconShieldLock size={16} />}
                >
                  Verify Chain
                </Button>
                {verifyMutation.data && (
                  <Alert
                    mt="md"
                    color={verifyMutation.data.data.status === 'valid' ? 'green' : 'red'}
                    icon={verifyMutation.data.data.status === 'valid' ? <IconCheck /> : <IconAlertTriangle />}
                    title={verifyMutation.data.data.status === 'valid' ? 'Chain Valid' : 'Chain Invalid'}
                  >
                    Verified {verifyMutation.data.data.verified} entries.
                    {verifyMutation.data.data.errors?.length > 0 && (
                      <Text size="sm" mt="xs">
                        {verifyMutation.data.data.errors.length} error(s) found. Possible tampering detected.
                      </Text>
                    )}
                  </Alert>
                )}
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card withBorder>
                <Title order={5} mb="sm">SIEM/SOAR Export</Title>
                <Text size="sm" c="dimmed" mb="md">
                  Export audit logs in standard formats for SIEM ingestion.
                </Text>
                <Stack gap="xs">
                  <Button
                    variant="light"
                    leftSection={<IconDownload size={16} />}
                    onClick={() => {
                      adminApi.exportAuditJSON({}).then(({ data }) => {
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'lexnebulis-audit.json'; a.click();
                        URL.revokeObjectURL(url);
                      });
                    }}
                  >
                    Export JSON (Splunk / Elastic)
                  </Button>
                  <Button
                    variant="light"
                    leftSection={<IconDownload size={16} />}
                    onClick={() => {
                      adminApi.exportAuditCEF({}).then(({ data }) => {
                        const url = URL.createObjectURL(data);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'lexnebulis-audit-cef.log'; a.click();
                        URL.revokeObjectURL(url);
                      });
                    }}
                  >
                    Export CEF (ArcSight / QRadar)
                  </Button>
                  <Button
                    variant="light"
                    leftSection={<IconDownload size={16} />}
                    onClick={() => {
                      adminApi.exportAuditSyslog({}).then(({ data }) => {
                        const url = URL.createObjectURL(data);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'lexnebulis-audit-syslog.log'; a.click();
                        URL.revokeObjectURL(url);
                      });
                    }}
                  >
                    Export Syslog (RFC 5424)
                  </Button>
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={12}>
              <Card withBorder>
                <Title order={5} mb="sm">SOAR Webhook</Title>
                <Text size="sm" c="dimmed" mb="md">
                  Configure a webhook URL in system settings (key: <Code>siem_webhook_url</Code>) to push real-time events to your SOAR platform.
                </Text>
                <Button
                  variant="outline"
                  onClick={() => {
                    adminApi.testWebhook().then(({ data }) => {
                      notifications.show({
                        title: 'Webhook Test',
                        message: data.status === 'sent' ? `Sent successfully (HTTP ${data.response_status})` : `Error: ${data.detail}`,
                        color: data.status === 'sent' ? 'green' : 'red',
                      });
                    }).catch(() => {
                      notifications.show({ title: 'Error', message: 'Configure siem_webhook_url in settings first', color: 'orange' });
                    });
                  }}
                >
                  Test Webhook
                </Button>
              </Card>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>
      </Tabs>

      {/* Create User Modal */}
      <Modal opened={userModalOpen} onClose={() => setUserModalOpen(false)} title="Create User">
        <form onSubmit={createUserForm.onSubmit((v) => createUserMutation.mutate(v))}>
          <Stack>
            <TextInput label="Email" required {...createUserForm.getInputProps('email')} />
            <TextInput label="Password" type="password" required {...createUserForm.getInputProps('password')} />
            <TextInput label="First Name" required {...createUserForm.getInputProps('first_name')} />
            <TextInput label="Last Name" required {...createUserForm.getInputProps('last_name')} />
            <Select
              label="Role"
              data={[
                { value: 'admin', label: 'Admin' },
                { value: 'attorney', label: 'Attorney' },
                { value: 'paralegal', label: 'Paralegal' },
                { value: 'billing_clerk', label: 'Billing Clerk' },
              ]}
              {...createUserForm.getInputProps('role')}
            />
            <Button type="submit" loading={createUserMutation.isPending}>Create User</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
