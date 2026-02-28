import { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ActionIcon, AppShell, Badge, Group, NavLink, ScrollArea, Text, Tooltip,
} from '@mantine/core';
import {
  IconClipboardList, IconCash, IconHome, IconLogout, IconMessage, IconUserShield,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { usePortalAuthStore } from '../stores/portalAuthStore';
import { portalClientApi } from '../api/services';

const PORTAL_NAV = [
  { label: 'Dashboard', icon: IconHome, path: '/portal' },
  { label: 'My Matters', icon: IconClipboardList, path: '/portal/matters' },
  { label: 'My Invoices', icon: IconCash, path: '/portal/invoices' },
];

export default function PortalLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, clientUser, setClientUser, logout } = usePortalAuthStore();

  // Fetch client user profile if not loaded
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/portal/login');
      return;
    }
    if (!clientUser) {
      portalClientApi.me().then(({ data }) => setClientUser(data)).catch(() => {
        logout();
        navigate('/portal/login');
      });
    }
  }, [isAuthenticated, clientUser, navigate, setClientUser, logout]);

  const { data: unreadData } = useQuery({
    queryKey: ['portal-unread'],
    queryFn: () => portalClientApi.getUnreadCount(),
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  const unreadCount = unreadData?.data?.unread_count ?? 0;

  const handleLogout = () => {
    logout();
    navigate('/portal/login');
  };

  if (!isAuthenticated) return null;

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <IconUserShield size={28} color="var(--mantine-color-teal-6)" />
            <Text fw={700} size="lg">LexNebulis</Text>
            <Badge color="teal" variant="light" size="sm">Client Portal</Badge>
          </Group>
          <Group>
            <Text size="sm" c="dimmed">
              {clientUser ? `${clientUser.first_name} ${clientUser.last_name}` : ''}
            </Text>
            <Tooltip label="Logout">
              <ActionIcon variant="subtle" color="red" onClick={handleLogout}>
                <IconLogout size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          {PORTAL_NAV.map((item) => (
            <NavLink
              key={item.path}
              component={Link}
              to={item.path}
              label={item.label}
              leftSection={<item.icon size={20} />}
              active={location.pathname === item.path}
            />
          ))}
          <NavLink
            component={Link}
            to="/portal/messages"
            label="Messages"
            leftSection={<IconMessage size={20} />}
            active={location.pathname === '/portal/messages'}
            rightSection={
              unreadCount > 0 ? (
                <Badge size="sm" color="red" variant="filled" circle>
                  {unreadCount}
                </Badge>
              ) : undefined
            }
          />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
