# Changelog

All notable changes to LexNebulis are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased] — v1.1.0-dev

### Added

- **SAML 2.0 SSO** — Full SAML 2.0 single sign-on alongside existing OIDC. SP metadata endpoint (`/api/sso/saml/metadata/{id}`), IdP metadata parsing (URL and XML), SAML attribute mapping for email/name/groups, signed AuthnRequest support, and Want Assertions Signed option. New dependency: `python3-saml>=1.16.0`. (Migration 015)
- **WebAuthn/FIDO2 MFA** — Phishing-resistant multi-factor authentication using security keys (YubiKey), platform authenticators (Touch ID, Windows Hello), and other FIDO2 devices. Redis-based challenge storage with 5-minute TTL, credential management UI, and simultaneous TOTP + WebAuthn support with method picker at login. New dependency: `webauthn>=2.1.0`. New env vars: `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`. (Migration 016)
- **SIEM Hardening** — HMAC-SHA256 webhook signing (`X-LexNebulis-Signature` + `X-LexNebulis-Timestamp` headers) for authenticated event delivery. Real-time syslog sender supporting UDP, TCP, and TLS (RFC 5424). Celery-based async event delivery with exponential backoff retry. Admin UI for SIEM configuration. (Migration 017)
- **SOAR Response API** — Emergency security action endpoints: disable user, revoke all sessions for a user, lock matter (ethical wall), and force global logout. All actions audit-logged at critical/high severity. Available at `/api/admin/security/*`.
- **Cloud Storage Link Mode** — Browse, link, import, and export files from Google Drive, Dropbox, Box, and OneDrive. OAuth2 flows with provider abstraction layer, periodic Celery token refresh (every 30 minutes), matter-linked cloud file references, and file browser modal UI. New env vars for each provider's OAuth client ID/secret. (Migration 018)
- **SCIM 2.0 Provisioning** — RFC 7643/7644-compliant automated user provisioning via `/api/scim/v2/Users`. Bearer token authentication, full CRUD with PATCH support, `userName eq "..."` filter, ServiceProviderConfig/ResourceTypes/Schemas discovery endpoints. Admin token management UI. (Migration 019)

### Changed

- `authenticate_user()` now returns `mfa_methods` list when 2FA is required (supports both `totp` and `webauthn`).
- Login page shows method picker when user has multiple MFA methods configured.
- Settings page now includes WebAuthn credential management alongside TOTP setup.
- Admin sidebar adds SIEM, Cloud Storage, and SCIM navigation items.
- Celery autodiscover expanded to include `app.common` and `app.cloud_storage` modules.
- Audit `ACTION_SEVERITY` dict expanded with SAML, WebAuthn, and SOAR action entries.

### Fixed

- Corrected WebAuthn dependency name (`webauthn` not `py-webauthn`) in pyproject.toml.

### Infrastructure

- 5 new Alembic migrations (015–019)
- 2 new Python dependencies
- 9 new environment variables (3 WebAuthn + 8 cloud storage OAuth, all optional)
- ~58 files changed, ~6,800 lines added
- New backend modules: `cloud_storage/` (with 4 provider implementations), `scim/`
- New backend files: `common/syslog_sender.py`, `common/celery_tasks.py`, `admin/models.py`, `admin/schemas.py`

---

## [1.0.0] — 2025-12-15

### Added

- **Core Platform** — Client management, matter/case management, contact management with full CRUD, search, and pagination.
- **Document Management** — MinIO-backed document storage with versioning, tagging, and presigned download URLs.
- **Time Tracking & Billing** — Timer-based and manual time entry, invoice generation, payment recording, and batch billing.
- **Trust / IOLTA Accounting** — Per-client ledgers, three-way reconciliation, overdraft safeguards, and deposit/disbursement tracking.
- **Calendar & Deadlines** — Court dates, statute-of-limitations calculations, rule-based deadline generation, and calendar events.
- **Conflict Checking** — Multi-algorithm detection using Soundex, Metaphone, and Levenshtein distance with ethical wall support.
- **Task Management & Workflows** — Task assignment, dependencies, checklists, and reusable workflow templates.
- **Document Templates** — Jinja2 `.docx` template engine with variable extraction, preview, and document generation.
- **Client Portal** — Self-service portal for clients to view matters, invoices, documents, and send messages.
- **Client Intake & Leads** — Intake forms, lead scoring, pipeline management, and client conversion.
- **E-Billing & LEDES** — LEDES 1998B/2000 export, UTBMS activity/expense codes, billing guidelines compliance.
- **E-Signature** — In-platform electronic signature requests with audit trail and certificate of completion.
- **Email Integration** — File emails to matters with threading, attachment extraction, and matter suggestion.
- **Reports & Analytics** — Utilization, realization, collection, revenue, profitability, and billable hours reports with CSV export.
- **SSO / OIDC** — Single sign-on via OpenID Connect (Azure AD, Okta, Google Workspace).
- **Payment Processing** — Stripe and LawPay integrations for credit card and ACH payments.
- **Accounting Integration** — Export to QuickBooks (IIF/QBO) and CSV with chart of accounts mapping.
- **SIEM Integration** — Audit log export in CEF, JSON, and Syslog formats with webhook delivery.
- **Two-Factor Authentication** — TOTP-based 2FA with QR code enrollment and recovery codes.
- **Audit Trail** — SHA-256 hash chain audit log for tamper-evident, nonrepudiable event recording.
- **RBAC** — Four built-in roles (Admin, Attorney, Paralegal, Billing Clerk) with endpoint-level enforcement.
- **WCAG 2.1 AA / Section 508 Compliance** — Accessible UI with ARIA labels, keyboard navigation, and skip links.
- **Docker Compose Deployment** — Production-ready Docker Compose with Nginx, PostgreSQL, MinIO, Redis, and Celery.
- **CI/CD Pipeline** — GitHub Actions workflows for CI, security scanning, deployment, and releases.

[Unreleased]: https://github.com/mcatsim/LexNebulis/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mcatsim/LexNebulis/releases/tag/v1.0.0
