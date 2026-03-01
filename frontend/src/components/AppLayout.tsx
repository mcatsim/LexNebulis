import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ActionIcon, AppShell, Badge, Burger, Group, NavLink, ScrollArea, Text, Tooltip, useMantineColorScheme,
} from '@mantine/core';
import {
  IconAlarm, IconAlertTriangle, IconCalculator, IconCalendar, IconCash, IconChecklist, IconClipboardList,
  IconCloud, IconCreditCard, IconDashboard,
  IconFileDescription, IconKey, IconLogout, IconMail, IconMoon, IconReceipt2, IconReportAnalytics, IconScale,
  IconSearch, IconServer, IconSettings, IconShieldLock, IconSignature,
  IconSun, IconTemplate, IconTransferIn, IconUserPlus, IconUsers, IconUsersGroup, IconBuildingBank, IconWorld,
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { useTimerStore } from '../stores/timerStore';
import SearchOverlay from './SearchOverlay';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: IconDashboard, path: '/' },
  { label: 'Clients', icon: IconUsers, path: '/clients' },
  { label: 'Matters', icon: IconClipboardList, path: '/matters' },
  { label: 'Contacts', icon: IconUsersGroup, path: '/contacts' },
  { label: 'Intake', icon: IconUserPlus, path: '/intake' },
  { label: 'Documents', icon: IconFileDescription, path: '/documents' },
  { label: 'Emails', icon: IconMail, path: '/emails' },
  { label: 'E-Sign', icon: IconSignature, path: '/esign' },
  { label: 'Calendar', icon: IconCalendar, path: '/calendar' },
  { label: 'Billing', icon: IconCash, path: '/billing' },
  { label: 'Payments', icon: IconCreditCard, path: '/payments' },
  { label: 'Reports', icon: IconReportAnalytics, path: '/reports' },
  { label: 'Tasks', icon: IconChecklist, path: '/tasks' },
  { label: 'Templates', icon: IconTemplate, path: '/templates' },
  { label: 'Trust Accounts', icon: IconBuildingBank, path: '/trust' },
  { label: 'E-Billing', icon: IconReceipt2, path: '/ledes' },
  { label: 'Accounting', icon: IconCalculator, path: '/accounting' },
  { label: 'Deadlines', icon: IconAlarm, path: '/deadlines' },
  { label: 'Conflicts', icon: IconAlertTriangle, path: '/conflicts' },
  { label: 'Portal', icon: IconWorld, path: '/portal-admin' },
];

const ADMIN_ITEMS = [
  { label: 'Admin', icon: IconSettings, path: '/admin' },
  { label: 'Audit Logs', icon: IconShieldLock, path: '/admin/audit' },
  { label: 'SSO', icon: IconKey, path: '/admin/sso' },
  { label: 'SCIM', icon: IconTransferIn, path: '/admin/scim' },
  { label: 'SIEM', icon: IconServer, path: '/admin/siem' },
  { label: 'Cloud Storage', icon: IconCloud, path: '/admin/cloud-storage' },
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
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          zIndex: 9999,
        }}
        onFocus={(e) => {
          e.currentTarget.style.position = 'static';
          e.currentTarget.style.width = 'auto';
          e.currentTarget.style.height = 'auto';
        }}
        onBlur={(e) => {
          e.currentTarget.style.position = 'absolute';
          e.currentTarget.style.width = '1px';
          e.currentTarget.style.height = '1px';
        }}
      >
        Skip to main content
      </a>
      <SearchOverlay opened={searchOpen} onClose={() => setSearchOpen(false)} />
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group>
              <Burger opened={opened} onClick={() => setOpened(!opened)} hiddenFrom="sm" size="sm" aria-label="Toggle navigation menu" />
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
                <ActionIcon variant="default" size="lg" onClick={() => setSearchOpen(true)} aria-label="Search">
                  <IconSearch size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Toggle dark mode">
                <ActionIcon variant="default" size="lg" onClick={() => toggleColorScheme()} aria-label="Toggle dark mode">
                  {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
                </ActionIcon>
              </Tooltip>
              <Text size="sm" c="dimmed">{user?.first_name} {user?.last_name}</Text>
              <Tooltip label="Account Settings">
                <ActionIcon variant="default" size="lg" onClick={() => navigate('/settings')} aria-label="Account Settings">
                  <IconSettings size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Logout">
                <ActionIcon variant="subtle" color="red" onClick={handleLogout} aria-label="Logout">
                  <IconLogout size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="sm" aria-label="Main navigation">
          <AppShell.Section grow component={ScrollArea}>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                component={Link}
                to={item.path}
                label={item.label}
                leftSection={<item.icon size={20} />}
                active={location.pathname === item.path}
                aria-current={location.pathname === item.path ? 'page' : undefined}
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
                      aria-current={location.pathname === item.path ? 'page' : undefined}
                      onClick={() => setOpened(false)}
                    />
                  ))}
                </NavLink>
              </>
            )}
          </AppShell.Section>
        </AppShell.Navbar>

        <AppShell.Main id="main-content">
          <Outlet />
        </AppShell.Main>
      </AppShell>
    </>
  );
}
