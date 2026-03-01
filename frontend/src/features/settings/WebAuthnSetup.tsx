import { useState } from 'react';
import {
  ActionIcon, Badge, Button, Card, Group, Modal, Stack, Text, TextInput, Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconFingerprint, IconPlus, IconTrash } from '@tabler/icons-react';
import { authApi } from '../../api/services';
import type { WebAuthnCredential } from '../../types';

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function WebAuthnSetup() {
  const queryClient = useQueryClient();
  const [registering, setRegistering] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingCredential, setPendingCredential] = useState<Record<string, unknown> | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: credentialsData, isLoading } = useQuery({
    queryKey: ['webauthn-credentials'],
    queryFn: async () => {
      const { data } = await authApi.listWebauthnCredentials();
      return data;
    },
  });

  const credentials: WebAuthnCredential[] = credentialsData || [];

  const completeMutation = useMutation({
    mutationFn: (data: { credential: Record<string, unknown>; name: string }) =>
      authApi.webauthnRegisterComplete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webauthn-credentials'] });
      setShowNameModal(false);
      setPendingCredential(null);
      setKeyName('');
      notifications.show({
        title: 'Security Key Registered',
        message: 'Your security key has been registered successfully.',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Registration Failed',
        message: 'Could not register the security key. Please try again.',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authApi.deleteWebauthnCredential(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webauthn-credentials'] });
      setDeleteConfirmId(null);
      notifications.show({
        title: 'Security Key Removed',
        message: 'The security key has been removed from your account.',
        color: 'orange',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Could not remove the security key.',
        color: 'red',
      });
    },
  });

  const handleRegisterBegin = async () => {
    setRegistering(true);
    try {
      const { data: beginData } = await authApi.webauthnRegisterBegin();
      const options = beginData.options;

      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge: base64urlToBuffer(options.challenge as string),
        rp: options.rp as PublicKeyCredentialRpEntity,
        user: {
          id: base64urlToBuffer((options.user as { id: string; name: string; displayName: string }).id),
          name: (options.user as { id: string; name: string; displayName: string }).name,
          displayName: (options.user as { id: string; name: string; displayName: string }).displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams as PublicKeyCredentialParameters[],
        timeout: (options.timeout as number) || 60000,
        attestation: (options.attestation as AttestationConveyancePreference) || 'none',
        authenticatorSelection: options.authenticatorSelection as AuthenticatorSelectionCriteria | undefined,
        excludeCredentials: (
          (options.excludeCredentials as Array<{ id: string; type: string; transports?: string[] }>) || []
        ).map((cred) => ({
          id: base64urlToBuffer(cred.id),
          type: cred.type as PublicKeyCredentialType,
          transports: cred.transports as AuthenticatorTransport[] | undefined,
        })),
      };

      const attestation = (await navigator.credentials.create({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential;

      if (!attestation) {
        throw new Error('No credential created');
      }

      const attestationResponse = attestation.response as AuthenticatorAttestationResponse;

      const credentialData: Record<string, unknown> = {
        id: attestation.id,
        rawId: bufferToBase64url(attestation.rawId),
        type: attestation.type,
        response: {
          attestationObject: bufferToBase64url(attestationResponse.attestationObject),
          clientDataJSON: bufferToBase64url(attestationResponse.clientDataJSON),
          transports: attestationResponse.getTransports ? attestationResponse.getTransports() : [],
        },
      };

      setPendingCredential(credentialData);
      setShowNameModal(true);
    } catch {
      notifications.show({
        title: 'Registration Failed',
        message: 'Could not create security key credential. Please try again.',
        color: 'red',
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleCompleteRegistration = () => {
    if (!pendingCredential || !keyName.trim()) return;
    completeMutation.mutate({
      credential: pendingCredential,
      name: keyName.trim(),
    });
  };

  if (isLoading) {
    return null;
  }

  return (
    <>
      <Card withBorder>
        <Group justify="space-between" mb="md">
          <Group>
            <IconFingerprint size={24} />
            <Title order={5}>Security Keys (WebAuthn/FIDO2)</Title>
          </Group>
          {credentials.length > 0 && (
            <Badge color="green" variant="filled">
              {credentials.length} registered
            </Badge>
          )}
        </Group>

        {credentials.length === 0 ? (
          <Text size="sm" c="dimmed" mb="md">
            No security keys registered. Add a security key or biometric authenticator
            for passwordless two-factor authentication.
          </Text>
        ) : (
          <Stack gap="xs" mb="md">
            {credentials.map((cred) => (
              <Group key={cred.id} justify="space-between" p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-sm)' }}>
                <Group>
                  <IconFingerprint size={18} color="var(--mantine-color-blue-6)" />
                  <div>
                    <Text size="sm" fw={500}>{cred.name}</Text>
                    <Text size="xs" c="dimmed">
                      Added {new Date(cred.created_at).toLocaleDateString()}
                      {cred.transports && cred.transports.length > 0 && (
                        <> &middot; {cred.transports.join(', ')}</>
                      )}
                    </Text>
                  </div>
                </Group>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={() => setDeleteConfirmId(cred.id)}
                  title="Remove security key"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        )}

        <Button
          leftSection={<IconPlus size={16} />}
          onClick={handleRegisterBegin}
          loading={registering}
        >
          Register New Key
        </Button>
      </Card>

      {/* Name prompt modal */}
      <Modal
        opened={showNameModal}
        onClose={() => { setShowNameModal(false); setPendingCredential(null); setKeyName(''); }}
        title="Name Your Security Key"
        centered
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Give your security key a name to help you identify it later.
          </Text>
          <TextInput
            label="Key Name"
            placeholder='e.g., "YubiKey 5" or "Touch ID"'
            value={keyName}
            onChange={(e) => setKeyName(e.currentTarget.value)}
            autoFocus
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => { setShowNameModal(false); setPendingCredential(null); setKeyName(''); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCompleteRegistration}
              loading={completeMutation.isPending}
              disabled={!keyName.trim()}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        opened={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Remove Security Key"
        centered
      >
        <Stack>
          <Text size="sm">
            Are you sure you want to remove this security key? You will no longer be able
            to use it for two-factor authentication.
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
              Remove
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
