import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Anchor, Button, Card, Center, Divider, PinInput, Stack, Text, TextInput, Title, PasswordInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import { IconFingerprint, IconKey, IconScale, IconShieldLock } from '@tabler/icons-react';
import { authApi, ssoApi } from '../api/services';
import { useAuthStore } from '../stores/authStore';

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

type MfaMethod = 'totp' | 'webauthn';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [requires2fa, setRequires2fa] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [mfaMethods, setMfaMethods] = useState<string[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<MfaMethod | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();

  const { data: ssoProviders } = useQuery({
    queryKey: ['sso-providers-public'],
    queryFn: async () => {
      const { data } = await ssoApi.listPublicProviders();
      return data;
    },
  });

  const handleSsoLogin = async (providerId: string) => {
    setSsoLoading(providerId);
    try {
      const { data } = await ssoApi.initiateLogin(providerId);
      window.location.href = data.redirect_url;
    } catch {
      notifications.show({
        title: 'SSO Error',
        message: 'Failed to initiate SSO login. Please try again.',
        color: 'red',
      });
      setSsoLoading(null);
    }
  };

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 8 ? null : 'Password must be at least 8 characters'),
    },
  });

  const completeLogin = async (accessToken: string, refreshToken: string) => {
    setTokens(accessToken, refreshToken);
    const { data: user } = await authApi.me();
    setUser(user);
    navigate('/');
  };

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const { data } = await authApi.login(values.email, values.password);

      if (data.requires_2fa && data.temp_token) {
        const methods = data.mfa_methods || ['totp'];
        setRequires2fa(true);
        setTempToken(data.temp_token);
        setMfaMethods(methods);

        // Auto-select if only one method available
        if (methods.length === 1) {
          setSelectedMethod(methods[0] as MfaMethod);
        }

        setLoading(false);
        return;
      }

      if (data.access_token && data.refresh_token) {
        await completeLogin(data.access_token, data.refresh_token);
      }
    } catch {
      notifications.show({
        title: 'Login failed',
        message: 'Invalid email or password',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit = async () => {
    if (!tempToken) return;
    const code = useRecoveryCode ? recoveryCode.trim() : twoFaCode.trim();
    if (!code) return;

    setLoading(true);
    try {
      const { data } = await authApi.verify2faLogin(tempToken, code);

      if (data.access_token && data.refresh_token) {
        await completeLogin(data.access_token, data.refresh_token);
      }
    } catch {
      notifications.show({
        title: 'Verification failed',
        message: useRecoveryCode
          ? 'Invalid recovery code'
          : 'Invalid verification code. Please try again.',
        color: 'red',
      });
      setTwoFaCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthnLogin = async () => {
    if (!tempToken) return;

    setLoading(true);
    try {
      // Step 1: Get challenge options from server
      const { data: beginData } = await authApi.webauthnAuthBegin(tempToken);
      const options = beginData.options;

      // Step 2: Convert options for navigator.credentials.get()
      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge: base64urlToBuffer(options.challenge as string),
        rpId: options.rpId as string,
        timeout: (options.timeout as number) || 60000,
        userVerification: (options.userVerification as UserVerificationRequirement) || 'preferred',
        allowCredentials: ((options.allowCredentials as Array<{ id: string; type: string; transports?: string[] }>) || []).map(
          (cred) => ({
            id: base64urlToBuffer(cred.id),
            type: cred.type as PublicKeyCredentialType,
            transports: cred.transports as AuthenticatorTransport[] | undefined,
          })
        ),
      };

      // Step 3: Prompt user for security key
      const assertion = (await navigator.credentials.get({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential;

      if (!assertion) {
        throw new Error('No credential returned');
      }

      const assertionResponse = assertion.response as AuthenticatorAssertionResponse;

      // Step 4: Send assertion to server
      const credentialData = {
        id: assertion.id,
        rawId: bufferToBase64url(assertion.rawId),
        type: assertion.type,
        response: {
          authenticatorData: bufferToBase64url(assertionResponse.authenticatorData),
          clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
          signature: bufferToBase64url(assertionResponse.signature),
          userHandle: assertionResponse.userHandle
            ? bufferToBase64url(assertionResponse.userHandle)
            : null,
        },
      };

      const { data } = await authApi.webauthnAuthComplete({
        temp_token: tempToken,
        credential: credentialData,
      });

      if (data.access_token && data.refresh_token) {
        await completeLogin(data.access_token, data.refresh_token);
      }
    } catch {
      notifications.show({
        title: 'Security key verification failed',
        message: 'Could not verify your security key. Please try again.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setRequires2fa(false);
    setTempToken(null);
    setTwoFaCode('');
    setRecoveryCode('');
    setUseRecoveryCode(false);
    setMfaMethods([]);
    setSelectedMethod(null);
  };

  const handleBackToMethodPicker = () => {
    setSelectedMethod(null);
    setTwoFaCode('');
    setRecoveryCode('');
    setUseRecoveryCode(false);
  };

  if (requires2fa) {
    // Method picker when multiple methods available and none selected
    if (mfaMethods.length > 1 && selectedMethod === null) {
      return (
        <Center h="100vh" bg="gray.0">
          <Card shadow="md" padding="xl" radius="md" w={400}>
            <Stack align="center" gap="xs" mb="lg">
              <IconShieldLock size={48} color="var(--mantine-color-blue-6)" />
              <Title order={2}>Two-Factor Authentication</Title>
              <Text c="dimmed" size="sm" ta="center">
                Choose your verification method
              </Text>
            </Stack>

            <Stack>
              {mfaMethods.includes('totp') && (
                <Button
                  fullWidth
                  variant="outline"
                  leftSection={<IconShieldLock size={20} />}
                  onClick={() => setSelectedMethod('totp')}
                >
                  TOTP Code
                </Button>
              )}
              {mfaMethods.includes('webauthn') && (
                <Button
                  fullWidth
                  variant="outline"
                  leftSection={<IconFingerprint size={20} />}
                  onClick={() => setSelectedMethod('webauthn')}
                >
                  Security Key
                </Button>
              )}

              <Stack align="center" gap="xs">
                <Anchor size="sm" component="button" type="button" onClick={handleBack}>
                  Back to login
                </Anchor>
              </Stack>
            </Stack>
          </Card>
        </Center>
      );
    }

    // WebAuthn flow
    if (selectedMethod === 'webauthn') {
      return (
        <Center h="100vh" bg="gray.0">
          <Card shadow="md" padding="xl" radius="md" w={400}>
            <Stack align="center" gap="xs" mb="lg">
              <IconFingerprint size={48} color="var(--mantine-color-blue-6)" />
              <Title order={2}>Security Key</Title>
              <Text c="dimmed" size="sm" ta="center">
                Use your security key or biometric authenticator to verify your identity
              </Text>
            </Stack>

            <Stack>
              <Button
                fullWidth
                loading={loading}
                onClick={handleWebAuthnLogin}
                leftSection={<IconFingerprint size={20} />}
              >
                Verify with Security Key
              </Button>

              <Stack align="center" gap="xs">
                {mfaMethods.length > 1 && (
                  <Anchor size="sm" component="button" type="button" onClick={handleBackToMethodPicker}>
                    Use a different method
                  </Anchor>
                )}
                <Anchor size="sm" component="button" type="button" onClick={handleBack}>
                  Back to login
                </Anchor>
              </Stack>
            </Stack>
          </Card>
        </Center>
      );
    }

    // TOTP flow (existing)
    return (
      <Center h="100vh" bg="gray.0">
        <Card shadow="md" padding="xl" radius="md" w={400}>
          <Stack align="center" gap="xs" mb="lg">
            <IconShieldLock size={48} color="var(--mantine-color-blue-6)" />
            <Title order={2}>Two-Factor Authentication</Title>
            <Text c="dimmed" size="sm" ta="center">
              {useRecoveryCode
                ? 'Enter one of your recovery codes'
                : 'Enter the 6-digit code from your authenticator app'}
            </Text>
          </Stack>

          <Stack>
            {useRecoveryCode ? (
              <TextInput
                label="Recovery Code"
                placeholder="Enter recovery code"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.currentTarget.value)}
                styles={{ input: { textAlign: 'center', fontFamily: 'monospace', fontSize: '1.1rem' } }}
              />
            ) : (
              <Stack align="center">
                <Text size="sm" fw={500}>Verification Code</Text>
                <PinInput
                  length={6}
                  type="number"
                  value={twoFaCode}
                  onChange={setTwoFaCode}
                  oneTimeCode
                  autoFocus
                  size="lg"
                />
              </Stack>
            )}

            <Button
              fullWidth
              loading={loading}
              onClick={handle2faSubmit}
              disabled={useRecoveryCode ? !recoveryCode.trim() : twoFaCode.length < 6}
            >
              Verify
            </Button>

            <Stack align="center" gap="xs">
              <Anchor
                size="sm"
                component="button"
                type="button"
                onClick={() => {
                  setUseRecoveryCode(!useRecoveryCode);
                  setTwoFaCode('');
                  setRecoveryCode('');
                }}
              >
                {useRecoveryCode ? 'Use authenticator app instead' : 'Use a recovery code instead'}
              </Anchor>
              {mfaMethods.length > 1 && (
                <Anchor size="sm" component="button" type="button" onClick={handleBackToMethodPicker}>
                  Use a different method
                </Anchor>
              )}
              <Anchor size="sm" component="button" type="button" onClick={handleBack}>
                Back to login
              </Anchor>
            </Stack>
          </Stack>
        </Card>
      </Center>
    );
  }

  return (
    <Center h="100vh" bg="gray.0">
      <Card shadow="md" padding="xl" radius="md" w={400}>
        <Stack align="center" gap="xs" mb="lg">
          <IconScale size={48} color="var(--mantine-color-blue-6)" />
          <Title order={2}>LexNebulis</Title>
          <Text c="dimmed" size="sm">Legal Practice Management</Text>
        </Stack>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="admin@example.com"
              required
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              required
              {...form.getInputProps('password')}
            />
            <Button type="submit" fullWidth loading={loading}>
              Sign in
            </Button>
          </Stack>
        </form>

        {ssoProviders && ssoProviders.length > 0 && (
          <>
            <Divider my="md" label="or" labelPosition="center" />
            <Stack gap="xs">
              {ssoProviders.map((provider) => (
                <Button
                  key={provider.id}
                  variant="outline"
                  fullWidth
                  leftSection={<IconKey size={16} />}
                  loading={ssoLoading === provider.id}
                  onClick={() => handleSsoLogin(provider.id)}
                >
                  Sign in with {provider.name}
                </Button>
              ))}
            </Stack>
          </>
        )}
      </Card>
    </Center>
  );
}
