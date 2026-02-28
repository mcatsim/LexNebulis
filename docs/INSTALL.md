# Installation Guide

## Prerequisites

- **Docker** v24+ and **Docker Compose** v2+
- **2GB RAM** minimum (4GB recommended for production)
- **10GB disk** minimum (more for document storage)
- A Linux server (Ubuntu 22.04+ recommended) or macOS for development

## Quick Install

```bash
# Clone the repository
git clone https://github.com/mcatsim/LexNebulis.git
cd LexNebulis

# Run setup (generates secrets, builds containers, starts services)
chmod +x lexnebulis.sh
./lexnebulis.sh setup
```

The setup script will:
1. Generate a `.env` file with random secrets
2. Build all Docker containers
3. Start all services
4. Run database migrations
5. Create the initial admin user

## Post-Install Configuration

### 1. Set Admin Credentials

Edit `.env` and set your desired admin credentials:

```
FIRST_ADMIN_EMAIL=your.email@firm.com
FIRST_ADMIN_PASSWORD=your-secure-password
```

Then restart: `./lexnebulis.sh restart`

### 2. Configure TLS (Production)

For production, you should enable TLS:

1. Place your SSL certificates in `nginx/certs/`:
   - `fullchain.pem` (certificate + chain)
   - `privkey.pem` (private key)

2. Edit `.env`:
   ```
   ENABLE_TLS=true
   DOMAIN=legal.yourfirm.com
   ```

3. Restart: `./lexnebulis.sh restart`

### 3. Configure Backups

Set a backup encryption key in `.env`:
```
BACKUP_ENCRYPTION_KEY=your-long-random-key
BACKUP_DIR=./backups
```

Schedule automated backups via cron:
```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/LexNebulis && ./lexnebulis.sh backup
```

### 4. Configure SIEM Integration (Optional)

1. Log in as admin
2. Go to Admin > Settings
3. Set `siem_webhook_url` to your SIEM/SOAR endpoint
4. Test with Admin > Security & SIEM > Test Webhook

Or export logs manually via the admin panel in CEF, JSON, or Syslog format.

## Firewall Configuration

Only port 80 (HTTP) and 443 (HTTPS) need to be exposed. All inter-service communication happens on an internal Docker network.

```bash
# UFW example
ufw allow 80/tcp
ufw allow 443/tcp
```

## Troubleshooting

### Services won't start
```bash
./lexnebulis.sh logs    # Check logs
./lexnebulis.sh status  # Check container status
```

### Database connection issues
```bash
# Check if PostgreSQL is healthy
docker compose exec db pg_isready -U lexnebulis
```

### Reset admin password
```bash
# Enter the backend container
./lexnebulis.sh shell
# Then run Python
python -c "
from app.auth.service import hash_password
print(hash_password('new-password'))
"
# Update in database
docker compose exec db psql -U lexnebulis -c "UPDATE users SET password_hash='<hash>' WHERE email='admin@example.com';"
```
