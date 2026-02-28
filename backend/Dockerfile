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
RUN groupadd -r legalforge && useradd -r -g legalforge -d /app -s /sbin/nologin legalforge

WORKDIR /app

# Install Python dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e ".[dev]" 2>/dev/null || pip install --no-cache-dir .

# Copy application code
COPY . .

# Set ownership
RUN chown -R legalforge:legalforge /app

USER legalforge

EXPOSE 8000

# Entrypoint runs migrations then starts uvicorn
COPY scripts/entrypoint-backend.sh /entrypoint.sh
CMD ["/bin/bash", "/entrypoint.sh"]
