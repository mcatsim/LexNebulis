#!/bin/bash
set -e

echo "LexNebulis Backend Starting..."

# Run database migrations
echo "Running database migrations..."
cd /app
alembic upgrade head

# Start the application
echo "Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers --forwarded-allow-ips="*"
