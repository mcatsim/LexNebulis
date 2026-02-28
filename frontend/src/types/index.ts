// Auth & Users
export type UserRole = 'admin' | 'attorney' | 'paralegal' | 'billing_clerk';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// Clients
export type ClientType = 'individual' | 'organization';
export type ClientStatus = 'active' | 'inactive' | 'archived';

export interface Client {
  id: string;
  client_number: number;
  client_type: ClientType;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  email: string | null;
  phone: string | null;
  address_json: Record<string, string> | null;
  notes: string | null;
  status: ClientStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Contacts
export type ContactRole = 'judge' | 'witness' | 'opposing_counsel' | 'expert' | 'other';

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  role: ContactRole;
  organization: string | null;
  email: string | null;
  phone: string | null;
  address_json: Record<string, string> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Matters
export type MatterStatus = 'open' | 'pending' | 'closed' | 'archived';
export type LitigationType = 'civil' | 'criminal' | 'family' | 'corporate' | 'real_estate' | 'immigration' | 'bankruptcy' | 'tax' | 'labor' | 'intellectual_property' | 'estate_planning' | 'personal_injury' | 'other';

export interface Matter {
  id: string;
  matter_number: number;
  title: string;
  client_id: string;
  status: MatterStatus;
  litigation_type: LitigationType;
  jurisdiction: string | null;
  court_name: string | null;
  case_number: string | null;
  date_opened: string;
  date_closed: string | null;
  description: string | null;
  assigned_attorney_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Documents
export interface Document {
  id: string;
  matter_id: string;
  uploaded_by: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  version: number;
  parent_document_id: string | null;
  tags_json: string[] | null;
  description: string | null;
  created_at: string;
}

// Calendar
export type EventType = 'court_date' | 'deadline' | 'filing' | 'meeting' | 'reminder';
export type EventStatus = 'scheduled' | 'completed' | 'cancelled';

export interface CalendarEvent {
  id: string;
  matter_id: string | null;
  title: string;
  description: string | null;
  event_type: EventType;
  start_datetime: string;
  end_datetime: string | null;
  all_day: boolean;
  location: string | null;
  assigned_to: string | null;
  reminder_minutes: number | null;
  status: EventStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Billing
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
export type PaymentMethod = 'check' | 'ach' | 'credit_card' | 'cash' | 'other';

export interface TimeEntry {
  id: string;
  matter_id: string;
  user_id: string;
  date: string;
  duration_minutes: number;
  description: string;
  billable: boolean;
  rate_cents: number;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: number;
  client_id: string;
  matter_id: string;
  issued_date: string | null;
  due_date: string | null;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  status: InvoiceStatus;
  pdf_storage_key: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount_cents: number;
  payment_date: string;
  method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

// Trust
export type TrustEntryType = 'deposit' | 'disbursement' | 'transfer';

export interface TrustAccount {
  id: string;
  account_name: string;
  bank_name: string;
  balance_cents: number;
  is_active: boolean;
  created_at: string;
}

export interface TrustLedgerEntry {
  id: string;
  trust_account_id: string;
  client_id: string;
  matter_id: string | null;
  entry_type: TrustEntryType;
  amount_cents: number;
  running_balance_cents: number;
  description: string;
  reference_number: string | null;
  entry_date: string;
  created_by: string;
  created_at: string;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Search
export interface SearchResult {
  type: 'client' | 'matter' | 'contact' | 'document';
  id: string;
  title: string;
  subtitle: string;
}

// Audit
export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  changes_json: string | null;
  ip_address: string | null;
  user_agent: string | null;
  outcome: string;
  severity: string;
  integrity_hash: string;
  previous_hash: string | null;
  timestamp: string;
}
