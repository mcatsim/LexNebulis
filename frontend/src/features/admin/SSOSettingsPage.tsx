import { useState } from 'react';
import {
  ActionIcon, Badge, Button, Card, Group, JsonInput, Modal, Select, Stack, Switch, Table, Text,
  TextInput, Title, Tooltip, PasswordInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconEdit, IconKey, IconPlug, IconTestPipe, IconTrash, IconWand } from '@tabler/icons-react';
import { ssoApi } from '../../api/services';
import type { SSOProvider } from '../../types';

interface ProviderFormValues {
  name: string;
  provider_type: string;
  client_id: string;
  client_secret: string;
  discovery_url: string;
  scopes: string;
  email_claim: string;
  name_claim: string;
  role_mapping_json: string;
  auto_create_users: boolean;
  default_role: string;
  saml_entity_id: string;
  saml_sso_url: string;
  saml_certificate: string;
}

const DEFAULT_FORM_VALUES: ProviderFormValues = {
  name: '',
  provider_type: 'oidc',
  client_id: '',
  client_secret: '',
  discovery_url: '',
  scopes: 'openid email profile',
  email_claim: 'email',
  name_claim: 'name',
  role_mapping_json: '',
  auto_create_users: true,
  default_role: 'paralegal',
  saml_entity_id: '',
  saml_sso_url: '',
  saml_certificate: '',
};

