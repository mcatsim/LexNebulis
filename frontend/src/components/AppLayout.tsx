import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ActionIcon, AppShell, Badge, Burger, Group, NavLink, ScrollArea, Text, Tooltip, useMantineColorScheme,
} from '@mantine/core';
import {
  IconAlertTriangle, IconCalendar, IconCash, IconChecklist, IconClipboardList, IconDashboard,
  IconFileDescription, IconLogout, IconMoon, IconScale, IconSearch, IconSettings, IconShieldLock,
  IconSun, IconUsers, IconUsersGroup, IconBuildingBank,
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { useTimerStore } from '../stores/timerStore';
import SearchOverlay from './SearchOverlay';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: IconDashboard, path: '/' },
  { label: 'Clients', icon: IconUsers, path: '/clients' },
  { label: 'Matters', icon: IconClipboardList, path: '/matters' },
  { label: 'Contacts', icon: IconUsersGroup, path: '/contacts' },
  { label: 'Documents', icon: IconFileDescription, path: '/documents' },
  { label: 'Calendar', icon: IconCalendar, path: '/calendar' },
  { label: 'Billing', icon: IconCash, path: '/billing' },
  { label: 'Tasks', icon: IconChecklist, path: '/tasks' },
  { label: 'Trust Accounts', icon: IconBuildingBank, path: '/trust' },
  { label: 'Conflicts', icon: IconAlertTriangle, path: '/conflicts' },
];

const ADMIN_ITEMS = [
  { label: 'Admin', icon: IconSettings, path: '/admin' },
  { label: 'Audit Logs', icon: IconShieldLock, path: '/admin/audit' },
];

export default function AppLayout() {
  const [opened, setOpened] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { isRunning, elapsed } = useTimerStore();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <SearchOverlay opened={searchOpen} onClose={() => setSearchOpen(false)} />
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group>
              <Burger opened={opened} onClick={() => setOpened(!opened)} hiddenFrom="sm" size="sm" />
              <IconScale size={28} color="var(--mantine-color-blue-6)" />
              <Text fw={700} size="lg">LexNebulis</Text>
            </Group>

            <Group>
              {isRunning && (
                <Badge color="red" variant="filled" size="lg">
                  {formatTimer(elapsed)}
                </Badge>
              )}
              <Tooltip label="Search (Ctrl+K)">
                <ActionIcon variant="default" size="lg" onClick={() => setSearchOpen(true)}>
                  <IconSearch size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Toggle dark mode">
                <ActionIcon variant="default" size="lg" onClick={() => toggleColorScheme()}>
                  {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
                </ActionIcon>
              </Tooltip>
              <Text size="sm" c="dimmed">{user?.first_name} {user?.last_name}</Text>
              <Tooltip label="Account Settings">
                <ActionIcon variant="default" size="lg" onClick={() => navigate('/settings')}>
                  <IconSettings size={18} />
                </ActionIcon>
              </Tooltip>
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
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                component={Link}
                to={item.path}
                label={item.label}
                leftSection={<item.icon size={20} />}
                active={location.pathname === item.path}
                onClick={() => setOpened(false)}
              />
            ))}
            {user?.role === 'admin' && (
              <>
                <NavLink label="Administration" childrenOffset={28} defaultOpened>
                  {ADMIN_ITEMS.map((item) => (
                    <NavLink
                      key={item.path}
                      component={Link}
                      to={item.path}
                      label={item.label}
                      leftSection={<item.icon size={18} />}
                      active={location.pathname === item.path}
                      onClick={() => setOpened(false)}
                    />
                  ))}
                </NavLink>
              </>
            )}
          </AppShell.Section>
        </AppShell.Navbar>

        <AppShell.Main>
          <Outlet />
        </AppShell.Main>
      </AppShell>
    </>
  );
}
