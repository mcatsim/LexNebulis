import type {
  User,
  Client,
  Contact,
  Matter,
  CalendarEvent,
  TimeEntry,
  Invoice,
  TrustAccount,
  TrustLedgerEntry,
  SearchResult,
  TokenResponse,
  PaginatedResponse,
  Payment,
} from '../../types';

// ── Auth ──────────────────────────────────────────────────────

export const mockTokenResponse: TokenResponse = {
  access_token: 'mock-access-token-abc123',
  refresh_token: 'mock-refresh-token-xyz789',
  token_type: 'bearer',
};

export const mockUser: User = {
  id: 'user-001',
  email: 'admin@lexnebulis.test',
  first_name: 'Jane',
  last_name: 'Doe',
  role: 'admin',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-06-15T12:00:00Z',
};

export const mockAttorney: User = {
  id: 'user-002',
  email: 'attorney@lexnebulis.test',
  first_name: 'John',
  last_name: 'Smith',
  role: 'attorney',
  is_active: true,
  created_at: '2024-02-01T00:00:00Z',
  updated_at: '2024-06-15T12:00:00Z',
};

export const mockUsers: User[] = [mockUser, mockAttorney];

// ── Clients ───────────────────────────────────────────────────

export const mockClient: Client = {
  id: 'client-001',
  client_number: 1001,
  client_type: 'individual',
  first_name: 'Alice',
  last_name: 'Johnson',
  organization_name: null,
  email: 'alice@example.com',
  phone: '555-0101',
  address_json: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
  notes: 'VIP client',
  status: 'active',
  created_by: 'user-001',
  created_at: '2024-03-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
};

export const mockOrgClient: Client = {
  id: 'client-002',
  client_number: 1002,
  client_type: 'organization',
  first_name: null,
  last_name: null,
  organization_name: 'Acme Corp',
  email: 'legal@acme.com',
  phone: '555-0202',
  address_json: { street: '456 Corporate Blvd', city: 'Chicago', state: 'IL', zip: '60601' },
  notes: null,
  status: 'active',
  created_by: 'user-001',
  created_at: '2024-03-15T00:00:00Z',
  updated_at: '2024-06-10T00:00:00Z',
};

export const mockClients: Client[] = [mockClient, mockOrgClient];

// ── Contacts ──────────────────────────────────────────────────

export const mockContact: Contact = {
  id: 'contact-001',
  first_name: 'Robert',
  last_name: 'Williams',
  role: 'judge',
  organization: 'Springfield Circuit Court',
  email: 'rwilliams@court.gov',
  phone: '555-0301',
  address_json: null,
  notes: 'Presiding judge, Division 3',
  created_at: '2024-04-01T00:00:00Z',
  updated_at: '2024-05-15T00:00:00Z',
};

export const mockContacts: Contact[] = [
  mockContact,
  {
    id: 'contact-002',
    first_name: 'Sarah',
    last_name: 'Lee',
    role: 'opposing_counsel',
    organization: 'Lee & Partners LLP',
    email: 'sarah@leepartners.com',
    phone: '555-0302',
    address_json: null,
    notes: null,
    created_at: '2024-04-10T00:00:00Z',
    updated_at: '2024-05-20T00:00:00Z',
  },
];

// ── Matters ───────────────────────────────────────────────────

export const mockMatter: Matter = {
  id: 'matter-001',
  matter_number: 2001,
  title: 'Johnson v. Springfield School District',
  client_id: 'client-001',
  status: 'open',
  litigation_type: 'civil',
  jurisdiction: 'Illinois',
  court_name: 'Springfield Circuit Court',
  case_number: '2024-CV-1234',
  date_opened: '2024-03-15',
  date_closed: null,
  description: 'Employment discrimination matter',
  assigned_attorney_id: 'user-002',
  notes: null,
  created_at: '2024-03-15T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
};

export const mockMatters: Matter[] = [
  mockMatter,
  {
    id: 'matter-002',
    matter_number: 2002,
    title: 'Acme Corp - Annual Compliance Review',
    client_id: 'client-002',
    status: 'open',
    litigation_type: 'corporate',
    jurisdiction: 'Illinois',
    court_name: null,
    case_number: null,
    date_opened: '2024-04-01',
    date_closed: null,
    description: 'Corporate compliance review',
    assigned_attorney_id: 'user-001',
    notes: null,
    created_at: '2024-04-01T00:00:00Z',
    updated_at: '2024-06-15T00:00:00Z',
  },
];

// ── Calendar Events ───────────────────────────────────────────

export const mockCalendarEvent: CalendarEvent = {
  id: 'event-001',
  matter_id: 'matter-001',
  title: 'Summary Judgment Hearing',
  description: 'Motion for summary judgment hearing',
  event_type: 'court_date',
  start_datetime: '2024-07-15T09:00:00Z',
  end_datetime: '2024-07-15T11:00:00Z',
  all_day: false,
  location: 'Courtroom 3, Springfield Circuit Court',
  assigned_to: 'user-002',
  reminder_minutes: 60,
  status: 'scheduled',
  created_by: 'user-001',
  created_at: '2024-06-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
};

