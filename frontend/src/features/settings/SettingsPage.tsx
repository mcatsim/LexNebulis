import { Stack, Title, Text } from '@mantine/core';
import TwoFactorSetup from '../admin/TwoFactorSetup';

export default function SettingsPage() {
  return (
    <Stack>
      <div>
        <Title order={2}>Account Settings</Title>
        <Text c="dimmed" size="sm">Manage your account security and preferences</Text>
      </div>
      <TwoFactorSetup />
    </Stack>
  );
}
