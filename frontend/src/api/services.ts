import api from './client';
import type {
  AuditLogEntry, CalendarEvent, Client, Contact, Document as LegalDocument, Invoice, Matter, Payment,
  TimeEntry, TokenResponse, TrustAccount, TrustLedgerEntry, User,
  PaginatedResponse, SearchResult,
} from '../types';

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<TokenResponse>('/auth/login', { email, password }),
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
