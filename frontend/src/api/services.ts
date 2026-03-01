import api, { portalApi } from './client';
import type {
  AgedReceivable, AuditLogEntry, BillableHoursSummary, BillingGuideline, BlockBillingResult,
  CalendarEvent, Client, ClientUser, CollectionReport, ComplianceResult, ConflictCheck,
  ConflictMatch, Contact,
  CourtRuleSet, DashboardSummary, DeadlineRule, EmailAttachment, EmailSummary, EmailThread,
  FiledEmail,
  GeneratedDeadline,
  Document as LegalDocument, DocumentTemplate, EthicalWall, GeneratedDocument, Invoice,
  IntakeForm, IntakeSubmission, Lead,
  LoginResponse, Matter, MatterProfitability, MatterSuggestion, Payment,
  PaymentLink, PaymentSettings, PaymentSummary, PublicPaymentInfo, WebhookEvent,
  PipelineSummaryResponse,
  PortalInvoice, PortalMatter, PortalMessage, RealizationReport,
  ReportExportType, RevenueByAttorney,
  SharedDocument, SignatureAuditEntry, SignatureRequest, SigningPageInfo,
  StatuteOfLimitations, Task, TaskChecklistItem, TaskDependency, TimeEntryCode, TriggerEvent,
  TwoFactorSetupResponse,
  TwoFactorStatusResponse, TwoFactorVerifySetupResponse, UTBMSCode, UTBMSCodeType,
  SSOLoginInitiateResponse, SSOProvider, SSOProviderPublic,
  UtilizationReport, WorkflowTemplate,
  TimeEntry, TokenResponse, TrustAccount, TrustLedgerEntry, User,
  PaginatedResponse, SearchResult,
  ChartOfAccount, AccountMapping, ExportHistory, ExportPreview, ExportFormat, AccountType,
} from '../types';

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
  refresh: (refresh_token: string) =>
    api.post<TokenResponse>('/auth/refresh', { refresh_token }),
  me: () => api.get<User>('/auth/me'),
  changePassword: (current_password: string, new_password: string) =>
    api.put('/auth/me/password', { current_password, new_password }),
  listUsers: (page = 1, page_size = 25) =>
    api.get<PaginatedResponse<User>>('/auth/users', { params: { page, page_size } }),
  createUser: (data: { email: string; password: string; first_name: string; last_name: string; role: string }) =>
    api.post<User>('/auth/users', data),
  updateUser: (id: string, data: Partial<User>) =>
    api.put<User>(`/auth/users/${id}`, data),
  // Two-Factor Authentication
  setup2fa: () =>
    api.post<TwoFactorSetupResponse>('/auth/2fa/setup'),
  verify2faSetup: (code: string) =>
    api.post<TwoFactorVerifySetupResponse>('/auth/2fa/setup/verify', { code }),
  verify2faLogin: (temp_token: string, code: string) =>
    api.post<LoginResponse>('/auth/2fa/verify', { temp_token, code }),
  disable2fa: (code: string) =>
    api.post('/auth/2fa/disable', { code }),
  get2faStatus: () =>
    api.get<TwoFactorStatusResponse>('/auth/2fa/status'),
};

