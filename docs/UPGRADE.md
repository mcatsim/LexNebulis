# Upgrade Guide

## Standard Upgrade

```bash
# 1. Create a backup first
./lexnebulis.sh backup

# 2. Pull latest changes and rebuild
./lexnebulis.sh update
```

The update command will:
1. Pull the latest code from the repository
2. Rebuild Docker containers
3. Restart services (migrations run automatically on startup)

## Manual Upgrade

If you need more control:

```bash
# 1. Backup
./lexnebulis.sh backup

# 2. Stop services
./lexnebulis.sh stop

# 3. Pull changes
git pull origin main

# 4. Rebuild
docker compose build

# 5. Start (migrations run on startup)
./lexnebulis.sh start
```

## Version-Specific Notes

### v1.0.0
- Initial release. No upgrade path needed.

## Rollback

If an upgrade fails:

```bash
# Stop services
./lexnebulis.sh stop

# Restore from backup
./lexnebulis.sh restore ./backups/lexnebulis_backup_YYYYMMDD_HHMMSS.tar.gz.enc

# Revert code
git checkout v1.0.0  # or the previous version tag

# Rebuild and start
docker compose build
./lexnebulis.sh start
```