export default function SSOSettingsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<SSOProvider | null>(null);
  const queryClient = useQueryClient();

  const { data: providers, isLoading } = useQuery({
    queryKey: ['sso-providers'],
    queryFn: async () => {
      const { data } = await ssoApi.listProviders();
      return data;
    },
  });

  const form = useForm<ProviderFormValues>({
    initialValues: DEFAULT_FORM_VALUES,
    validate: {
      name: (v) => (v.length > 0 ? null : 'Name is required'),
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: ProviderFormValues) => {
      let roleMapping: Record<string, string> | undefined;
      if (values.role_mapping_json) {
        try {
          roleMapping = JSON.parse(values.role_mapping_json) as Record<string, string>;
        } catch {
          throw new Error('Invalid JSON in role mapping');
        }
      }
      return ssoApi.createProvider({
        name: values.name,
        provider_type: values.provider_type,
        client_id: values.client_id || undefined,
        client_secret: values.client_secret || undefined,
        discovery_url: values.discovery_url || undefined,
        scopes: values.scopes || undefined,
        email_claim: values.email_claim || undefined,
        name_claim: values.name_claim || undefined,
        role_mapping: roleMapping,
        auto_create_users: values.auto_create_users,
        default_role: values.default_role || undefined,
        saml_entity_id: values.saml_entity_id || undefined,
        saml_sso_url: values.saml_sso_url || undefined,
        saml_certificate: values.saml_certificate || undefined,
      });
    },
    onSuccess: () => {
      notifications.show({ title: 'Success', message: 'SSO provider created', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['sso-providers'] });
      closeModal();
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ProviderFormValues }) => {
      let roleMapping: Record<string, string> | undefined;
      if (values.role_mapping_json) {
        try {
          roleMapping = JSON.parse(values.role_mapping_json) as Record<string, string>;
        } catch {
          throw new Error('Invalid JSON in role mapping');
        }
      }
      return ssoApi.updateProvider(id, {
        name: values.name,
        provider_type: values.provider_type,
        client_id: values.client_id || undefined,
        client_secret: values.client_secret || undefined,
        discovery_url: values.discovery_url || undefined,
        scopes: values.scopes || undefined,
        email_claim: values.email_claim || undefined,
        name_claim: values.name_claim || undefined,
        role_mapping: roleMapping,
        auto_create_users: values.auto_create_users,
        default_role: values.default_role || undefined,
        saml_entity_id: values.saml_entity_id || undefined,
        saml_sso_url: values.saml_sso_url || undefined,
        saml_certificate: values.saml_certificate || undefined,
      });
    },
    onSuccess: () => {
      notifications.show({ title: 'Success', message: 'SSO provider updated', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['sso-providers'] });
      closeModal();
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ssoApi.deleteProvider(id),
    onSuccess: () => {
      notifications.show({ title: 'Deleted', message: 'SSO provider deleted', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['sso-providers'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      ssoApi.updateProvider(id, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-providers'] });
    },
  });

  const discoverMutation = useMutation({
    mutationFn: (id: string) => ssoApi.discoverEndpoints(id),
    onSuccess: () => {
      notifications.show({ title: 'Success', message: 'OIDC endpoints discovered', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['sso-providers'] });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to discover endpoints', color: 'red' });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => ssoApi.testConnection(id),
    onSuccess: (resp) => {
      const result = resp.data;
      const color = result.status === 'ok' ? 'green' : result.status === 'warning' ? 'yellow' : 'red';
      notifications.show({ title: 'Connection Test', message: result.message, color });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Connection test failed', color: 'red' });
    },
  });

  const openCreateModal = () => {
    setEditingProvider(null);
    form.reset();
    setModalOpen(true);
  };

  const openEditModal = (provider: SSOProvider) => {
    setEditingProvider(provider);
    form.setValues({
      name: provider.name,
      provider_type: provider.provider_type,
      client_id: provider.client_id || '',
      client_secret: '',
      discovery_url: provider.discovery_url || '',
      scopes: provider.scopes || 'openid email profile',
      email_claim: provider.email_claim || 'email',
      name_claim: provider.name_claim || 'name',
      role_mapping_json: provider.role_mapping ? JSON.stringify(provider.role_mapping, null, 2) : '',
      auto_create_users: provider.auto_create_users,
      default_role: provider.default_role || 'paralegal',
      saml_entity_id: provider.saml_entity_id || '',
      saml_sso_url: provider.saml_sso_url || '',
      saml_certificate: provider.saml_certificate || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProvider(null);
    form.reset();
  };

  const handleSubmit = (values: ProviderFormValues) => {
    if (editingProvider) {
      updateMutation.mutate({ id: editingProvider.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <IconKey size={28} />
          <Title order={2}>SSO Configuration</Title>
        </Group>
        <Button leftSection={<IconPlug size={16} />} onClick={openCreateModal}>
          Add Provider
        </Button>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Active</Table.Th>
              <Table.Th>Default</Table.Th>
              <Table.Th>Client ID</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed">Loading...</Text>
                </Table.Td>
              </Table.Tr>
            )}
            {providers && providers.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed">No SSO providers configured</Text>
                </Table.Td>
              </Table.Tr>
            )}
            {providers?.map((provider) => (
              <Table.Tr key={provider.id}>
                <Table.Td>{provider.name}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={provider.provider_type === 'oidc' ? 'blue' : 'grape'}>
                    {provider.provider_type.toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={provider.is_active}
                    onChange={(e) =>
                      toggleActiveMutation.mutate({
                        id: provider.id,
                        isActive: e.currentTarget.checked,
                      })
                    }
                  />
                </Table.Td>
                <Table.Td>
                  {provider.is_default && <Badge color="green">Default</Badge>}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" truncate style={{ maxWidth: 200 }}>
                    {provider.client_id || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label="Edit">
                      <ActionIcon variant="subtle" onClick={() => openEditModal(provider)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Auto-Discover Endpoints">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        loading={discoverMutation.isPending}
                        onClick={() => discoverMutation.mutate(provider.id)}
                      >
                        <IconWand size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Test Connection">
                      <ActionIcon
                        variant="subtle"
                        color="teal"
                        loading={testMutation.isPending}
                        onClick={() => testMutation.mutate(provider.id)}
                      >
                        <IconTestPipe size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete">
                      <ActionIcon variant="subtle" color="red" onClick={() => deleteMutation.mutate(provider.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={editingProvider ? 'Edit SSO Provider' : 'Add SSO Provider'}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput label="Name" placeholder="e.g., Azure AD, Okta" required {...form.getInputProps('name')} />
            <Select
              label="Type"
              data={[
                { value: 'oidc', label: 'OIDC (OpenID Connect)' },
                { value: 'saml', label: 'SAML (metadata only)' },
              ]}
              {...form.getInputProps('provider_type')}
            />
            <TextInput
              label="Discovery URL"
              placeholder="https://accounts.google.com/.well-known/openid-configuration"
              {...form.getInputProps('discovery_url')}
            />
            <TextInput label="Client ID" placeholder="Your OIDC client ID" {...form.getInputProps('client_id')} />
            <PasswordInput
              label="Client Secret"
              placeholder={editingProvider ? 'Leave blank to keep current' : 'Your OIDC client secret'}
              {...form.getInputProps('client_secret')}
            />
            <TextInput
              label="Scopes"
              placeholder="openid email profile"
              {...form.getInputProps('scopes')}
            />
            <Group grow>
              <TextInput label="Email Claim" placeholder="email" {...form.getInputProps('email_claim')} />
              <TextInput label="Name Claim" placeholder="name" {...form.getInputProps('name_claim')} />
            </Group>
            <JsonInput
              label="Role Mapping (JSON)"
              placeholder='{"Admins": "admin", "Attorneys": "attorney"}'
              formatOnBlur
              autosize
              minRows={2}
              maxRows={6}
              {...form.getInputProps('role_mapping_json')}
            />
            <Group grow>
              <Switch
                label="Auto-create users"
                description="Automatically create accounts for new SSO users"
                {...form.getInputProps('auto_create_users', { type: 'checkbox' })}
              />
              <Select
                label="Default Role"
                data={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'attorney', label: 'Attorney' },
                  { value: 'paralegal', label: 'Paralegal' },
                  { value: 'billing_clerk', label: 'Billing Clerk' },
                ]}
                {...form.getInputProps('default_role')}
              />
            </Group>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingProvider ? 'Update Provider' : 'Create Provider'}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
