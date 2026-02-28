import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Center, PasswordInput, Stack, Text, TextInput, Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconUserShield } from '@tabler/icons-react';
import { portalClientApi } from '../api/services';
import { usePortalAuthStore } from '../stores/portalAuthStore';

export default function PortalLoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setTokens, setClientUser } = usePortalAuthStore();

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
      const { data } = await portalClientApi.login(values.email, values.password);
      setTokens(data.access_token, data.refresh_token);
      const { data: user } = await portalClientApi.me();
      setClientUser(user);
      navigate('/portal');
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

  return (
    <Center h="100vh" bg="teal.0">
      <Card shadow="md" padding="xl" radius="md" w={400}>
        <Stack align="center" gap="xs" mb="lg">
          <IconUserShield size={48} color="var(--mantine-color-teal-6)" />
          <Title order={2}>Client Portal</Title>
          <Text c="dimmed" size="sm">LexNebulis Secure Access</Text>
        </Stack>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="your@email.com"
              required
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              required
              {...form.getInputProps('password')}
            />
            <Button type="submit" fullWidth loading={loading} color="teal">
              Sign In
            </Button>
          </Stack>
        </form>
      </Card>
    </Center>
  );
}
