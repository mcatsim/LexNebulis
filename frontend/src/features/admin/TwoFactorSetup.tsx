import { useState } from 'react';
import {
  Alert, Badge, Button, Card, Code, CopyButton, Group, Image, List, PinInput,
  Stack, Text, Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconCheck, IconCopy, IconShieldLock, IconShieldOff } from '@tabler/icons-react';
import { authApi } from '../../api/services';
import type { TwoFactorSetupResponse } from '../../types';

type SetupStep = 'idle' | 'qr' | 'recovery' | 'done';

export default function TwoFactorSetup() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<SetupStep>('idle');
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disableCode, setDisableCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['2fa-status'],
    queryFn: () => authApi.get2faStatus(),
  });

  const is2faEnabled = statusData?.data?.enabled ?? false;

  const setupMutation = useMutation({
    mutationFn: () => authApi.setup2fa(),
    onSuccess: ({ data }) => {
      setSetupData(data);
      setStep('qr');
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to initialize 2FA setup', color: 'red' });
    },
  });

  const verifySetupMutation = useMutation({
    mutationFn: (code: string) => authApi.verify2faSetup(code),
    onSuccess: ({ data }) => {
      setRecoveryCodes(data.recovery_codes);
      setStep('recovery');
      queryClient.invalidateQueries({ queryKey: ['2fa-status'] });
      notifications.show({ title: '2FA Enabled', message: 'Two-factor authentication is now active', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Verification failed', message: 'Invalid code. Please try again.', color: 'red' });
      setVerifyCode('');
    },
  });

  const disableMutation = useMutation({
    mutationFn: (code: string) => authApi.disable2fa(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['2fa-status'] });
      setShowDisable(false);
      setDisableCode('');
      setStep('idle');
      notifications.show({ title: '2FA Disabled', message: 'Two-factor authentication has been disabled', color: 'orange' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Invalid code. Could not disable 2FA.', color: 'red' });
      setDisableCode('');
    },
  });

  const handleVerifySetup = () => {
    if (verifyCode.length === 6) {
      verifySetupMutation.mutate(verifyCode);
    }
  };

  const handleDisable = () => {
    if (disableCode.length === 6) {
      disableMutation.mutate(disableCode);
    }
  };

  const handleFinish = () => {
    setStep('idle');
    setSetupData(null);
    setVerifyCode('');
    setRecoveryCodes([]);
  };

  if (statusLoading) {
    return null;
  }

  // Show disable form
  if (is2faEnabled && step === 'idle') {
    return (
      <Card withBorder>
        <Group justify="space-between" mb="md">
          <Group>
            <IconShieldLock size={24} />
            <Title order={5}>Two-Factor Authentication</Title>
          </Group>
          <Badge color="green" variant="filled">Enabled</Badge>
        </Group>

        <Text size="sm" c="dimmed" mb="md">
          Your account is protected with two-factor authentication.
          You will be asked for a verification code when logging in.
        </Text>

        {showDisable ? (
          <Stack>
            <Alert color="orange" title="Disable 2FA">
              Enter your current authenticator code to disable two-factor authentication.
              This will make your account less secure.
            </Alert>
            <Group justify="center">
              <PinInput
                length={6}
                type="number"
                value={disableCode}
                onChange={setDisableCode}
                size="md"
              />
            </Group>
            <Group>
              <Button
                color="red"
                onClick={handleDisable}
                loading={disableMutation.isPending}
                disabled={disableCode.length < 6}
                leftSection={<IconShieldOff size={16} />}
              >
                Disable 2FA
              </Button>
              <Button variant="default" onClick={() => { setShowDisable(false); setDisableCode(''); }}>
                Cancel
              </Button>
            </Group>
          </Stack>
        ) : (
          <Button
            variant="outline"
            color="red"
            onClick={() => setShowDisable(true)}
            leftSection={<IconShieldOff size={16} />}
          >
            Disable 2FA
          </Button>
        )}
      </Card>
    );
  }

  // QR code step
  if (step === 'qr' && setupData) {
    return (
      <Card withBorder>
        <Stack>
          <Group>
            <IconShieldLock size={24} />
            <Title order={5}>Set Up Two-Factor Authentication</Title>
          </Group>

          <Text size="sm">
            Scan the QR code below with your authenticator app (Google Authenticator, Authy, 1Password, etc.):
          </Text>

          <Stack align="center">
            <Image
              src={`data:image/png;base64,${setupData.qr_code_base64}`}
              alt="2FA QR Code"
              w={200}
              h={200}
              fit="contain"
            />
          </Stack>

          <Text size="sm" c="dimmed">
            Or manually enter this secret key:
          </Text>
          <Group>
            <Code block style={{ flex: 1, fontSize: '0.9rem', letterSpacing: '0.1em' }}>
              {setupData.secret}
            </Code>
            <CopyButton value={setupData.secret}>
              {({ copied, copy }) => (
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={copy}
                  leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </CopyButton>
          </Group>

          <Text size="sm" fw={500} mt="md">
            Enter the 6-digit code from your authenticator app to verify:
          </Text>
          <Group justify="center">
            <PinInput
              length={6}
              type="number"
              value={verifyCode}
              onChange={setVerifyCode}
              size="lg"
              autoFocus
            />
          </Group>

          <Group>
            <Button
              onClick={handleVerifySetup}
              loading={verifySetupMutation.isPending}
              disabled={verifyCode.length < 6}
            >
              Verify and Enable
            </Button>
            <Button variant="default" onClick={() => { setStep('idle'); setSetupData(null); setVerifyCode(''); }}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </Card>
    );
  }

  // Recovery codes step
  if (step === 'recovery') {
    return (
      <Card withBorder>
        <Stack>
          <Group>
            <IconCheck size={24} color="var(--mantine-color-green-6)" />
            <Title order={5}>Save Your Recovery Codes</Title>
          </Group>

          <Alert color="orange" title="Important">
            Save these recovery codes in a secure place. Each code can only be used once.
            If you lose access to your authenticator app, you can use these codes to log in.
          </Alert>

          <Card withBorder bg="gray.0" p="md">
            <List spacing="xs" size="sm" styles={{ itemWrapper: { fontFamily: 'monospace', fontSize: '1rem' } }}>
              {recoveryCodes.map((code, i) => (
                <List.Item key={i}>{code}</List.Item>
              ))}
            </List>
          </Card>

          <CopyButton value={recoveryCodes.join('\n')}>
            {({ copied, copy }) => (
              <Button
                variant="light"
                onClick={copy}
                leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              >
                {copied ? 'Copied to clipboard' : 'Copy all codes'}
              </Button>
            )}
          </CopyButton>

          <Button onClick={handleFinish} mt="sm">
            I have saved these codes
          </Button>
        </Stack>
      </Card>
    );
  }

  // Idle state — not enabled
  return (
    <Card withBorder>
      <Group justify="space-between" mb="md">
        <Group>
          <IconShieldLock size={24} />
          <Title order={5}>Two-Factor Authentication</Title>
        </Group>
        <Badge color="gray" variant="light">Disabled</Badge>
      </Group>

      <Text size="sm" c="dimmed" mb="md">
        Add an extra layer of security to your account by requiring a verification code
        from an authenticator app when logging in.
      </Text>

      <Button
        onClick={() => setupMutation.mutate()}
        loading={setupMutation.isPending}
        leftSection={<IconShieldLock size={16} />}
      >
        Enable Two-Factor Authentication
      </Button>
    </Card>
  );
}
