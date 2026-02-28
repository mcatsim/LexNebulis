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
const EmailsPage = lazy(() => import('./features/emails/EmailsPage'));
const ESignPage = lazy(() => import('./features/esign/ESignPage'));
const SigningPage = lazy(() => import('./features/esign/SigningPage'));
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage'));
const BillingPage = lazy(() => import('./features/billing/BillingPage'));
const TrustPage = lazy(() => import('./features/trust/TrustPage'));
const ConflictsPage = lazy(() => import('./features/conflicts/ConflictsPage'));
const TasksPage = lazy(() => import('./features/tasks/TasksPage'));
const TemplatesPage = lazy(() => import('./features/templates/TemplatesPage'));
const DeadlinesPage = lazy(() => import('./features/deadlines/DeadlinesPage'));
const IntakePage = lazy(() => import('./features/intake/IntakePage'));
const LEDESPage = lazy(() => import('./features/ledes/LEDESPage'));
const ReportsPage = lazy(() => import('./features/reports/ReportsPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const AdminPage = lazy(() => import('./features/admin/AdminPage'));
const AuditLogPage = lazy(() => import('./features/admin/AuditLogPage'));
const PortalManagementPage = lazy(() => import('./features/portal/PortalManagementPage'));
const SSOSettingsPage = lazy(() => import('./features/admin/SSOSettingsPage'));

// SSO Callback (outside auth guard)
const SSOCallbackPage = lazy(() => import('./auth/SSOCallbackPage'));

// Portal (client-facing) pages
const PortalLoginPage = lazy(() => import('./portal/PortalLoginPage'));
const PortalLayout = lazy(() => import('./portal/PortalLayout'));
const PortalDashboard = lazy(() => import('./portal/PortalDashboard'));
const PortalMattersPage = lazy(() => import('./portal/PortalMattersPage'));
const PortalMatterDetailPage = lazy(() => import('./portal/PortalMatterDetailPage'));
const PortalInvoicesPage = lazy(() => import('./portal/PortalInvoicesPage'));
const PortalMessagesPage = lazy(() => import('./portal/PortalMessagesPage'));

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
        <Route path="/emails" element={<SuspenseWrapper><EmailsPage /></SuspenseWrapper>} />
        <Route path="/esign" element={<SuspenseWrapper><ESignPage /></SuspenseWrapper>} />
        <Route path="/calendar" element={<SuspenseWrapper><CalendarPage /></SuspenseWrapper>} />
        <Route path="/billing" element={<SuspenseWrapper><BillingPage /></SuspenseWrapper>} />
        <Route path="/trust" element={<SuspenseWrapper><TrustPage /></SuspenseWrapper>} />
        <Route path="/conflicts" element={<SuspenseWrapper><ConflictsPage /></SuspenseWrapper>} />
        <Route path="/tasks" element={<SuspenseWrapper><TasksPage /></SuspenseWrapper>} />
        <Route path="/templates" element={<SuspenseWrapper><TemplatesPage /></SuspenseWrapper>} />
        <Route path="/deadlines" element={<SuspenseWrapper><DeadlinesPage /></SuspenseWrapper>} />
        <Route path="/ledes" element={<SuspenseWrapper><LEDESPage /></SuspenseWrapper>} />
        <Route path="/intake" element={<SuspenseWrapper><IntakePage /></SuspenseWrapper>} />
        <Route path="/reports" element={<SuspenseWrapper><ReportsPage /></SuspenseWrapper>} />
        <Route path="/settings" element={<SuspenseWrapper><SettingsPage /></SuspenseWrapper>} />
        <Route path="/admin" element={<SuspenseWrapper><AdminPage /></SuspenseWrapper>} />
        <Route path="/admin/audit" element={<SuspenseWrapper><AuditLogPage /></SuspenseWrapper>} />
        <Route path="/admin/sso" element={<SuspenseWrapper><SSOSettingsPage /></SuspenseWrapper>} />
        <Route path="/portal-admin" element={<SuspenseWrapper><PortalManagementPage /></SuspenseWrapper>} />
      </Route>

      {/* SSO Callback (no auth, handles redirect from IdP) */}
      <Route path="/sso/callback" element={<SuspenseWrapper><SSOCallbackPage /></SuspenseWrapper>} />

      {/* E-Signature public signing page (no auth) */}
      <Route path="/sign/:token" element={<SuspenseWrapper><SigningPage /></SuspenseWrapper>} />

      {/* Portal routes (client-facing, separate auth) */}
      <Route path="/portal/login" element={<SuspenseWrapper><PortalLoginPage /></SuspenseWrapper>} />
      <Route path="/portal" element={<SuspenseWrapper><PortalLayout /></SuspenseWrapper>}>
        <Route index element={<SuspenseWrapper><PortalDashboard /></SuspenseWrapper>} />
        <Route path="matters" element={<SuspenseWrapper><PortalMattersPage /></SuspenseWrapper>} />
        <Route path="matters/:id" element={<SuspenseWrapper><PortalMatterDetailPage /></SuspenseWrapper>} />
        <Route path="invoices" element={<SuspenseWrapper><PortalInvoicesPage /></SuspenseWrapper>} />
        <Route path="messages" element={<SuspenseWrapper><PortalMessagesPage /></SuspenseWrapper>} />
      </Route>
    </Routes>
  );
}