// Clients
export const clientsApi = {
  list: (params: { page?: number; page_size?: number; search?: string; status?: string }) =>
    api.get<PaginatedResponse<Client>>('/clients', { params }),
  get: (id: string) => api.get<Client>(`/clients/${id}`),
  create: (data: Partial<Client>) => api.post<Client>('/clients', data),
  update: (id: string, data: Partial<Client>) => api.put<Client>(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`),
};

// Contacts
export const contactsApi = {
  list: (params: { page?: number; page_size?: number; search?: string; role?: string }) =>
    api.get<PaginatedResponse<Contact>>('/contacts', { params }),
  get: (id: string) => api.get<Contact>(`/contacts/${id}`),
  create: (data: Partial<Contact>) => api.post<Contact>('/contacts', data),
  update: (id: string, data: Partial<Contact>) => api.put<Contact>(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
};

// Matters
export const mattersApi = {
  list: (params: { page?: number; page_size?: number; search?: string; status?: string; client_id?: string; attorney_id?: string }) =>
    api.get<PaginatedResponse<Matter>>('/matters', { params }),
  get: (id: string) => api.get<Matter>(`/matters/${id}`),
  create: (data: Partial<Matter>) => api.post<Matter>('/matters', data),
  update: (id: string, data: Partial<Matter>) => api.put<Matter>(`/matters/${id}`, data),
  delete: (id: string) => api.delete(`/matters/${id}`),
  addContact: (matterId: string, contactId: string, relationshipType: string) =>
    api.post(`/matters/${matterId}/contacts`, { contact_id: contactId, relationship_type: relationshipType }),
  removeContact: (matterId: string, matterContactId: string) =>
    api.delete(`/matters/${matterId}/contacts/${matterContactId}`),
};

// Documents
export const documentsApi = {
  list: (params: { matter_id?: string; page?: number; page_size?: number; search?: string }) =>
    api.get<PaginatedResponse<LegalDocument>>('/documents', { params }),
  get: (id: string) => api.get<LegalDocument>(`/documents/${id}`),
  upload: (formData: FormData) =>
    api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getDownloadUrl: (id: string) => `/api/documents/${id}/download`,
  delete: (id: string) => api.delete(`/documents/${id}`),
};

// Calendar
export const calendarApi = {
  list: (params: { page?: number; page_size?: number; start_date?: string; end_date?: string; matter_id?: string; assigned_to?: string }) =>
    api.get<PaginatedResponse<CalendarEvent>>('/calendar', { params }),
  get: (id: string) => api.get<CalendarEvent>(`/calendar/${id}`),
  create: (data: Partial<CalendarEvent>) => api.post<CalendarEvent>('/calendar', data),
  update: (id: string, data: Partial<CalendarEvent>) => api.put<CalendarEvent>(`/calendar/${id}`, data),
  delete: (id: string) => api.delete(`/calendar/${id}`),
};

// Billing
export const billingApi = {
  // Time entries
  listTimeEntries: (params: { page?: number; matter_id?: string; user_id?: string; start_date?: string; end_date?: string; billable?: boolean }) =>
    api.get<PaginatedResponse<TimeEntry>>('/billing/time-entries', { params }),
  createTimeEntry: (data: { matter_id: string; date: string; duration_minutes: number; description: string; billable: boolean; rate_cents: number }) =>
    api.post<TimeEntry>('/billing/time-entries', data),
  updateTimeEntry: (id: string, data: Partial<TimeEntry>) =>
    api.put<TimeEntry>(`/billing/time-entries/${id}`, data),
  deleteTimeEntry: (id: string) => api.delete(`/billing/time-entries/${id}`),
  // Invoices
  listInvoices: (params: { page?: number; client_id?: string; matter_id?: string; invoice_status?: string }) =>
    api.get<PaginatedResponse<Invoice>>('/billing/invoices', { params }),
  getInvoice: (id: string) => api.get<Invoice>(`/billing/invoices/${id}`),
  createInvoice: (data: { client_id: string; matter_id: string; time_entry_ids: string[]; issued_date?: string; due_date?: string; notes?: string }) =>
    api.post<Invoice>('/billing/invoices', data),
  // Payments
  listPayments: (invoiceId: string) => api.get<Payment[]>(`/billing/invoices/${invoiceId}/payments`),
  createPayment: (data: { invoice_id: string; amount_cents: number; payment_date: string; method: string; reference_number?: string; notes?: string }) =>
    api.post<Payment>('/billing/payments', data),
};

// Trust
export const trustApi = {
  listAccounts: () => api.get<TrustAccount[]>('/trust/accounts'),
  createAccount: (data: { account_name: string; bank_name: string; account_number: string; routing_number: string }) =>
    api.post<TrustAccount>('/trust/accounts', data),
  listLedger: (accountId: string, params: { page?: number; client_id?: string }) =>
    api.get<PaginatedResponse<TrustLedgerEntry>>(`/trust/accounts/${accountId}/ledger`, { params }),
  createLedgerEntry: (data: { trust_account_id: string; client_id: string; matter_id?: string; entry_type: string; amount_cents: number; description: string; reference_number?: string; entry_date: string }) =>
    api.post<TrustLedgerEntry>('/trust/ledger', data),
  createReconciliation: (data: { trust_account_id: string; reconciliation_date: string; statement_balance_cents: number; notes?: string }) =>
    api.post('/trust/reconciliations', data),
};

// Search
export const searchApi = {
  search: (q: string, limit = 20) =>
    api.get<{ query: string; results: SearchResult[] }>('/search', { params: { q, limit } }),
};

// Conflicts
export const conflictsApi = {
  runCheck: (data: { search_name: string; search_organization?: string; matter_id?: string }) =>
    api.post<ConflictCheck>('/conflicts/check', data),
  listChecks: (params: { page?: number; page_size?: number; matter_id?: string; status?: string }) =>
    api.get<PaginatedResponse<ConflictCheck>>('/conflicts/checks', { params }),
  getCheck: (id: string) => api.get<ConflictCheck>(`/conflicts/checks/${id}`),
  resolveMatch: (matchId: string, data: { resolution: string; notes?: string }) =>
    api.put<ConflictMatch>(`/conflicts/matches/${matchId}/resolve`, data),
  createWall: (data: { matter_id: string; user_id: string; reason: string }) =>
    api.post<EthicalWall>('/conflicts/ethical-walls', data),
  getWalls: (matterId: string) => api.get<EthicalWall[]>(`/conflicts/ethical-walls/${matterId}`),
  removeWall: (wallId: string) => api.delete(`/conflicts/ethical-walls/${wallId}`),
};

// Tasks
export const tasksApi = {
  list: (params: { page?: number; page_size?: number; matter_id?: string; assigned_to?: string; status?: string; priority?: string }) =>
    api.get<PaginatedResponse<Task>>('/tasks', { params }),
  get: (id: string) => api.get<Task>(`/tasks/${id}`),
  create: (data: { title: string; description?: string; matter_id?: string; assigned_to?: string; priority: string; due_date?: string; checklist_items?: { title: string; sort_order: number }[] }) =>
    api.post<Task>('/tasks', data),
  update: (id: string, data: Partial<{ title: string; description: string; assigned_to: string; status: string; priority: string; due_date: string }>) =>
    api.put<Task>(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  addDependency: (taskId: string, dependsOnId: string) =>
    api.post<TaskDependency>(`/tasks/${taskId}/dependencies`, { depends_on_id: dependsOnId }),
  removeDependency: (dependencyId: string) =>
    api.delete(`/tasks/dependencies/${dependencyId}`),
  addChecklistItem: (taskId: string, data: { title: string; sort_order: number }) =>
    api.post<TaskChecklistItem>(`/tasks/${taskId}/checklist`, data),
  updateChecklistItem: (itemId: string, data: { is_completed: boolean }) =>
    api.put<TaskChecklistItem>(`/tasks/checklist/${itemId}`, data),
  deleteChecklistItem: (itemId: string) =>
    api.delete(`/tasks/checklist/${itemId}`),
};

// Workflows
export const workflowsApi = {
  list: (params?: { practice_area?: string }) =>
    api.get<WorkflowTemplate[]>('/workflows', { params }),
  get: (id: string) => api.get<WorkflowTemplate>(`/workflows/${id}`),
  create: (data: { name: string; description?: string; practice_area?: string; steps: { title: string; description?: string; assigned_role?: string; relative_due_days?: number; sort_order: number; depends_on_step_order?: number }[] }) =>
    api.post<WorkflowTemplate>('/workflows', data),
  apply: (templateId: string, matterId: string) =>
    api.post<Task[]>(`/workflows/${templateId}/apply`, { matter_id: matterId }),
  delete: (id: string) => api.delete(`/workflows/${id}`),
};

// Deadlines
export const deadlinesApi = {
  // Rule Sets
  listRuleSets: (params?: { jurisdiction?: string; search?: string }) =>
    api.get<CourtRuleSet[]>('/deadlines/rules', { params }),
  createRuleSet: (data: { name: string; jurisdiction: string; court_type?: string }) =>
    api.post<CourtRuleSet>('/deadlines/rules', data),
  getRuleSet: (id: string) => api.get<CourtRuleSet>(`/deadlines/rules/${id}`),
  addRule: (ruleSetId: string, data: { name: string; trigger_event: string; offset_days: number; offset_type: string; description?: string; creates_event_type?: string }) =>
    api.post<DeadlineRule>(`/deadlines/rules/${ruleSetId}/rules`, data),
  updateRule: (ruleId: string, data: Partial<DeadlineRule>) =>
    api.put<DeadlineRule>(`/deadlines/rules/rules/${ruleId}`, data),
  deleteRule: (ruleId: string) =>
    api.delete(`/deadlines/rules/rules/${ruleId}`),
  seedFederal: () => api.post<CourtRuleSet>('/deadlines/rules/seed-federal'),
  // Matter Deadlines
  applyRules: (matterId: string, data: { rule_set_id: string }) =>
    api.post(`/deadlines/matters/${matterId}/apply-rules`, data),
  setTrigger: (matterId: string, data: { trigger_name: string; trigger_date: string; notes?: string }) =>
    api.post<TriggerEvent>(`/deadlines/matters/${matterId}/triggers`, data),
  getTriggers: (matterId: string) =>
    api.get<TriggerEvent[]>(`/deadlines/matters/${matterId}/triggers`),
  updateTrigger: (triggerId: string, data: { trigger_date: string; notes?: string }) =>
    api.put<TriggerEvent>(`/deadlines/triggers/${triggerId}`, data),
  deleteTrigger: (triggerId: string) =>
    api.delete(`/deadlines/triggers/${triggerId}`),
  getMatterDeadlines: (matterId: string) =>
    api.get<GeneratedDeadline[]>(`/deadlines/matters/${matterId}/deadlines`),
  // Statute of Limitations
  createSOL: (data: { matter_id: string; description: string; expiration_date: string; statute_reference?: string; reminder_days?: number[] }) =>
    api.post<StatuteOfLimitations>('/deadlines/sol', data),
  getMatterSOL: (matterId: string) =>
    api.get<StatuteOfLimitations[]>(`/deadlines/sol/${matterId}`),
  updateSOL: (solId: string, data: Partial<StatuteOfLimitations>) =>
    api.put<StatuteOfLimitations>(`/deadlines/sol/${solId}`, data),
  deleteSOL: (solId: string) =>
    api.delete(`/deadlines/sol/${solId}`),
  getSOLWarnings: (daysAhead?: number) =>
    api.get<StatuteOfLimitations[]>('/deadlines/sol/warnings', { params: { days_ahead: daysAhead || 90 } }),
};

// Intake / CRM Pipeline
export const intakeApi = {
  // Leads
  listLeads: (params: {
    page?: number; page_size?: number; search?: string;
    stage?: string; source?: string; practice_area?: string; assigned_to?: string;
  }) =>
    api.get<PaginatedResponse<Lead>>('/intake', { params }),
  getLead: (id: string) => api.get<Lead>(`/intake/${id}`),
  createLead: (data: {
    first_name: string; last_name: string; email?: string; phone?: string;
    organization?: string; source?: string; source_detail?: string; stage?: string;
    practice_area?: string; description?: string; estimated_value_cents?: number;
    assigned_to?: string; notes?: string; custom_fields?: Record<string, unknown>;
  }) =>
    api.post<Lead>('/intake', data),
  updateLead: (id: string, data: Partial<Lead>) =>
    api.put<Lead>(`/intake/${id}`, data),
  deleteLead: (id: string) => api.delete(`/intake/${id}`),
  convertLead: (id: string, data: {
    client_type?: string; organization_name?: string;
    create_matter?: boolean; matter_title?: string;
    litigation_type?: string; jurisdiction?: string;
  }) =>
    api.post<Lead>(`/intake/${id}/convert`, data),
  getPipelineSummary: () =>
    api.get<PipelineSummaryResponse>('/intake/pipeline/summary'),
  // Intake Forms
  listForms: (params?: { page?: number; page_size?: number; is_active?: boolean }) =>
    api.get<PaginatedResponse<IntakeForm>>('/intake/forms', { params }),
  createForm: (data: {
    name: string; description?: string; practice_area?: string;
    fields_json: unknown[]; is_active?: boolean; is_public?: boolean;
  }) =>
    api.post<IntakeForm>('/intake/forms', data),
  updateForm: (id: string, data: {
    name?: string; description?: string; practice_area?: string;
    fields_json?: unknown[]; is_active?: boolean; is_public?: boolean;
  }) =>
    api.put<IntakeForm>(`/intake/forms/${id}`, data),
  deleteForm: (id: string) => api.delete(`/intake/forms/${id}`),
  // Submissions
  listSubmissions: (params?: { page?: number; page_size?: number; form_id?: string; is_reviewed?: boolean }) =>
    api.get<PaginatedResponse<IntakeSubmission>>('/intake/submissions', { params }),
  reviewSubmission: (id: string, data: {
    lead_id?: string; create_lead?: boolean;
    lead_first_name?: string; lead_last_name?: string;
    lead_email?: string; lead_phone?: string;
  }) =>
    api.put<IntakeSubmission>(`/intake/submissions/${id}/review`, data),
};

// Admin
export const adminApi = {
  listAuditLogs: (params: { page?: number; page_size?: number; entity_type?: string; action?: string; user_id?: string; severity?: string; start_date?: string; end_date?: string }) =>
    api.get<PaginatedResponse<AuditLogEntry>>('/admin/audit-logs', { params }),
  verifyAuditChain: (limit = 1000) =>
    api.get('/admin/audit-logs/verify-chain', { params: { limit } }),
  exportAuditJSON: (params: { start_date?: string; end_date?: string; limit?: number }) =>
    api.get('/admin/audit-logs/export/json', { params }),
  exportAuditCEF: (params: { start_date?: string; end_date?: string; limit?: number }) =>
    api.get('/admin/audit-logs/export/cef', { params, responseType: 'blob' }),
  exportAuditSyslog: (params: { start_date?: string; end_date?: string; limit?: number }) =>
    api.get('/admin/audit-logs/export/syslog', { params, responseType: 'blob' }),
  testWebhook: () => api.post('/admin/audit-logs/webhook/test'),
  listSettings: () => api.get('/admin/settings'),
  updateSetting: (key: string, value: string) => api.put(`/admin/settings/${key}`, { value }),
};

// Templates
export const templatesApi = {
  list: (params: { page?: number; page_size?: number; practice_area?: string; category?: string; search?: string }) =>
    api.get<PaginatedResponse<DocumentTemplate>>('/templates', { params }),
  get: (id: string) => api.get<DocumentTemplate>(`/templates/${id}`),
  upload: (formData: FormData) =>
    api.post<DocumentTemplate>('/templates/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string, data: { name?: string; description?: string; practice_area?: string; category?: string; is_active?: boolean }) =>
    api.put<DocumentTemplate>(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
  getVariables: (templateId: string) =>
    api.get<{ variables: string[]; context: Record<string, string> }>(`/templates/${templateId}/variables`),
  previewContext: (templateId: string, matterId: string) =>
    api.post<{ variables: string[]; context: Record<string, string> }>(`/templates/${templateId}/preview-context/${matterId}`),
  generate: (data: { template_id: string; matter_id: string; custom_overrides?: Record<string, string> }) =>
    api.post<{ document_id: string; filename: string; matter_id: string; template_name: string }>('/templates/generate', data),
  listGenerated: (params: { page?: number; page_size?: number; template_id?: string; matter_id?: string }) =>
    api.get<PaginatedResponse<GeneratedDocument>>('/templates/generated', { params }),
  downloadUrl: (templateId: string) => `/api/templates/${templateId}/download`,
};

// Portal (Staff-side)
export const portalStaffApi = {
  createClientUser: (data: { email: string; password: string; first_name: string; last_name: string; client_id: string }) =>
    api.post<ClientUser>('/portal/client-users', data),
  listClientUsers: (clientId: string) =>
    api.get<ClientUser[]>(`/portal/client-users/${clientId}`),
  updateClientUser: (userId: string, data: { is_active?: boolean; first_name?: string; last_name?: string }) =>
    api.put<ClientUser>(`/portal/client-users/${userId}`, data),
  shareDocument: (data: { document_id: string; matter_id: string; note?: string }) =>
    api.post<SharedDocument>('/portal/share-document', data),
  listSharedDocuments: (matterId: string, params?: { page?: number; page_size?: number }) =>
    api.get<PaginatedResponse<SharedDocument>>(`/portal/shared-documents/${matterId}`, { params }),
  getMessages: (matterId: string, params?: { page?: number; page_size?: number }) =>
    api.get<PaginatedResponse<PortalMessage>>(`/portal/messages/${matterId}`, { params }),
  sendMessage: (data: { matter_id: string; body: string; subject?: string; parent_message_id?: string }) =>
    api.post<PortalMessage>('/portal/messages', data),
};

// Portal (Client-side) — uses separate portalApi axios instance
export const portalClientApi = {
  login: (email: string, password: string) =>
    portalApi.post<{ access_token: string; refresh_token: string }>('/portal/auth/login', { email, password }),
  me: () => portalApi.get<ClientUser>('/portal/auth/me'),
  listMatters: (params?: { page?: number; page_size?: number }) =>
    portalApi.get<PaginatedResponse<PortalMatter>>('/portal/my/matters', { params }),
  getMatter: (matterId: string) =>
    portalApi.get<PortalMatter>(`/portal/my/matters/${matterId}`),
  getMatterDocuments: (matterId: string, params?: { page?: number; page_size?: number }) =>
    portalApi.get<PaginatedResponse<SharedDocument>>(`/portal/my/matters/${matterId}/documents`, { params }),
  listInvoices: (params?: { page?: number; page_size?: number }) =>
    portalApi.get<PaginatedResponse<PortalInvoice>>('/portal/my/invoices', { params }),
  getMessages: (matterId: string, params?: { page?: number; page_size?: number }) =>
    portalApi.get<PaginatedResponse<PortalMessage>>(`/portal/my/matters/${matterId}/messages`, { params }),
  sendMessage: (data: { matter_id: string; body: string; subject?: string; parent_message_id?: string }) =>
    portalApi.post<PortalMessage>('/portal/my/messages', data),
  markRead: (messageId: string) =>
    portalApi.put<PortalMessage>(`/portal/my/messages/${messageId}/read`),
  getUnreadCount: () =>
    portalApi.get<{ unread_count: number }>('/portal/my/unread'),
};

// LEDES / E-Billing
export const ledesApi = {
  // UTBMS Codes
  listCodes: (params: { page?: number; page_size?: number; code_type?: UTBMSCodeType; practice_area?: string; search?: string }) =>
    api.get<PaginatedResponse<UTBMSCode>>('/ledes/codes', { params }),
  createCode: (data: { code: string; code_type: UTBMSCodeType; name: string; description?: string; practice_area?: string; is_active?: boolean }) =>
    api.post<UTBMSCode>('/ledes/codes', data),
  updateCode: (id: string, data: { code?: string; code_type?: UTBMSCodeType; name?: string; description?: string; practice_area?: string; is_active?: boolean }) =>
    api.put<UTBMSCode>(`/ledes/codes/${id}`, data),
  deleteCode: (id: string) => api.delete(`/ledes/codes/${id}`),
  seedCodes: () => api.post<{ message: string; codes_created: number }>('/ledes/codes/seed'),
  // Billing Guidelines
  listGuidelines: (params: { page?: number; page_size?: number; client_id?: string }) =>
    api.get<PaginatedResponse<BillingGuideline>>('/ledes/guidelines', { params }),
  getGuideline: (id: string) => api.get<BillingGuideline>(`/ledes/guidelines/${id}`),
  createGuideline: (data: {
    client_id: string; name: string; rate_cap_cents?: number; daily_hour_cap?: number;
    block_billing_prohibited?: boolean; task_code_required?: boolean; activity_code_required?: boolean;
    restricted_codes?: string[]; notes?: string; is_active?: boolean;
  }) =>
    api.post<BillingGuideline>('/ledes/guidelines', data),
  updateGuideline: (id: string, data: {
    name?: string; rate_cap_cents?: number; daily_hour_cap?: number;
    block_billing_prohibited?: boolean; task_code_required?: boolean; activity_code_required?: boolean;
    restricted_codes?: string[]; notes?: string; is_active?: boolean;
  }) =>
    api.put<BillingGuideline>(`/ledes/guidelines/${id}`, data),
  deleteGuideline: (id: string) => api.delete(`/ledes/guidelines/${id}`),
  // Time Entry Codes
  getEntryCodes: (entryId: string) =>
    api.get<TimeEntryCode[]>(`/ledes/time-entries/${entryId}/codes`),
  assignCode: (entryId: string, utbmsCodeId: string) =>
    api.post<TimeEntryCode>(`/ledes/time-entries/${entryId}/codes`, { utbms_code_id: utbmsCodeId }),
  removeCode: (entryId: string, codeId: string) =>
    api.delete(`/ledes/time-entries/${entryId}/codes/${codeId}`),
  // Compliance
  checkCompliance: (data: { time_entry_id: string; client_id: string }) =>
    api.post<ComplianceResult>('/ledes/check-compliance', data),
  detectBlockBilling: (data: { description: string; duration_minutes?: number }) =>
    api.post<BlockBillingResult>('/ledes/detect-block-billing', data),
  // LEDES Export
  exportLedesUrl: (invoiceId: string) => `/api/ledes/export/ledes/${invoiceId}`,
  exportLedes: (invoiceId: string) =>
    api.get<string>(`/ledes/export/ledes/${invoiceId}`, { responseType: 'text' }),
};

// E-Signature
export const esignApi = {
  list: (params: { page?: number; page_size?: number; matter_id?: string; request_status?: string }) =>
    api.get<PaginatedResponse<SignatureRequest>>('/esign', { params }),
  get: (id: string) => api.get<SignatureRequest>(`/esign/${id}`),
  create: (data: {
    document_id: string; matter_id: string; title: string; message?: string;
    expires_at?: string; signers: { name: string; email: string; role?: string; order?: number }[];
  }) =>
    api.post<SignatureRequest>('/esign', data),
  send: (id: string) => api.post<SignatureRequest>(`/esign/${id}/send`),
  cancel: (id: string) => api.post<SignatureRequest>(`/esign/${id}/cancel`),
  getAuditTrail: (id: string) => api.get<SignatureAuditEntry[]>(`/esign/${id}/audit`),
  getCertificateUrl: (id: string) => `/api/esign/${id}/certificate`,
  // Public signing endpoints (no auth needed)
  getSigningPage: (token: string) => api.get<SigningPageInfo>(`/esign/sign/${token}`),
  sign: (token: string) => api.post<{ status: string; signer_name: string; signed_at: string }>(`/esign/sign/${token}`),
  decline: (token: string, reason: string) =>
    api.post<{ status: string; signer_name: string }>(`/esign/sign/${token}/decline`, { reason }),
};

// Emails
export const emailsApi = {
  list: (params: {
    page?: number; page_size?: number; matter_id?: string; direction?: string;
    search?: string; from_address?: string; start_date?: string; end_date?: string;
    has_attachments?: boolean;
  }) =>
    api.get<PaginatedResponse<FiledEmail>>('/emails', { params }),
  get: (id: string) => api.get<FiledEmail>(`/emails/${id}`),
  create: (data: {
    matter_id: string; direction?: string; subject?: string; from_address?: string;
    to_addresses?: string[]; cc_addresses?: string[]; bcc_addresses?: string[];
    date_sent?: string; body_text?: string; body_html?: string;
    message_id?: string; in_reply_to?: string; thread_id?: string;
    tags?: string[]; notes?: string; source?: string;
  }) =>
    api.post<FiledEmail>('/emails', data),
  update: (id: string, data: { notes?: string; tags?: string[]; matter_id?: string }) =>
    api.put<FiledEmail>(`/emails/${id}`, data),
  delete: (id: string) => api.delete(`/emails/${id}`),
  getThread: (id: string) => api.get<EmailThread>(`/emails/${id}/thread`),
  addAttachment: (emailId: string, data: { filename: string; mime_type?: string; size_bytes?: number }) =>
    api.post<EmailAttachment>(`/emails/${emailId}/attachments`, data),
  suggestMatter: (addresses: string) =>
    api.get<MatterSuggestion[]>('/emails/suggest-matter', { params: { addresses } }),
  summary: (params?: { matter_id?: string }) =>
    api.get<EmailSummary[]>('/emails/summary', { params }),
};

// Reports & Analytics
export const reportsApi = {
  getSummary: (params: { start_date: string; end_date: string }) =>
    api.get<DashboardSummary>('/reports/summary', { params }),
  getUtilization: (params: { start_date: string; end_date: string }) =>
    api.get<UtilizationReport[]>('/reports/utilization', { params }),
  getRealization: (params: { start_date: string; end_date: string }) =>
    api.get<RealizationReport>('/reports/realization', { params }),
  getCollection: (params: { start_date: string; end_date: string }) =>
    api.get<CollectionReport>('/reports/collection', { params }),
  getRevenueByAttorney: (params: { start_date: string; end_date: string }) =>
    api.get<RevenueByAttorney[]>('/reports/revenue-by-attorney', { params }),
  getAgedReceivables: () =>
    api.get<AgedReceivable[]>('/reports/aged-receivables'),
  getMatterProfitability: (params: { start_date: string; end_date: string; limit?: number }) =>
    api.get<MatterProfitability[]>('/reports/matter-profitability', { params }),
  getBillableHours: (params: { start_date: string; end_date: string }) =>
    api.get<BillableHoursSummary[]>('/reports/billable-hours', { params }),
  exportCsv: (reportType: ReportExportType, params?: { start_date?: string; end_date?: string }) =>
    api.get(`/reports/export/${reportType}`, { params, responseType: 'blob' }),
};

// Payment Processing
export const paymentProcessingApi = {
  // Settings (admin)
  getSettings: () =>
    api.get<PaymentSettings>('/payments/settings'),
  upsertSettings: (data: {
    processor?: string; is_active?: boolean; api_key?: string; webhook_secret?: string;
    publishable_key?: string; account_type?: string; surcharge_enabled?: boolean; surcharge_rate?: number;
  }) =>
    api.post<PaymentSettings>('/payments/settings', data),
  // Payment Links
  listLinks: (params: { page?: number; page_size?: number; link_status?: string; client_id?: string; invoice_id?: string }) =>
    api.get<PaginatedResponse<PaymentLink>>('/payments/links', { params }),
  createLink: (data: { invoice_id: string; description?: string; expires_in_days?: number }) =>
    api.post<PaymentLink>('/payments/links', data),
  getLink: (id: string) =>
    api.get<PaymentLink>(`/payments/links/${id}`),
  cancelLink: (id: string) =>
    api.post<PaymentLink>(`/payments/links/${id}/cancel`),
  sendLink: (id: string, data: { recipient_email?: string; message?: string }) =>
    api.post<{ status: string; message: string }>(`/payments/links/${id}/send`, data),
  // Public payment page (no auth)
  getPaymentInfo: (token: string) =>
    api.get<PublicPaymentInfo>(`/payments/pay/${token}`),
  completePayment: (token: string, data: { payer_email?: string; payer_name?: string; processor_reference?: string; paid_amount_cents?: number }) =>
    api.post<PaymentLink>(`/payments/pay/${token}/complete`, data),
  // Summary
  getSummary: () =>
    api.get<PaymentSummary>('/payments/summary'),
  // Webhooks
  listWebhooks: (params: { page?: number; page_size?: number }) =>
    api.get<PaginatedResponse<WebhookEvent>>('/payments/webhooks', { params }),
};

// Alias for convenience
export const paymentsApi = {
  ...paymentProcessingApi,
  saveSettings: paymentProcessingApi.upsertSettings,
};

// SSO
export const ssoApi = {
  // Admin endpoints
  listProviders: () =>
    api.get<SSOProvider[]>('/sso/providers'),
  getProvider: (id: string) =>
    api.get<SSOProvider>(`/sso/providers/${id}`),
  createProvider: (data: {
    name: string; provider_type?: string; client_id?: string; client_secret?: string;
    discovery_url?: string; scopes?: string; email_claim?: string; name_claim?: string;
    role_mapping?: Record<string, string>; auto_create_users?: boolean; default_role?: string;
    saml_entity_id?: string; saml_sso_url?: string; saml_certificate?: string;
  }) =>
    api.post<SSOProvider>('/sso/providers', data),
  updateProvider: (id: string, data: {
    name?: string; provider_type?: string; is_active?: boolean; is_default?: boolean;
    client_id?: string; client_secret?: string; discovery_url?: string;
    authorization_endpoint?: string; token_endpoint?: string; userinfo_endpoint?: string;
    jwks_uri?: string; scopes?: string; email_claim?: string; name_claim?: string;
    role_mapping?: Record<string, string>; auto_create_users?: boolean; default_role?: string;
    saml_entity_id?: string; saml_sso_url?: string; saml_certificate?: string;
  }) =>
    api.put<SSOProvider>(`/sso/providers/${id}`, data),
  deleteProvider: (id: string) =>
    api.delete(`/sso/providers/${id}`),
  discoverEndpoints: (id: string) =>
    api.post<SSOProvider>(`/sso/providers/${id}/discover`),
  testConnection: (id: string) =>
    api.post<{ status: string; message: string }>(`/sso/providers/${id}/test`),
  // Public endpoints
  listPublicProviders: () =>
    api.get<SSOProviderPublic[]>('/sso/providers/public'),
  initiateLogin: (providerId?: string) =>
    api.post<SSOLoginInitiateResponse>('/sso/login/initiate', { provider_id: providerId }),
};

// Accounting / QuickBooks / Xero Integration
export const accountingApi = {
  // Chart of Accounts
  listAccounts: (params: {
    page?: number; page_size?: number; account_type?: AccountType; search?: string; is_active?: boolean;
  }) =>
    api.get<PaginatedResponse<ChartOfAccount>>('/accounting/accounts', { params }),
  createAccount: (data: {
    code: string; name: string; account_type: AccountType; parent_code?: string;
    description?: string; is_active?: boolean; quickbooks_account_name?: string; xero_account_code?: string;
  }) =>
    api.post<ChartOfAccount>('/accounting/accounts', data),
  updateAccount: (id: string, data: {
    code?: string; name?: string; account_type?: AccountType; parent_code?: string;
    description?: string; is_active?: boolean; quickbooks_account_name?: string; xero_account_code?: string;
  }) =>
    api.put<ChartOfAccount>(`/accounting/accounts/${id}`, data),
  deleteAccount: (id: string) =>
    api.delete(`/accounting/accounts/${id}`),
  seedAccounts: (template?: string) =>
    api.post<{ message: string; accounts_created: number }>('/accounting/accounts/seed', { template: template || 'law_firm_default' }),
  // Account Mappings
  listMappings: (params: { source_type?: string }) =>
    api.get<AccountMapping[]>('/accounting/mappings', { params }),
  createMapping: (data: { source_type: string; account_id: string; description?: string; is_default?: boolean }) =>
    api.post<AccountMapping>('/accounting/mappings', data),
  updateMapping: (id: string, data: { source_type?: string; account_id?: string; description?: string; is_default?: boolean }) =>
    api.put<AccountMapping>(`/accounting/mappings/${id}`, data),
  deleteMapping: (id: string) =>
    api.delete(`/accounting/mappings/${id}`),
  // Export
  previewExport: (data: { format: ExportFormat; export_type: string; start_date: string; end_date: string }) =>
    api.post<ExportPreview>('/accounting/export/preview', data),
  generateExport: (data: { format: ExportFormat; export_type: string; start_date: string; end_date: string }) =>
    api.post('/accounting/export/generate', data, { responseType: 'blob' }),
  listExportHistory: (params: { page?: number; page_size?: number }) =>
    api.get<PaginatedResponse<ExportHistory>>('/accounting/export/history', { params }),
};
