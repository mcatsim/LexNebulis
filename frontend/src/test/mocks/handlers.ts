import { http, HttpResponse } from 'msw';
import {
  mockTokenResponse,
  mockUser,
  mockUsers,
  mockClients,
  mockClient,
  mockMatters,
  mockCalendarEvents,
  mockTimeEntries,
  mockInvoices,
  mockSearchResults,
  makePaginatedResponse,
} from './data';

export const handlers = [
  // ── Auth ──────────────────────────────────────────────

  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === 'admin@legalforge.test' && body.password === 'password123') {
      return HttpResponse.json(mockTokenResponse);
    }
    return HttpResponse.json(
      { detail: 'Invalid email or password' },
      { status: 401 },
    );
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json(mockUser);
  }),

  http.get('/api/auth/users', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '1');
    const pageSize = Number(url.searchParams.get('page_size') || '25');
    return HttpResponse.json(makePaginatedResponse(mockUsers, mockUsers.length, page, pageSize));
  }),

  http.post('/api/auth/refresh', () => {
    return HttpResponse.json(mockTokenResponse);
  }),

  // ── Clients ───────────────────────────────────────────

  http.get('/api/clients', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '1');
    const pageSize = Number(url.searchParams.get('page_size') || '25');
    const search = url.searchParams.get('search') || '';

    let filtered = mockClients;
    if (search) {
      const q = search.toLowerCase();
      filtered = mockClients.filter(
        (c) =>
          c.first_name?.toLowerCase().includes(q) ||
          c.last_name?.toLowerCase().includes(q) ||
          c.organization_name?.toLowerCase().includes(q),
      );
    }

    return HttpResponse.json(makePaginatedResponse(filtered, filtered.length, page, pageSize));
  }),

  http.get('/api/clients/:id', ({ params }) => {
    const client = mockClients.find((c) => c.id === params.id);
    if (client) {
      return HttpResponse.json(client);
    }
    return HttpResponse.json({ detail: 'Client not found' }, { status: 404 });
  }),

  // ── Matters ───────────────────────────────────────────

  http.get('/api/matters', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '1');
    const pageSize = Number(url.searchParams.get('page_size') || '25');
    const status = url.searchParams.get('status');

    let filtered = mockMatters;
    if (status) {
      filtered = mockMatters.filter((m) => m.status === status);
    }

    return HttpResponse.json(makePaginatedResponse(filtered, filtered.length, page, pageSize));
  }),

  // ── Calendar ──────────────────────────────────────────

  http.get('/api/calendar', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '1');
    const pageSize = Number(url.searchParams.get('page_size') || '25');
    return HttpResponse.json(
      makePaginatedResponse(mockCalendarEvents, mockCalendarEvents.length, page, pageSize),
    );
  }),

  // ── Billing: Time Entries ─────────────────────────────

  http.get('/api/billing/time-entries', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '1');
    return HttpResponse.json(
      makePaginatedResponse(mockTimeEntries, mockTimeEntries.length, page, 25),
    );
  }),

  // ── Billing: Invoices ─────────────────────────────────

  http.get('/api/billing/invoices', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '1');
    return HttpResponse.json(
      makePaginatedResponse(mockInvoices, mockInvoices.length, page, 25),
    );
  }),

  // ── Search ────────────────────────────────────────────

  http.get('/api/search', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    if (q.length < 2) {
      return HttpResponse.json({ query: q, results: [] });
    }
    const filtered = mockSearchResults.filter(
      (r) =>
        r.title.toLowerCase().includes(q.toLowerCase()) ||
        r.subtitle.toLowerCase().includes(q.toLowerCase()),
    );
    return HttpResponse.json({ query: q, results: filtered });
  }),
];
