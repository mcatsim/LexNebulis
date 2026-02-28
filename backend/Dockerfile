FROM python:3.12-slim AS base

# Install system dependencies for WeasyPrint and general use
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r lexnebulis && useradd -r -g lexnebulis -d /app -s /sbin/nologin lexnebulis

WORKDIR /app

# Copy application code first
COPY . .
COPY scripts/entrypoint-backend.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Install Python dependencies (editable so 'app' is importable)
RUN pip install --no-cache-dir -e . && pip install --no-cache-dir bcrypt==4.0.1 email-validator

# Set ownership
RUN chown -R lexnebulis:lexnebulis /app

USER lexnebulis

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["/bin/bash", "/entrypoint.sh"]
