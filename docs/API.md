# API Documentation

LexNebulis exposes a RESTful API at `/api`. Interactive documentation is available at `/api/docs` (Swagger UI) when the backend is running.

## Authentication

All endpoints (except `/api/auth/login` and `/api/health`) require a JWT bearer token.

### Login
```
POST /api/auth/login
Body: { "email": "user@example.com", "password": "password" }
Response: { "access_token": "...", "refresh_token": "...", "token_type": "bearer" }
```

### Refresh Token
```
POST /api/auth/refresh
Body: { "refresh_token": "..." }
Response: { "access_token": "...", "refresh_token": "...", "token_type": "bearer" }
```

Access tokens expire in 15 minutes. Refresh tokens expire in 7 days and are rotated on each use.

## Endpoints

### Health
- `GET /api/health` - Health check (no auth required)

### Auth & Users
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me/password` - Change password
- `GET /api/auth/users` - List users (admin only)
- `POST /api/auth/users` - Create user (admin only)
- `PUT /api/auth/users/{id}` - Update user (admin only)

### Clients
- `GET /api/clients?page=1&page_size=25&search=&status=` - List clients
- `GET /api/clients/{id}` - Get client
- `POST /api/clients` - Create client
- `PUT /api/clients/{id}` - Update client
- `DELETE /api/clients/{id}` - Delete client (admin only)

### Contacts
- `GET /api/contacts?page=1&search=&role=` - List contacts
- `GET /api/contacts/{id}` - Get contact
- `POST /api/contacts` - Create contact
- `PUT /api/contacts/{id}` - Update contact
- `DELETE /api/contacts/{id}` - Delete contact (admin only)

### Matters
- `GET /api/matters?page=1&search=&status=&client_id=&attorney_id=&litigation_type=` - List matters
- `GET /api/matters/{id}` - Get matter
- `POST /api/matters` - Create matter
- `PUT /api/matters/{id}` - Update matter
- `DELETE /api/matters/{id}` - Delete matter (admin only)
- `POST /api/matters/{id}/contacts` - Add contact to matter
- `DELETE /api/matters/{id}/contacts/{mc_id}` - Remove contact from matter

### Documents
- `GET /api/documents?matter_id=&search=` - List documents
- `GET /api/documents/{id}` - Get document metadata
- `POST /api/documents/upload` - Upload document (multipart form)
- `GET /api/documents/{id}/download` - Download document (redirect to signed URL)
- `DELETE /api/documents/{id}` - Delete document

### Calendar
- `GET /api/calendar?start_date=&end_date=&matter_id=&assigned_to=&event_type=` - List events
- `GET /api/calendar/{id}` - Get event
- `POST /api/calendar` - Create event
- `PUT /api/calendar/{id}` - Update event
- `DELETE /api/calendar/{id}` - Delete event

### Billing
- `GET /api/billing/time-entries?matter_id=&user_id=&start_date=&end_date=&billable=` - List time entries
- `POST /api/billing/time-entries` - Create time entry
- `PUT /api/billing/time-entries/{id}` - Update time entry
- `DELETE /api/billing/time-entries/{id}` - Delete time entry
- `GET /api/billing/invoices?client_id=&matter_id=&invoice_status=` - List invoices
- `GET /api/billing/invoices/{id}` - Get invoice
- `POST /api/billing/invoices` - Create invoice
- `GET /api/billing/invoices/{id}/payments` - List payments
- `POST /api/billing/payments` - Record payment

### Trust/IOLTA
- `GET /api/trust/accounts` - List trust accounts
- `POST /api/trust/accounts` - Create trust account
- `GET /api/trust/accounts/{id}/ledger?client_id=` - List ledger entries
- `POST /api/trust/ledger` - Create ledger entry (deposit/disbursement)
- `POST /api/trust/reconciliations` - Create reconciliation

### Search
- `GET /api/search?q=query&limit=20` - Global search across all entities

### Admin
- `GET /api/admin/audit-logs?entity_type=&action=&user_id=&severity=&start_date=&end_date=` - List audit logs
- `GET /api/admin/audit-logs/verify-chain?limit=1000` - Verify audit hash chain integrity
- `GET /api/admin/audit-logs/export/json` - Export as structured JSON
- `GET /api/admin/audit-logs/export/cef` - Export as CEF format
- `GET /api/admin/audit-logs/export/syslog` - Export as RFC 5424 syslog
- `POST /api/admin/audit-logs/webhook/test` - Test SOAR webhook
- `GET /api/admin/settings` - List system settings
- `PUT /api/admin/settings/{key}` - Update system setting

## Pagination

All list endpoints return paginated responses:
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 25,
  "total_pages": 4
}
```

## RBAC

| Resource | Admin | Attorney | Paralegal | Billing Clerk |
|----------|-------|----------|-----------|---------------|
| Users | CRUD | Read self | Read self | Read self |
| Clients | CRUD | CRUD | CRUD | Read |
| Matters | CRUD | CRUD | CRUD | Read |
| Contacts | CRUD | CRUD | CRUD | Read |
| Documents | CRUD | CRUD | CRUD | Read |
| Calendar | CRUD | CRUD | CRUD | Read |
| Time Entries | CRUD | CRUD own | CRUD own | Read |
| Invoices | CRUD | Read | Read | CRUD |
| Trust | CRUD | Read | Read | CRUD |
| Audit Logs | Read | - | - | - |
| Settings | CRUD | - | - | - |
