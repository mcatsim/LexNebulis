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

// Intake / CRM Pipeline
export type LeadSource = 'website' | 'referral' | 'social_media' | 'advertisement' | 'walk_in' | 'phone' | 'other';
export type PipelineStage = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'retained' | 'declined' | 'lost';

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  source: LeadSource;
  source_detail: string | null;
  stage: PipelineStage;
  practice_area: string | null;
  description: string | null;
  estimated_value_cents: number | null;
  assigned_to: string | null;
  converted_client_id: string | null;
  converted_matter_id: string | null;
  converted_at: string | null;
  notes: string | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface IntakeForm {
  id: string;
  name: string;
  description: string | null;
  practice_area: string | null;
  fields_json: IntakeFormField[];
  is_active: boolean;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntakeFormField {
  name: string;
  type: string;
  label: string;
  required: boolean;
  options?: string[];
}

export interface IntakeSubmission {
  id: string;
  form_id: string;
  lead_id: string | null;
  data_json: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  is_reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineStageSummary {
  stage: PipelineStage;
  count: number;
  total_value_cents: number;
}

export interface PipelineSummaryResponse {
  stages: PipelineStageSummary[];
  total_leads: number;
  total_value_cents: number;
}

// Reports & Analytics
export interface UtilizationReport {
  user_id: string;
  user_name: string;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  utilization_rate: number;
}

export interface RealizationReport {
  total_billed_cents: number;
  total_collected_cents: number;
  realization_rate: number;
  period_start: string;
  period_end: string;
}

export interface CollectionReport {
  total_invoiced_cents: number;
  total_collected_cents: number;
  total_outstanding_cents: number;
  collection_rate: number;
  period_start: string;
  period_end: string;
}

export interface RevenueByAttorney {
  user_id: string;
  user_name: string;
  billed_cents: number;
  collected_cents: number;
  hours_worked: number;
  effective_rate_cents: number;
}

export interface AgedReceivable {
  client_id: string;
  client_name: string;
  current_cents: number;
  days_31_60_cents: number;
  days_61_90_cents: number;
  days_91_120_cents: number;
  over_120_cents: number;
  total_cents: number;
}

export interface MatterProfitability {
  matter_id: string;
  matter_title: string;
  client_name: string;
  total_billed_cents: number;
  total_collected_cents: number;
  total_hours: number;
  effective_rate_cents: number;
  status: string;
}

export interface BillableHoursSummary {
  user_id: string;
  user_name: string;
  practice_area: string;
  billable_hours: number;
  billable_amount_cents: number;
}

export interface DashboardSummary {
  total_revenue_cents: number;
  total_outstanding_cents: number;
  total_wip_cents: number;
  total_matters_open: number;
  total_matters_closed_period: number;
  average_collection_days: number;
  utilization_rate: number;
  collection_rate: number;
}

export type ReportExportType = 'utilization' | 'collection' | 'revenue' | 'aged-receivables' | 'matter-profitability' | 'billable-hours';

// LEDES / E-Billing
export type UTBMSCodeType = 'activity' | 'expense' | 'task' | 'phase';

export interface UTBMSCode {
  id: string;
  code: string;
  code_type: UTBMSCodeType;
  name: string;
  description: string | null;
  practice_area: string | null;
  is_active: boolean;
}

export interface BillingGuideline {
  id: string;
  client_id: string;
  name: string;
  rate_cap_cents: number | null;
  daily_hour_cap: number | null;
  block_billing_prohibited: boolean;
  task_code_required: boolean;
  activity_code_required: boolean;
  restricted_codes: string[] | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeEntryCode {
  id: string;
  time_entry_id: string;
  utbms_code_id: string;
  created_at: string;
  code: string | null;
  code_type: UTBMSCodeType | null;
  code_name: string | null;
}

export interface ComplianceViolation {
  rule: string;
  message: string;
  severity: string;
}

export interface ComplianceResult {
  compliant: boolean;
  violations: ComplianceViolation[];
}

export interface BlockBillingResult {
  is_block_billing: boolean;
  reasons: string[];
  confidence: string;
}

// E-Signature
export type SignatureRequestStatus = 'draft' | 'pending' | 'partially_signed' | 'completed' | 'expired' | 'cancelled';
export type SignerStatus = 'pending' | 'viewed' | 'signed' | 'declined';

export interface Signer {
  id: string;
  signature_request_id: string;
  name: string;
  email: string;
  role: string | null;
  order: number;
  status: SignerStatus;
  access_token: string;
  signed_at: string | null;
  signed_ip: string | null;
  signed_user_agent: string | null;
  decline_reason: string | null;
  created_at: string;
}

export interface SignatureRequest {
  id: string;
  document_id: string;
  matter_id: string;
  created_by: string;
  title: string;
  message: string | null;
  status: SignatureRequestStatus;
  expires_at: string | null;
  completed_at: string | null;
  certificate_storage_key: string | null;
  signers: Signer[];
  created_at: string;
  updated_at: string;
}

export interface SignatureAuditEntry {
  id: string;
  signature_request_id: string;
  signer_id: string | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  details: string | null;
  timestamp: string;
}

export interface SigningPageInfo {
  request_title: string;
  message: string | null;
  signer_name: string;
  signer_email: string;
  signer_status: string;
  document_download_url: string;
}

export interface CertificateSignerInfo {
  name: string;
  email: string;
  signed_at: string | null;
  ip_address: string | null;
}

export interface CertificateOfCompletion {
  request_title: string;
  document_name: string;
  signers: CertificateSignerInfo[];
  created_at: string;
  completed_at: string;
  document_hash: string | null;
}

// Emails
export type EmailDirection = 'inbound' | 'outbound';

export interface FiledEmail {
  id: string;
  matter_id: string;
  filed_by: string;
  filed_by_name: string | null;
  direction: EmailDirection;
  subject: string | null;
  from_address: string | null;
  to_addresses: string[] | null;
  cc_addresses: string[] | null;
  bcc_addresses: string[] | null;
  date_sent: string | null;
  body_text: string | null;
  body_html: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  thread_id: string | null;
  has_attachments: boolean;
  attachment_count: number;
  headers_json: Record<string, string> | null;
  tags: string[] | null;
  notes: string | null;
  source: string | null;
  attachments: EmailAttachment[];
  created_at: string;
  updated_at: string;
}

export interface EmailAttachment {
  id: string;
  email_id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_key: string | null;
  document_id: string | null;
  created_at: string;
}

export interface MatterSuggestion {
  matter_id: string;
  matter_title: string;
  confidence: number;
  use_count: number;
}

export interface EmailSummary {
  matter_id: string;
  matter_title: string;
  email_count: number;
  latest_email_date: string | null;
}

export interface EmailThread {
  thread_id: string;
  emails: FiledEmail[];
}

// SSO
export type SSOProviderType = 'oidc' | 'saml';

export interface SSOProvider {
  id: string;
  name: string;
  provider_type: SSOProviderType;
  is_active: boolean;
  is_default: boolean;
  client_id: string | null;
  client_secret_masked: string | null;
  discovery_url: string | null;
  authorization_endpoint: string | null;
  token_endpoint: string | null;
  userinfo_endpoint: string | null;
  jwks_uri: string | null;
  scopes: string | null;
  saml_entity_id: string | null;
  saml_sso_url: string | null;
  saml_certificate: string | null;
  email_claim: string | null;
  name_claim: string | null;
  role_mapping: Record<string, string> | null;
  auto_create_users: boolean;
  default_role: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SSOProviderPublic {
  id: string;
  name: string;
  provider_type: SSOProviderType;
}

export interface SSOLoginInitiateResponse {
  redirect_url: string;
  state: string;
}

// Payment Processing
export type PaymentProcessorType = 'stripe' | 'lawpay' | 'manual';
export type PaymentLinkStatus = 'active' | 'paid' | 'expired' | 'cancelled';
export type PaymentAccountType = 'operating' | 'trust';

export interface PaymentSettings {
  id: string;
  processor: PaymentProcessorType;
  is_active: boolean;
  api_key_masked: string | null;
  webhook_secret_masked: string | null;
  publishable_key: string | null;
  account_type: PaymentAccountType;
  surcharge_enabled: boolean;
  surcharge_rate: number;
  webhook_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentLink {
  id: string;
  invoice_id: string;
  client_id: string;
  matter_id: string | null;
  created_by: string;
  amount_cents: number;
  description: string | null;
  status: PaymentLinkStatus;
  access_token: string;
  processor: PaymentProcessorType;
  processor_session_id: string | null;
  expires_at: string | null;
  paid_at: string | null;
  paid_amount_cents: number | null;
  surcharge_cents: number;
  processor_fee_cents: number;
  payer_email: string | null;
  payer_name: string | null;
  processor_reference: string | null;
  payment_url: string | null;
  invoice_number: number | null;
  client_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicPaymentInfo {
  invoice_number: number | null;
  amount_cents: number;
  surcharge_cents: number;
  total_cents: number;
  description: string | null;
  client_name: string | null;
  firm_name: string;
  processor: PaymentProcessorType;
  status: PaymentLinkStatus;
  expires_at: string | null;
}

export interface ProcessorBreakdown {
  processor: PaymentProcessorType;
  count: number;
  total_cents: number;
  fees_cents: number;
}

export interface PaymentSummary {
  total_processed_cents: number;
  total_fees_cents: number;
  count: number;
  by_processor: ProcessorBreakdown[];
}

export interface WebhookEvent {
  id: string;
  processor: PaymentProcessorType;
  event_type: string;
  event_id: string | null;
  processed: boolean;
  error_message: string | null;
  created_at: string;
}

// Accounting / QuickBooks / Xero Integration
export type ExportFormat = 'iif' | 'csv' | 'qbo_json';
export type AccountType = 'income' | 'expense' | 'asset' | 'liability' | 'equity';

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  parent_code: string | null;
  description: string | null;
  is_active: boolean;
  quickbooks_account_name: string | null;
  xero_account_code: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountMapping {
  id: string;
  source_type: string;
  account_id: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  account_name: string | null;
  account_code: string | null;
}

export interface ExportHistory {
  id: string;
  export_format: ExportFormat;
  export_type: string;
  start_date: string;
  end_date: string;
  record_count: number;
  file_name: string | null;
  storage_key: string | null;
  exported_by: string;
  notes: string | null;
  created_at: string;
}

export interface ExportPreviewRow {
  values: Record<string, string>;
}

export interface ExportPreview {
  row_count: number;
  total_amount_cents: number;
  sample_rows: ExportPreviewRow[];
  export_type: string;
  format: ExportFormat;
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
