# LexNebulis Roadmap v3

## Current State (v1.1.0)

Fully deployed Docker Compose stack with 7 services. All Phase 1 and Phase 2 features shipped, plus enterprise integration suite (SAML, WebAuthn, SIEM hardening, Cloud Storage, SCIM). 99 backend tests, 127 frontend tests passing.

**Core modules:** Auth/RBAC, Clients, Contacts, Matters, Documents (MinIO), Calendar, Billing (time + invoices), Trust/IOLTA, Audit Logging (SHA-256 hash chain), Global Search, Dark Mode.

**Phase 1 features (v1.0):** Conflict checking + ethical walls, client portal with secure messaging, document templates & generation, rules-based deadline calendaring, task management & workflows, TOTP 2FA.

**Phase 2 features (v1.0):** Email integration, e-signature, client intake/CRM pipeline, reporting & analytics, LEDES e-billing, online payments (Stripe/LawPay), OIDC SSO, accounting export (IIF/CSV/QBO).

**Enterprise features (v1.1):** SAML 2.0 SSO, WebAuthn/FIDO2 MFA, HMAC webhook signing + real-time syslog + SOAR API, cloud storage link mode (Google Drive/Dropbox/Box/OneDrive), SCIM 2.0 provisioning.

---

## ~~Phase 1: Dealbreaker Features~~ — SHIPPED (v1.0.0)

All items delivered:

- [x] Conflict of Interest Checking + Ethical Walls
- [x] Client Portal with Secure Messaging
- [x] Document Templates & Automation
- [x] Rules-Based Deadline Calendaring
- [x] Task Management & Workflow Automation
- [x] Two-Factor Authentication (TOTP)

---

## ~~Phase 2: High-Value Differentiators~~ — SHIPPED (v1.0.0–v1.1.0)

All items delivered:

- [x] Email Integration (file emails to matters, threading, auto-suggest)
- [x] E-Signature (self-hosted, ESIGN/UETA compliant)
- [x] Client Intake / CRM Pipeline (leads, intake forms, conversion)
- [x] Reporting & Analytics Dashboard (utilization, realization, revenue, profitability)
- [x] LEDES Billing / E-Billing (1998B/2000, UTBMS codes)
- [x] Online Payment Processing (Stripe, LawPay)
- [x] SSO — OIDC (v1.0) + SAML 2.0 (v1.1)
- [x] SCIM 2.0 Provisioning (v1.1)
- [x] QuickBooks / Accounting Integration (IIF/QBO/CSV export)
- [x] WebAuthn / FIDO2 MFA (v1.1)
- [x] SIEM Hardening — HMAC webhooks, real-time syslog, SOAR API (v1.1)
- [x] Cloud Storage — Google Drive, Dropbox, Box, OneDrive (v1.1)

---

## Phase 3: Kubernetes & High Availability (v2.0)

Production-grade deployment for firms needing uptime guarantees.

### 3.1 Helm Chart
- Full Helm chart with values.yaml for staging/production
- Subcharts: CloudNativePG, Bitnami Redis, MinIO Operator
- ConfigMaps, Secrets, Network Policies, PDBs, HPAs

### 3.2 Application Changes for K8s
- Decouple Alembic migrations from entrypoint (Helm pre-upgrade Job)
- Uvicorn 1 worker per pod (HPA handles scaling)
- Structured JSON logging
- Prometheus metrics endpoint (`/metrics`)
- Deep health checks (`/api/health?deep=true`)
- Sentinel-aware Redis URL support
- Non-root frontend container

### 3.3 Data Layer HA
- PostgreSQL: CloudNativePG (primary + 2 sync replicas, PgBouncer sidecar)
- Redis: Sentinel (1 primary + 2 replicas + 3 sentinels)
- MinIO: Distributed mode (4 nodes, erasure coding)

### 3.4 DevSecOps
- Pod Security Standards (restricted)
- Network Policies (default deny, explicit allow)
- External Secrets Operator + HashiCorp Vault
- Image signing (Cosign/Sigstore)
- Admission controller (Kyverno) to reject unsigned/vulnerable images
- K8s RBAC (admin/developer/viewer roles)

### 3.5 Observability
- Prometheus + Grafana (metrics + dashboards)
- Loki + Promtail (logging)
- OpenTelemetry + Grafana Tempo (distributed tracing)
- Alertmanager (PagerDuty/Slack/email)

### 3.6 Backup & DR
- CloudNativePG WAL archiving + scheduled base backups (PITR)
- MinIO site replication or mc mirror
- Velero for cluster-level backup
- Documented DR runbooks

### 3.7 Deployment Strategy
- Rolling updates (maxUnavailable: 0, maxSurge: 1)
- Helm pre-upgrade hooks for migrations
- Backward-compatible migrations only (two-phase pattern)
- PodDisruptionBudgets

---

## Phase 4: AI & Advanced Features (v2.1+)

### 4.1 Pluggable AI Service Layer
- Support self-hosted LLMs (Ollama, vLLM) AND cloud APIs (OpenAI, Anthropic)
- Data sovereignty: all AI processing can happen on-premise
- **Key differentiator vs. Clio/MyCase** -- their AI is cloud-only

### 4.2 AI Features
- Document summarization
- Deadline extraction from court documents
- Time entry description cleanup
- Smart search across all matter content
- Draft generation (engagement letters, correspondence)

### 4.3 Mobile PWA
- Responsive design for all views
- PWA manifest with offline caching
- Push notifications for deadlines and messages
- Camera-to-document upload

### 4.4 Data Import / Migration Tools
- CSV/JSON import for all entities
- Import mapping UI
- Clio and PracticePanther export format importers
- Duplicate detection and merge

### 4.5 API / Webhooks
- Documented, versioned public API
- Webhook system (configurable outbound callbacks on events)
- n8n/Zapier integration

### 4.6 Multi-Tenancy
- Schema-per-tenant isolation
- Per-tenant backup/restore
- Namespace isolation in K8s

---

## Competitive Advantages

| Advantage | Why It Matters |
|-----------|---------------|
| **Self-hosted data sovereignty** | Only modern option for on-prem. Criminal defense, national security, M&A firms cannot use cloud SaaS. |
| **SHA-256 audit hash chain** | Enterprise-grade. No competitor offers SIEM-ready audit exports in this market segment. |
| **Encrypted trust data** | Bank account numbers encrypted at rest. Exceeds competitor standards. |
| **Zero vendor lock-in** | No annual contracts, no per-user pricing, no data hostage. Apache 2.0. |
| **On-prem AI** | Self-hosted LLM support means client data never leaves the firm's infrastructure. |
| **Enterprise SSO + SCIM** | SAML 2.0 + OIDC + SCIM provisioning — matches enterprise SaaS vendors. |
| **Phishing-resistant MFA** | WebAuthn/FIDO2 support exceeds most legal SaaS competitors. |
| **Cloud storage interop** | Link files from Google Drive, Dropbox, Box, OneDrive without full migration. |
| **Open source** | Community contributions, transparency, no hidden costs. |

---

## Anti-Patterns to Avoid (from competitor reviews)

- No paywalling features behind tiers (all features available to all users)
- No sluggish performance (invest in pagination, caching, query optimization)
- No poor data migration (build robust import tools)
- No weak notifications (multi-channel: in-app, email, push, webhook)
- No complex onboarding (self-serve setup wizards, sensible defaults)
