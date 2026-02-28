#!/bin/bash
set -e

echo "Initializing MinIO..."

# Wait for MinIO to be ready
until mc alias set legalforge http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" 2>/dev/null; do
    echo "Waiting for MinIO..."
    sleep 2
done

# Create buckets
mc mb --ignore-existing legalforge/legalforge-documents
mc mb --ignore-existing legalforge/legalforge-backups

# Set bucket policy (private by default)
mc anonymous set none legalforge/legalforge-documents
mc anonymous set none legalforge/legalforge-backups

# Enable versioning
mc version enable legalforge/legalforge-documents

echo "MinIO initialized successfully."
