import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import { useAuthStore } from '../../stores/authStore';
import {
  authApi,
  clientsApi,
  contactsApi,
  mattersApi,
  documentsApi,
  calendarApi,
  billingApi,
  trustApi,
  searchApi,
  adminApi,
} from '../services';

describe('API Services', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().setTokens('test-token', 'test-refresh');
  });

  // ── authApi ─────────────────────────────────────────────

  describe('authApi', () => {
    it('has expected methods', () => {
      expect(authApi.login).toBeTypeOf('function');
      expect(authApi.refresh).toBeTypeOf('function');
      expect(authApi.me).toBeTypeOf('function');
      expect(authApi.changePassword).toBeTypeOf('function');
      expect(authApi.listUsers).toBeTypeOf('function');
      expect(authApi.createUser).toBeTypeOf('function');
      expect(authApi.updateUser).toBeTypeOf('function');
    });

    it('login sends POST to /auth/login with credentials', async () => {
      let capturedBody: Record<string, string> | null = null;

      server.use(
        http.post('/api/auth/login', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, string>;
          return HttpResponse.json({
            access_token: 'tok',
            refresh_token: 'ref',
            token_type: 'bearer',
          });
        }),
      );

      await authApi.login('user@test.com', 'pass123');

      expect(capturedBody).toEqual({ email: 'user@test.com', password: 'pass123' });
    });

    it('me sends GET to /auth/me', async () => {
      const response = await authApi.me();

      expect(response.data.email).toBe('admin@lexnebulis.test');
    });

    it('listUsers sends GET to /auth/users with pagination', async () => {
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('/api/auth/users', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            page_size: 10,
            total_pages: 1,
          });
        }),
      );

      await authApi.listUsers(2, 10);

      expect(capturedParams?.get('page')).toBe('2');
      expect(capturedParams?.get('page_size')).toBe('10');
    });
  });

  // ── clientsApi ──────────────────────────────────────────

  describe('clientsApi', () => {
    it('has expected methods', () => {
      expect(clientsApi.list).toBeTypeOf('function');
      expect(clientsApi.get).toBeTypeOf('function');
      expect(clientsApi.create).toBeTypeOf('function');
      expect(clientsApi.update).toBeTypeOf('function');
      expect(clientsApi.delete).toBeTypeOf('function');
    });

    it('list sends GET to /clients with search params', async () => {
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('/api/clients', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            page_size: 25,
            total_pages: 1,
          });
        }),
      );

      await clientsApi.list({ page: 2, page_size: 10, search: 'alice', status: 'active' });

      expect(capturedParams?.get('page')).toBe('2');
      expect(capturedParams?.get('page_size')).toBe('10');
      expect(capturedParams?.get('search')).toBe('alice');
      expect(capturedParams?.get('status')).toBe('active');
    });

    it('get sends GET to /clients/:id', async () => {
      const response = await clientsApi.get('client-001');

      expect(response.data.id).toBe('client-001');
      expect(response.data.first_name).toBe('Alice');
    });

    it('create sends POST to /clients', async () => {
      let capturedBody: Record<string, unknown> | null = null;

      server.use(
        http.post('/api/clients', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 'new-client', ...capturedBody });
        }),
      );

      await clientsApi.create({
        first_name: 'New',
        last_name: 'Client',
        client_type: 'individual',
      });

      expect(capturedBody?.first_name).toBe('New');
      expect(capturedBody?.last_name).toBe('Client');
    });

    it('delete sends DELETE to /clients/:id', async () => {
      let calledId: string | null = null;

      server.use(
        http.delete('/api/clients/:id', ({ params }) => {
          calledId = params.id as string;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      await clientsApi.delete('client-001');

      expect(calledId).toBe('client-001');
    });
  });

  // ── contactsApi ─────────────────────────────────────────

  describe('contactsApi', () => {
    it('has expected methods', () => {
      expect(contactsApi.list).toBeTypeOf('function');
      expect(contactsApi.get).toBeTypeOf('function');
      expect(contactsApi.create).toBeTypeOf('function');
      expect(contactsApi.update).toBeTypeOf('function');
      expect(contactsApi.delete).toBeTypeOf('function');
    });

    it('list sends GET to /contacts with params', async () => {
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('/api/contacts', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            page_size: 25,
            total_pages: 1,
          });
        }),
      );

      await contactsApi.list({ search: 'robert', role: 'judge' });

      expect(capturedParams?.get('search')).toBe('robert');
      expect(capturedParams?.get('role')).toBe('judge');
    });
  });

  // ── mattersApi ──────────────────────────────────────────

  describe('mattersApi', () => {
    it('has expected methods', () => {
      expect(mattersApi.list).toBeTypeOf('function');
      expect(mattersApi.get).toBeTypeOf('function');
      expect(mattersApi.create).toBeTypeOf('function');
      expect(mattersApi.update).toBeTypeOf('function');
      expect(mattersApi.delete).toBeTypeOf('function');
      expect(mattersApi.addContact).toBeTypeOf('function');
      expect(mattersApi.removeContact).toBeTypeOf('function');
    });

    it('list sends GET to /matters with status filter', async () => {
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('/api/matters', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            page_size: 25,
            total_pages: 1,
          });
        }),
      );

      await mattersApi.list({ status: 'open', client_id: 'client-001' });

      expect(capturedParams?.get('status')).toBe('open');
      expect(capturedParams?.get('client_id')).toBe('client-001');
    });

    it('addContact sends POST to /matters/:id/contacts', async () => {
      let capturedBody: Record<string, unknown> | null = null;

      server.use(
        http.post('/api/matters/:matterId/contacts', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 'mc-001' });
        }),
      );

      await mattersApi.addContact('matter-001', 'contact-001', 'judge');

      expect(capturedBody?.contact_id).toBe('contact-001');
      expect(capturedBody?.relationship_type).toBe('judge');
    });
  });

  // ── calendarApi ─────────────────────────────────────────

  describe('calendarApi', () => {
    it('has expected methods', () => {
      expect(calendarApi.list).toBeTypeOf('function');
      expect(calendarApi.get).toBeTypeOf('function');
      expect(calendarApi.create).toBeTypeOf('function');
      expect(calendarApi.update).toBeTypeOf('function');
      expect(calendarApi.delete).toBeTypeOf('function');
    });

    it('list sends GET to /calendar with date params', async () => {
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('/api/calendar', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            page_size: 25,
            total_pages: 1,
          });
        }),
      );

      await calendarApi.list({ start_date: '2024-07-01', end_date: '2024-07-31' });

      expect(capturedParams?.get('start_date')).toBe('2024-07-01');
      expect(capturedParams?.get('end_date')).toBe('2024-07-31');
    });
  });

  // ── billingApi ──────────────────────────────────────────

  describe('billingApi', () => {
    it('has expected time entry methods', () => {
      expect(billingApi.listTimeEntries).toBeTypeOf('function');
      expect(billingApi.createTimeEntry).toBeTypeOf('function');
      expect(billingApi.updateTimeEntry).toBeTypeOf('function');
      expect(billingApi.deleteTimeEntry).toBeTypeOf('function');
    });

    it('has expected invoice methods', () => {
      expect(billingApi.listInvoices).toBeTypeOf('function');
      expect(billingApi.getInvoice).toBeTypeOf('function');
      expect(billingApi.createInvoice).toBeTypeOf('function');
    });

    it('has expected payment methods', () => {
      expect(billingApi.listPayments).toBeTypeOf('function');
      expect(billingApi.createPayment).toBeTypeOf('function');
    });

    it('listTimeEntries sends GET to /billing/time-entries', async () => {
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('/api/billing/time-entries', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            page_size: 25,
            total_pages: 1,
          });
        }),
      );

      await billingApi.listTimeEntries({ matter_id: 'matter-001', billable: true });

      expect(capturedParams?.get('matter_id')).toBe('matter-001');
      expect(capturedParams?.get('billable')).toBe('true');
    });

    it('listInvoices sends GET to /billing/invoices with status filter', async () => {
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('/api/billing/invoices', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            page_size: 25,
            total_pages: 1,
          });
        }),
      );

      await billingApi.listInvoices({ invoice_status: 'sent', client_id: 'client-001' });

      expect(capturedParams?.get('invoice_status')).toBe('sent');
      expect(capturedParams?.get('client_id')).toBe('client-001');
    });

    it('createTimeEntry sends POST to /billing/time-entries', async () => {
      let capturedBody: Record<string, unknown> | null = null;

      server.use(
        http.post('/api/billing/time-entries', async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 'new-time', ...capturedBody });
        }),
      );

      await billingApi.createTimeEntry({
        matter_id: 'matter-001',
        date: '2024-06-20',
        duration_minutes: 60,
        description: 'Legal research',
        billable: true,
        rate_cents: 35000,
      });

      expect(capturedBody?.matter_id).toBe('matter-001');
      expect(capturedBody?.duration_minutes).toBe(60);
      expect(capturedBody?.billable).toBe(true);
    });
  });

  // ── searchApi ───────────────────────────────────────────

  describe('searchApi', () => {
    it('has expected methods', () => {
      expect(searchApi.search).toBeTypeOf('function');
    });

    it('search sends GET to /search with query params', async () => {
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('/api/search', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json({ query: 'alice', results: [] });
        }),
      );

      await searchApi.search('alice', 10);

      expect(capturedParams?.get('q')).toBe('alice');
      expect(capturedParams?.get('limit')).toBe('10');
    });
  });

  // ── trustApi ────────────────────────────────────────────

  describe('trustApi', () => {
    it('has expected methods', () => {
      expect(trustApi.listAccounts).toBeTypeOf('function');
      expect(trustApi.createAccount).toBeTypeOf('function');
      expect(trustApi.listLedger).toBeTypeOf('function');
      expect(trustApi.createLedgerEntry).toBeTypeOf('function');
      expect(trustApi.createReconciliation).toBeTypeOf('function');
    });
  });

  // ── adminApi ────────────────────────────────────────────

  describe('adminApi', () => {
    it('has expected methods', () => {
      expect(adminApi.listAuditLogs).toBeTypeOf('function');
      expect(adminApi.verifyAuditChain).toBeTypeOf('function');
      expect(adminApi.exportAuditJSON).toBeTypeOf('function');
      expect(adminApi.exportAuditCEF).toBeTypeOf('function');
      expect(adminApi.exportAuditSyslog).toBeTypeOf('function');
      expect(adminApi.testWebhook).toBeTypeOf('function');
      expect(adminApi.listSettings).toBeTypeOf('function');
      expect(adminApi.updateSetting).toBeTypeOf('function');
    });
  });

  // ── documentsApi ────────────────────────────────────────

  describe('documentsApi', () => {
    it('has expected methods', () => {
      expect(documentsApi.list).toBeTypeOf('function');
      expect(documentsApi.get).toBeTypeOf('function');
      expect(documentsApi.upload).toBeTypeOf('function');
      expect(documentsApi.getDownloadUrl).toBeTypeOf('function');
      expect(documentsApi.delete).toBeTypeOf('function');
    });

    it('getDownloadUrl returns correct path', () => {
      const url = documentsApi.getDownloadUrl('doc-001');
      expect(url).toBe('/api/documents/doc-001/download');
    });
  });
});
