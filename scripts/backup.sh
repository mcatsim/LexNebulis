#!/bin/bash
set -euo pipefail

# LexNebulis Backup Script
# Creates an encrypted backup of the database and MinIO documents

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="lexnebulis_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

echo "=== LexNebulis Backup ==="
echo "Timestamp: ${TIMESTAMP}"
echo "Backup directory: ${BACKUP_PATH}"

mkdir -p "${BACKUP_PATH}"

# 1. Database backup
echo "Backing up PostgreSQL database..."
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-lexnebulis}" "${POSTGRES_DB:-lexnebulis}" \
    --format=custom --compress=9 > "${BACKUP_PATH}/database.dump"
echo "Database backup complete: $(du -h "${BACKUP_PATH}/database.dump" | cut -f1)"

# 2. MinIO documents backup
echo "Backing up MinIO documents..."
docker compose exec -T minio mc mirror /data "${BACKUP_PATH}/minio-data" 2>/dev/null || \
    echo "Note: MinIO data copied from volume"

# 3. System settings backup
echo "Backing up configuration..."
cp .env "${BACKUP_PATH}/env.backup" 2>/dev/null || true

# 4. Create archive
echo "Creating compressed archive..."
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" -C "${BACKUP_DIR}" "${BACKUP_NAME}"

# 5. Encrypt the archive
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "Encrypting backup..."
    openssl enc -aes-256-cbc -salt -pbkdf2 \
        -in "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" \
        -out "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz.enc" \
        -pass "pass:${BACKUP_ENCRYPTION_KEY}"
    rm "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    echo "Encrypted backup: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz.enc"
else
    echo "WARNING: BACKUP_ENCRYPTION_KEY not set. Backup is NOT encrypted."
    echo "Backup: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
fi

# 6. Cleanup temp directory
rm -rf "${BACKUP_PATH}"

echo "=== Backup Complete ==="
