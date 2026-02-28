# LexNebulis

**Self-hosted legal practice management for small law firms.**

LexNebulis is a free, open-source platform that gives attorneys and paralegals complete control over their practice data. Deploy it on your own infrastructure with a single command.

## Features

- **Client Management** - Track individuals and organizations with full contact details
- **Matter/Case Management** - Organize cases by type, jurisdiction, status, and assigned attorney
- **Document Management** - Upload, version, and organize documents with S3-compatible encrypted storage
- **Calendar & Deadlines** - Court dates, filing deadlines, meetings with conflict detection
- **Time Tracking** - Running timer, manual entry, billable/non-billable classification
- **Billing & Invoicing** - Generate invoices from time entries, track payments, PDF generation
- **Trust/IOLTA Accounting** - Deposit, disburse, and reconcile client trust accounts
- **Role-Based Access Control** - Admin, Attorney, Paralegal, and Billing Clerk roles
- **Audit Trail** - Immutable hash-chain audit log with nonrepudiation guarantees
- **SIEM/SOAR Integration** - Export logs in CEF, JSON, and Syslog formats; webhook push
- **Global Search** - Search across clients, matters, contacts, and documents
- **Dark Mode** - Professional UI with light and dark themes

## Quick Start

```bash
git clone https://github.com/mcatsim/LexNebulis.git
cd LexNebulis
chmod +x lexnebulis.sh
./lexnebulis.sh setup
```

LexNebulis will be available at `http://localhost`. Default admin credentials are in your `.env` file.

## Requirements

- Docker and Docker Compose v2
- 2GB RAM minimum (4GB recommended)
- 10GB disk space minimum

## Architecture

| Component | Technology |
|-----------|-----------|
| Frontend | React 18 + TypeScript + Mantine v7 |
| Backend | Python 3.12 + FastAPI |
| Database | PostgreSQL 16 |
| File Storage | MinIO (S3-compatible) |
| Task Queue | Celery + Redis |
| Reverse Proxy | Nginx |

All services run as Docker containers. Only Nginx is exposed externally.

## Security

- Encryption at rest (PostgreSQL + MinIO SSE)
- TLS termination via Nginx
- JWT authentication with refresh token rotation
- Bcrypt password hashing
- Account lockout after failed attempts
- Rate-limited login endpoint
- Audit trail with SHA-256 hash chain
- All containers run as non-root
- Field-level encryption for sensitive data (bank account numbers, etc.)

## CLI Commands

```bash
./lexnebulis.sh setup      # First-time setup
./lexnebulis.sh start      # Start all services
./lexnebulis.sh stop       # Stop all services
./lexnebulis.sh backup     # Create encrypted backup
./lexnebulis.sh restore    # Restore from backup
./lexnebulis.sh update     # Pull updates and rebuild
./lexnebulis.sh dev        # Development mode with hot reload
./lexnebulis.sh logs       # View logs
./lexnebulis.sh status     # Check service status
```

## Documentation

- [Installation Guide](docs/INSTALL.md)
- [Upgrade Guide](docs/UPGRADE.md)
- [API Documentation](docs/API.md)

## License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

Free for commercial use. Revenue model: professional services (setup, support, managed hosting, custom development).

## Contributing

Contributions welcome! Please open an issue first to discuss proposed changes.
