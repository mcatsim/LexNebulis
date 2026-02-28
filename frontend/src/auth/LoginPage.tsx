import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Anchor, Button, Card, Center, PinInput, Stack, Text, TextInput, Title, PasswordInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconScale, IconShieldLock } from '@tabler/icons-react';
import { authApi } from '../api/services';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [requires2fa, setRequires2fa] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 8 ? null : 'Password must be at least 8 characters'),
    },
  });

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const { data } = await authApi.login(values.email, values.password);

      if (data.requires_2fa && data.temp_token) {
        setRequires2fa(true);
        setTempToken(data.temp_token);
        setLoading(false);
        return;
      }

      if (data.access_token && data.refresh_token) {
        setTokens(data.access_token, data.refresh_token);
        const { data: user } = await authApi.me();
        setUser(user);
        navigate('/');
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
        setTokens(data.access_token, data.refresh_token);
        const { data: user } = await authApi.me();
        setUser(user);
        navigate('/');
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

  const handleBack = () => {
    setRequires2fa(false);
    setTempToken(null);
    setTwoFaCode('');
    setRecoveryCode('');
    setUseRecoveryCode(false);
  };

  if (requires2fa) {
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
      </Card>
    </Center>
  );
}
