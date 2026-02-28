#!/bin/bash
set -e

echo "Initializing MinIO..."

# Wait for MinIO to be ready
until mc alias set lexnebulis http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" 2>/dev/null; do
    echo "Waiting for MinIO..."
    sleep 2
done

# Create buckets
mc mb --ignore-existing lexnebulis/lexnebulis-documents
mc mb --ignore-existing lexnebulis/lexnebulis-backups

# Set bucket policy (private by default)
mc anonymous set none lexnebulis/lexnebulis-documents
mc anonymous set none lexnebulis/lexnebulis-backups

# Enable versioning
mc version enable lexnebulis/lexnebulis-documents

echo "MinIO initialized successfully."
