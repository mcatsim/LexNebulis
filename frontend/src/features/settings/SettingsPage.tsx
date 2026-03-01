import { Stack, Title, Text } from '@mantine/core';
import TwoFactorSetup from '../admin/TwoFactorSetup';
import WebAuthnSetup from './WebAuthnSetup';

export default function SettingsPage() {
  return (
    <Stack>
      <div>
        <Title order={1}>Account Settings</Title>
        <Text c="dimmed" size="sm">Manage your account security and preferences</Text>
      </div>
      <TwoFactorSetup />
      <WebAuthnSetup />
    </Stack>
  );
}