export const mockCalendarEvents: CalendarEvent[] = [
  mockCalendarEvent,
  {
    id: 'event-002',
    matter_id: 'matter-001',
    title: 'Discovery Deadline',
    description: 'Final deadline for document production',
    event_type: 'deadline',
    start_datetime: '2024-07-01T23:59:00Z',
    end_datetime: null,
    all_day: true,
    location: null,
    assigned_to: 'user-002',
    reminder_minutes: 1440,
    status: 'scheduled',
    created_by: 'user-001',
    created_at: '2024-05-20T00:00:00Z',
    updated_at: '2024-05-20T00:00:00Z',
  },
  {
    id: 'event-003',
    matter_id: 'matter-002',
    title: 'Client Meeting - Acme Corp',
    description: 'Quarterly compliance review meeting',
    event_type: 'meeting',
    start_datetime: '2024-07-10T14:00:00Z',
    end_datetime: '2024-07-10T15:30:00Z',
    all_day: false,
    location: 'Conference Room B',
    assigned_to: 'user-001',
    reminder_minutes: 30,
    status: 'scheduled',
    created_by: 'user-001',
    created_at: '2024-06-05T00:00:00Z',
    updated_at: '2024-06-05T00:00:00Z',
  },
];

// ── Time Entries ──────────────────────────────────────────────

export const mockTimeEntry: TimeEntry = {
  id: 'time-001',
  matter_id: 'matter-001',
  user_id: 'user-002',
  date: '2024-06-15',
  duration_minutes: 120,
  description: 'Drafted motion for summary judgment',
  billable: true,
  rate_cents: 35000,
  invoice_id: null,
  created_at: '2024-06-15T18:00:00Z',
  updated_at: '2024-06-15T18:00:00Z',
};

export const mockTimeEntries: TimeEntry[] = [
  mockTimeEntry,
  {
    id: 'time-002',
    matter_id: 'matter-001',
    user_id: 'user-002',
    date: '2024-06-14',
    duration_minutes: 90,
    description: 'Reviewed discovery documents',
    billable: true,
    rate_cents: 35000,
    invoice_id: null,
    created_at: '2024-06-14T17:00:00Z',
    updated_at: '2024-06-14T17:00:00Z',
  },
  {
    id: 'time-003',
    matter_id: 'matter-002',
    user_id: 'user-001',
    date: '2024-06-13',
    duration_minutes: 60,
    description: 'Compliance audit preparation',
    billable: true,
    rate_cents: 40000,
    invoice_id: null,
    created_at: '2024-06-13T16:00:00Z',
    updated_at: '2024-06-13T16:00:00Z',
  },
];

// ── Invoices ──────────────────────────────────────────────────

export const mockInvoice: Invoice = {
  id: 'invoice-001',
  invoice_number: 3001,
  client_id: 'client-001',
  matter_id: 'matter-001',
  issued_date: '2024-06-30',
  due_date: '2024-07-30',
  subtotal_cents: 1225000,
  tax_cents: 0,
  total_cents: 1225000,
  status: 'sent',
  pdf_storage_key: 'invoices/3001.pdf',
  notes: 'June 2024 billing',
  created_at: '2024-06-30T00:00:00Z',
  updated_at: '2024-06-30T00:00:00Z',
};

export const mockInvoices: Invoice[] = [
  mockInvoice,
  {
    id: 'invoice-002',
    invoice_number: 3002,
    client_id: 'client-002',
    matter_id: 'matter-002',
    issued_date: '2024-06-30',
    due_date: '2024-07-30',
    subtotal_cents: 400000,
    tax_cents: 0,
    total_cents: 400000,
    status: 'draft',
    pdf_storage_key: null,
    notes: null,
    created_at: '2024-06-30T00:00:00Z',
    updated_at: '2024-06-30T00:00:00Z',
  },
];

// ── Payments ──────────────────────────────────────────────────

export const mockPayment: Payment = {
  id: 'payment-001',
  invoice_id: 'invoice-001',
  amount_cents: 1225000,
  payment_date: '2024-07-15',
  method: 'check',
  reference_number: 'CHK-9876',
  notes: 'Paid in full',
  created_at: '2024-07-15T00:00:00Z',
};

export const mockPaymentSettings = {
  stripe_enabled: false,
  stripe_publishable_key: null,
  payment_methods: ['credit_card', 'ach'],
  default_currency: 'usd',
  auto_receipt: true,
};

// ── Trust Accounts ────────────────────────────────────────────

export const mockTrustAccount: TrustAccount = {
  id: 'trust-001',
  account_name: 'Client Trust Account - Primary',
  bank_name: 'First National Bank',
  balance_cents: 5000000,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockTrustAccounts: TrustAccount[] = [mockTrustAccount];

// ── Trust Ledger Entries ──────────────────────────────────────

export const mockTrustLedgerEntry: TrustLedgerEntry = {
  id: 'ledger-001',
  trust_account_id: 'trust-001',
  client_id: 'client-001',
  matter_id: 'matter-001',
  entry_type: 'deposit',
  amount_cents: 2500000,
  running_balance_cents: 2500000,
  description: 'Retainer deposit',
  reference_number: 'DEP-001',
  entry_date: '2024-03-15',
  created_by: 'user-001',
  created_at: '2024-03-15T00:00:00Z',
};

// ── Search Results ────────────────────────────────────────────

export const mockSearchResults: SearchResult[] = [
  { type: 'client', id: 'client-001', title: 'Alice Johnson', subtitle: 'Individual - Active' },
  { type: 'matter', id: 'matter-001', title: 'Johnson v. Springfield School District', subtitle: 'Civil - Open' },
  { type: 'contact', id: 'contact-001', title: 'Robert Williams', subtitle: 'Judge - Springfield Circuit Court' },
  { type: 'document', id: 'doc-001', title: 'Motion for Summary Judgment.pdf', subtitle: 'Matter #2001' },
];

// ── Paginated Response Helpers ────────────────────────────────

export function makePaginatedResponse<T>(
  items: T[],
  total?: number,
  page = 1,
  pageSize = 25,
): PaginatedResponse<T> {
  const t = total ?? items.length;
  return {
    items,
    total: t,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(t / pageSize) || 1,
  };
}
