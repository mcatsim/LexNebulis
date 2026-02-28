# LexNebulis Roadmap v2

## Current State (v1.0.0)
Fully deployed Docker Compose stack with 7 services. Core modules: Auth/RBAC, Clients, Contacts, Matters, Documents (MinIO), Calendar, Billing (time + invoices), Trust/IOLTA, Audit Logging (SHA-256 hash chain), SIEM Export, Global Search, Dark Mode.

---

## Phase 1: Dealbreaker Features (v1.1 - v1.3)

These features are **ethically required** or **table-stakes** -- without them, attorneys will not adopt.

### 1.1 Conflict of Interest Checking + Ethical Walls
- Cross-entity search (clients, contacts, matters, opposing parties)
- Fuzzy name matching (Soundex/Metaphone)
- Conflict report with audit trail
- Matter-level access restrictions (ethical walls)
- *ABA Model Rules 1.7-1.10 require this*

### 1.2 Client Portal with Secure Messaging
- Client-facing login (separate from staff)
- View matter status and timeline
- View/download shared documents
- View/pay invoices online
- Threaded secure messaging (attached to matter)
- Email notifications for new messages

### 1.3 Document Templates & Automation
- Variable substitution from matter/client/contact fields
- DOCX template format (python-docx-template)
- Template management UI (upload, categorize, version by practice area)
- Phase 2: Conditional logic in templates

### 1.4 Rules-Based Deadline Calendaring
- Court rules database (federal + top 10 states)
- Auto-generate dependent deadlines from trigger events
- Auto-recalculate when trigger dates change
- Statute of limitations tracking per matter
- Multi-level reminders (90/60/30/7/1 day)

### 1.5 Task Management & Workflow Automation
- Tasks linked to matters with assignments and deadlines
- Workflow templates per practice area
- Auto-generate task sequences when matters are created
- Task dependencies (B cannot start until A completes)
- Checklist support

### 1.6 Two-Factor Authentication
- TOTP-based 2FA (Google Authenticator / Authy compatible)
- Enforce MFA per role (admin required, optional for others)
- Recovery codes

---

## Phase 2: High-Value Differentiators (v1.4 - v1.6)

Features that drive adoption and compete with Clio/PracticePanther.

### 2.1 Email Integration (Outlook / Gmail)
- File emails to matters from inbox (browser extension)
- Store email metadata + content linked to matters
- Auto-suggest matter association by email address
- Built-in email view within application (IMAP)

### 2.2 E-Signature (Self-Hosted)
- PDF annotation with legally-valid audit trails
- Signer identity, timestamp, IP, certificate of completion
- ESIGN Act / UETA compliant
- Alternative: DocuSign/HelloSign API integration

### 2.3 Client Intake / CRM Pipeline
- Leads module with Kanban pipeline
- Public-facing intake forms (embeddable)
- Auto-create contacts/matters on conversion
- Source attribution tracking
- Phase 2: Automated follow-up sequences

### 2.4 Reporting & Analytics Dashboard
- Utilization rate, realization rate, collection rate
- Revenue per attorney, aged AR (30/60/90/120+)
- WIP by matter, matter profitability
- Billable hours by attorney/practice area
- Export to CSV/PDF, scheduled email reports

### 2.5 LEDES Billing / E-Billing
- LEDES 1998B and 1998BI export
- UTBMS activity codes (Litigation, Counseling, IP, Bankruptcy)
- Block-billing detection/prevention
- Per-client billing guidelines (rate caps, task restrictions)

### 2.6 Online Payment Processing
- Integration with Stripe or LawPay API
- Trust-account compliant (fees to operating, not trust)
- Credit/debit, ACH/eCheck support
- Payment links via email/SMS
- Auto-update invoice status on payment

### 2.7 SSO (SAML 2.0 / OIDC)
- Enterprise SSO integration (Azure AD, Okta, Google Workspace)
- SCIM for automated user provisioning
- Extend existing JWT auth

### 2.8 QuickBooks / Xero Integration
- Chart of accounts mapping
- Invoice/payment data export (QBO/IIF/CSV)
- Phase 2: Direct API sync with QuickBooks Online and Xero

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

## Competitive Advantages to Leverage

| Advantage | Why It Matters |
|-----------|---------------|
| **Self-hosted data sovereignty** | Only modern option for on-prem. Criminal defense, national security, M&A firms cannot use cloud SaaS. |
| **SHA-256 audit hash chain** | Enterprise-grade. No competitor offers SIEM-ready audit exports in this market segment. |
| **Encrypted trust data** | Bank account numbers encrypted at rest. Exceeds competitor standards. |
| **Zero vendor lock-in** | No annual contracts, no per-user pricing, no data hostage. Apache 2.0. |
| **On-prem AI** | Self-hosted LLM support means client data never leaves the firm's infrastructure. |
| **Open source** | Community contributions, transparency, no hidden costs. |

---

## Anti-Patterns to Avoid (from competitor reviews)

- No paywalling features behind tiers (all features available to all users)
- No sluggish performance (invest in pagination, caching, query optimization)
- No poor data migration (build robust import tools)
- No weak notifications (multi-channel: in-app, email, push, webhook)
- No complex onboarding (self-serve setup wizards, sensible defaults)
