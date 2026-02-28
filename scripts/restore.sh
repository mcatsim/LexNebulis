#!/bin/bash
set -euo pipefail

# LexNebulis Restore Script
# Restores from an encrypted backup

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup_file>"
    echo "Example: $0 ./backups/lexnebulis_backup_20260227_120000.tar.gz.enc"
    exit 1
fi

BACKUP_FILE="$1"
RESTORE_DIR="/tmp/lexnebulis_restore_$$"

echo "=== LexNebulis Restore ==="
echo "Backup file: ${BACKUP_FILE}"

mkdir -p "${RESTORE_DIR}"

# 1. Decrypt if encrypted
if [[ "${BACKUP_FILE}" == *.enc ]]; then
    if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
        echo "ERROR: BACKUP_ENCRYPTION_KEY required for encrypted backups"
        exit 1
    fi
    echo "Decrypting backup..."
    DECRYPTED="${RESTORE_DIR}/backup.tar.gz"
    openssl enc -aes-256-cbc -d -salt -pbkdf2 \
        -in "${BACKUP_FILE}" \
        -out "${DECRYPTED}" \
        -pass "pass:${BACKUP_ENCRYPTION_KEY}"
    BACKUP_FILE="${DECRYPTED}"
fi

# 2. Extract archive
echo "Extracting backup..."
tar -xzf "${BACKUP_FILE}" -C "${RESTORE_DIR}"

# Find the backup directory
BACKUP_DIR=$(find "${RESTORE_DIR}" -maxdepth 1 -type d -name "lexnebulis_backup_*" | head -1)
if [ -z "${BACKUP_DIR}" ]; then
    BACKUP_DIR="${RESTORE_DIR}"
fi

# 3. Restore database
if [ -f "${BACKUP_DIR}/database.dump" ]; then
    echo "Restoring database..."
    echo "WARNING: This will overwrite the current database. Press Ctrl+C to cancel (5s)..."
    sleep 5
    docker compose exec -T db pg_restore -U "${POSTGRES_USER:-lexnebulis}" \
        -d "${POSTGRES_DB:-lexnebulis}" --clean --if-exists \
        < "${BACKUP_DIR}/database.dump"
    echo "Database restored."
else
    echo "No database backup found."
fi

# 4. Cleanup
rm -rf "${RESTORE_DIR}"

echo "=== Restore Complete ==="
echo "You may need to restart services: docker compose restart"
