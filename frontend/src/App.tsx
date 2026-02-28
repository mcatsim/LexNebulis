import { Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { LoadingOverlay } from '@mantine/core';
import AppLayout from './components/AppLayout';
import AuthGuard from './auth/AuthGuard';
import LoginPage from './auth/LoginPage';

// Lazy-loaded pages
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const ClientListPage = lazy(() => import('./features/clients/ClientListPage'));
const ClientDetailPage = lazy(() => import('./features/clients/ClientDetailPage'));
const MatterListPage = lazy(() => import('./features/matters/MatterListPage'));
const MatterDetailPage = lazy(() => import('./features/matters/MatterDetailPage'));
const ContactListPage = lazy(() => import('./features/contacts/ContactListPage'));
const ContactDetailPage = lazy(() => import('./features/contacts/ContactDetailPage'));
const DocumentsPage = lazy(() => import('./features/documents/DocumentsPage'));
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage'));
const BillingPage = lazy(() => import('./features/billing/BillingPage'));
const TrustPage = lazy(() => import('./features/trust/TrustPage'));
const ConflictsPage = lazy(() => import('./features/conflicts/ConflictsPage'));
const TasksPage = lazy(() => import('./features/tasks/TasksPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const AdminPage = lazy(() => import('./features/admin/AdminPage'));
const AuditLogPage = lazy(() => import('./features/admin/AuditLogPage'));

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingOverlay visible />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route path="/" element={<SuspenseWrapper><DashboardPage /></SuspenseWrapper>} />
        <Route path="/clients" element={<SuspenseWrapper><ClientListPage /></SuspenseWrapper>} />
        <Route path="/clients/:id" element={<SuspenseWrapper><ClientDetailPage /></SuspenseWrapper>} />
        <Route path="/matters" element={<SuspenseWrapper><MatterListPage /></SuspenseWrapper>} />
        <Route path="/matters/:id" element={<SuspenseWrapper><MatterDetailPage /></SuspenseWrapper>} />
        <Route path="/contacts" element={<SuspenseWrapper><ContactListPage /></SuspenseWrapper>} />
        <Route path="/contacts/:id" element={<SuspenseWrapper><ContactDetailPage /></SuspenseWrapper>} />
        <Route path="/documents" element={<SuspenseWrapper><DocumentsPage /></SuspenseWrapper>} />
        <Route path="/calendar" element={<SuspenseWrapper><CalendarPage /></SuspenseWrapper>} />
        <Route path="/billing" element={<SuspenseWrapper><BillingPage /></SuspenseWrapper>} />
        <Route path="/trust" element={<SuspenseWrapper><TrustPage /></SuspenseWrapper>} />
        <Route path="/conflicts" element={<SuspenseWrapper><ConflictsPage /></SuspenseWrapper>} />
        <Route path="/tasks" element={<SuspenseWrapper><TasksPage /></SuspenseWrapper>} />
        <Route path="/settings" element={<SuspenseWrapper><SettingsPage /></SuspenseWrapper>} />
        <Route path="/admin" element={<SuspenseWrapper><AdminPage /></SuspenseWrapper>} />
        <Route path="/admin/audit" element={<SuspenseWrapper><AuditLogPage /></SuspenseWrapper>} />
      </Route>
    </Routes>
  );
}
