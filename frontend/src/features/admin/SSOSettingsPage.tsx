import { useState } from 'react';
import {
  ActionIcon, Badge, Button, Card, Group, JsonInput, Modal, Select, Stack, Switch, Table, Text,
  Textarea, TextInput, Title, Tooltip, PasswordInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconDownload, IconEdit, IconKey, IconPlug, IconTestPipe, IconTrash, IconWand } from '@tabler/icons-react';
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
  saml_sp_entity_id: string;
  saml_idp_metadata_url: string;
  saml_idp_metadata_xml: string;
  saml_name_id_format: string;
  saml_sign_requests: boolean;
  saml_sp_certificate: string;
  saml_sp_private_key: string;
  saml_attribute_mapping_json: string;
  saml_want_assertions_signed: boolean;
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
  saml_sp_entity_id: '',
  saml_idp_metadata_url: '',
  saml_idp_metadata_xml: '',
  saml_name_id_format: 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
  saml_sign_requests: false,
  saml_sp_certificate: '',
  saml_sp_private_key: '',
  saml_attribute_mapping_json: '',
  saml_want_assertions_signed: true,
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
      let attributeMapping: Record<string, string> | undefined;
      if (values.saml_attribute_mapping_json) {
        try {
          attributeMapping = JSON.parse(values.saml_attribute_mapping_json) as Record<string, string>;
        } catch {
          throw new Error('Invalid JSON in attribute mapping');
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
        saml_sp_entity_id: values.saml_sp_entity_id || undefined,
        saml_idp_metadata_url: values.saml_idp_metadata_url || undefined,
        saml_idp_metadata_xml: values.saml_idp_metadata_xml || undefined,
        saml_name_id_format: values.saml_name_id_format || undefined,
        saml_sign_requests: values.saml_sign_requests,
        saml_sp_certificate: values.saml_sp_certificate || undefined,
        saml_sp_private_key: values.saml_sp_private_key || undefined,
        saml_attribute_mapping: attributeMapping,
        saml_want_assertions_signed: values.saml_want_assertions_signed,
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
      let attributeMapping: Record<string, string> | undefined;
      if (values.saml_attribute_mapping_json) {
        try {
          attributeMapping = JSON.parse(values.saml_attribute_mapping_json) as Record<string, string>;
        } catch {
          throw new Error('Invalid JSON in attribute mapping');
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
        saml_sp_entity_id: values.saml_sp_entity_id || undefined,
        saml_idp_metadata_url: values.saml_idp_metadata_url || undefined,
        saml_idp_metadata_xml: values.saml_idp_metadata_xml || undefined,
        saml_name_id_format: values.saml_name_id_format || undefined,
        saml_sign_requests: values.saml_sign_requests,
        saml_sp_certificate: values.saml_sp_certificate || undefined,
        saml_sp_private_key: values.saml_sp_private_key || undefined,
        saml_attribute_mapping: attributeMapping,
        saml_want_assertions_signed: values.saml_want_assertions_signed,
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
      saml_sp_entity_id: provider.saml_sp_entity_id || '',
      saml_idp_metadata_url: provider.saml_idp_metadata_url || '',
      saml_idp_metadata_xml: provider.saml_idp_metadata_xml || '',
      saml_name_id_format: provider.saml_name_id_format || 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
      saml_sign_requests: provider.saml_sign_requests || false,
      saml_sp_certificate: provider.saml_sp_certificate || '',
      saml_sp_private_key: '',
      saml_attribute_mapping_json: provider.saml_attribute_mapping ? JSON.stringify(provider.saml_attribute_mapping, null, 2) : '',
      saml_want_assertions_signed: provider.saml_want_assertions_signed !== false,
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
          <Title order={1}>SSO Configuration</Title>
        </Group>
        <Button leftSection={<IconPlug size={16} />} onClick={openCreateModal}>
          Add Provider
        </Button>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col">Name</Table.Th>
              <Table.Th scope="col">Type</Table.Th>
              <Table.Th scope="col">Active</Table.Th>
              <Table.Th scope="col">Default</Table.Th>
              <Table.Th scope="col">Client ID</Table.Th>
              <Table.Th scope="col">Actions</Table.Th>
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
                      <ActionIcon variant="subtle" aria-label="Edit provider" onClick={() => openEditModal(provider)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Auto-Discover Endpoints">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        aria-label="Auto-discover endpoints"
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
                        aria-label="Test connection"
                        loading={testMutation.isPending}
                        onClick={() => testMutation.mutate(provider.id)}
                      >
                        <IconTestPipe size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete">
                      <ActionIcon variant="subtle" color="red" aria-label="Delete provider" onClick={() => deleteMutation.mutate(provider.id)}>
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
                { value: 'saml', label: 'SAML 2.0' },
              ]}
              {...form.getInputProps('provider_type')}
            />

            {form.values.provider_type === 'oidc' && (
              <>
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
              </>
            )}

            {form.values.provider_type === 'saml' && (
              <>
                <TextInput
                  label="IdP Metadata URL"
                  placeholder="https://idp.example.com/metadata"
                  description="URL to fetch IdP metadata XML automatically"
                  {...form.getInputProps('saml_idp_metadata_url')}
                />
                <Textarea
                  label="IdP Metadata XML"
                  placeholder="Paste IdP metadata XML here (alternative to URL)"
                  autosize
                  minRows={3}
                  maxRows={8}
                  {...form.getInputProps('saml_idp_metadata_xml')}
                />
                <TextInput
                  label="IdP Entity ID"
                  placeholder="https://idp.example.com/entity"
                  description="Required if not using metadata URL/XML"
                  {...form.getInputProps('saml_entity_id')}
                />
                <TextInput
                  label="IdP SSO URL"
                  placeholder="https://idp.example.com/sso"
                  description="Required if not using metadata URL/XML"
                  {...form.getInputProps('saml_sso_url')}
                />
                <Textarea
                  label="IdP Certificate"
                  placeholder="IdP X.509 certificate (PEM format, without headers)"
                  autosize
                  minRows={2}
                  maxRows={6}
                  {...form.getInputProps('saml_certificate')}
                />
                <TextInput
                  label="SP Entity ID"
                  placeholder="https://yourapp.example.com/saml/metadata"
                  description="Leave blank to auto-generate"
                  {...form.getInputProps('saml_sp_entity_id')}
                />
                <TextInput
                  label="Name ID Format"
                  placeholder="urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress"
                  {...form.getInputProps('saml_name_id_format')}
                />
                <Group grow>
                  <Switch
                    label="Sign AuthnRequests"
                    description="Sign outgoing SAML requests with SP key"
                    {...form.getInputProps('saml_sign_requests', { type: 'checkbox' })}
                  />
                  <Switch
                    label="Want Assertions Signed"
                    description="Require IdP to sign SAML assertions"
                    {...form.getInputProps('saml_want_assertions_signed', { type: 'checkbox' })}
                  />
                </Group>
                <Textarea
                  label="SP Certificate"
                  placeholder="SP X.509 certificate (PEM format)"
                  autosize
                  minRows={2}
                  maxRows={6}
                  {...form.getInputProps('saml_sp_certificate')}
                />
                <Textarea
                  label="SP Private Key"
                  placeholder={editingProvider ? 'Leave blank to keep current' : 'SP private key (PEM format)'}
                  autosize
                  minRows={2}
                  maxRows={6}
                  {...form.getInputProps('saml_sp_private_key')}
                />
                <JsonInput
                  label="Attribute Mapping (JSON)"
                  placeholder='{"email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress", "name": "displayName", "groups": "memberOf"}'
                  description="Maps SAML attributes to email, name, and groups"
                  formatOnBlur
                  autosize
                  minRows={2}
                  maxRows={6}
                  {...form.getInputProps('saml_attribute_mapping_json')}
                />
                {editingProvider && (
                  <Button
                    variant="outline"
                    leftSection={<IconDownload size={16} />}
                    onClick={() => window.open(ssoApi.getSpMetadataUrl(editingProvider.id), '_blank')}
                  >
                    Download SP Metadata
                  </Button>
                )}
              </>
            )}

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
