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

export interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  requires_2fa?: boolean;
  temp_token?: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  provisioning_uri: string;
  qr_code_base64: string;
}

export interface TwoFactorVerifySetupResponse {
  recovery_codes: string[];
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
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

// Conflicts
export type ConflictStatus = 'clear' | 'potential_conflict' | 'confirmed_conflict';
export type MatchType = 'exact' | 'fuzzy' | 'phonetic' | 'email';
export type MatchResolution = 'not_reviewed' | 'cleared' | 'flagged' | 'waiver_obtained';

export interface ConflictCheck {
  id: string;
  checked_by: string;
  search_name: string;
  search_organization: string | null;
  matter_id: string | null;
  status: ConflictStatus;
  notes: string | null;
  matches: ConflictMatch[];
  match_count?: number;
  created_at: string;
}

export interface ConflictMatch {
  id: string;
  conflict_check_id: string;
  matched_entity_type: string;
  matched_entity_id: string;
  matched_name: string;
  match_type: MatchType;
  match_score: number;
  relationship_context: string | null;
  resolution: MatchResolution;
  resolved_by: string | null;
  resolved_at: string | null;
  notes: string | null;
}

export interface EthicalWall {
  id: string;
  matter_id: string;
  user_id: string;
  reason: string;
  created_by: string;
  created_at: string;
  is_active: boolean;
}

// Tasks
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  matter_id: string | null;
  assigned_to: string | null;
  created_by: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  checklist: TaskChecklistItem[];
  dependencies: TaskDependency[];
  created_at: string;
  updated_at: string;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_id: string;
  depends_on_title?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  practice_area: string | null;
  is_active: boolean;
  steps: WorkflowTemplateStep[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplateStep {
  id: string;
  workflow_template_id: string;
  title: string;
  description: string | null;
  assigned_role: string | null;
  relative_due_days: number | null;
  sort_order: number;
  depends_on_step_order: number | null;
}

// Portal
export interface ClientUser {
  id: string;
  client_id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortalMessage {
  id: string;
  matter_id: string;
  sender_type: 'staff' | 'client';
  sender_name: string;
  subject: string | null;
  body: string;
  parent_message_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface SharedDocument {
  id: string;
  document_id: string;
  matter_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  shared_by_name: string;
  shared_at: string;
  note: string | null;
}

export interface PortalMatter {
  id: string;
  title: string;
  status: string;
  litigation_type: string;
  date_opened: string;
  date_closed: string | null;
  description: string | null;
  attorney_name: string | null;
}

export interface PortalInvoice {
  id: string;
  invoice_number: number | null;
  matter_title: string | null;
  total_cents: number;
  status: string;
  issued_date: string | null;
  due_date: string | null;
}

// Document Templates
export type TemplateCategory = 'engagement_letter' | 'correspondence' | 'pleading' | 'motion' | 'contract' | 'discovery' | 'other';

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string | null;
  practice_area: string | null;
  category: TemplateCategory;
  filename: string;
  version: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GeneratedDocument {
  id: string;
  template_id: string;
  template_name: string;
  matter_id: string;
  document_id: string | null;
  generated_by: string;
  context_json: string;
  created_at: string;
}

// Deadlines
export type OffsetType = 'calendar_days' | 'business_days';

export interface CourtRuleSet {
  id: string;
  name: string;
  jurisdiction: string;
  court_type: string | null;
  is_active: boolean;
  rules: DeadlineRule[];
  created_at: string;
  updated_at: string;
}

export interface DeadlineRule {
  id: string;
  rule_set_id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  offset_days: number;
  offset_type: OffsetType;
  creates_event_type: string;
  is_active: boolean;
  sort_order: number;
}

export interface TriggerEvent {
  id: string;
  matter_id: string;
  trigger_name: string;
  trigger_date: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface GeneratedDeadline {
  id: string;
  calendar_event_id: string;
  trigger_event_id: string;
  deadline_rule_id: string;
  matter_id: string;
  computed_date: string;
  rule_name?: string;
  event_title?: string;
  created_at: string;
}

export interface StatuteOfLimitations {
  id: string;
  matter_id: string;
  description: string;
  expiration_date: string;
  statute_reference: string | null;
  reminder_days: number[] | null;
  is_active: boolean;
  days_remaining?: number;
  created_at: string;
  updated_at: string;
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
