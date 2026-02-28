#!/bin/bash
set -e

echo "=== LexNebulis Backend ==="
echo "Running database migrations..."
cd /app
alembic upgrade head

echo "Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers --forwarded-allow-ips="*"
