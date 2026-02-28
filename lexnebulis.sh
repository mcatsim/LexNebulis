#!/bin/bash
set -euo pipefail

# LexNebulis CLI
# Usage: ./lexnebulis.sh [command]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

show_help() {
    cat << 'EOF'
LexNebulis - Legal Practice Management Platform

Usage: ./lexnebulis.sh [command]

Commands:
  setup       First-time setup: generate .env, build containers, start services
  start       Start all services
  stop        Stop all services
  restart     Restart all services
  status      Show status of all services
  logs        Show logs (follow mode)
  backup      Create an encrypted backup
  restore     Restore from a backup file
  update      Pull latest images and rebuild
  dev         Start in development mode (with hot reload)
  shell       Open a shell in the backend container
  migrate     Run database migrations
  help        Show this help message

Examples:
  ./lexnebulis.sh setup        # First-time setup
  ./lexnebulis.sh start        # Start the platform
  ./lexnebulis.sh backup       # Create backup
  ./lexnebulis.sh restore ./backups/backup.tar.gz.enc
EOF
}

cmd_setup() {
    echo "=== LexNebulis Setup ==="

    # Generate .env if it doesn't exist
    if [ ! -f .env ]; then
        echo "Generating .env from .env.example..."
        cp .env.example .env

        # Generate random secrets
        SECRET_KEY=$(openssl rand -hex 64)
        POSTGRES_PASSWORD=$(openssl rand -hex 24)
        MINIO_PASSWORD=$(openssl rand -hex 24)
        FIELD_ENC_KEY=$(openssl rand -hex 32)
        BACKUP_KEY=$(openssl rand -hex 32)

        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/CHANGE_ME_generate_with_openssl_rand_hex_64/$SECRET_KEY/" .env
            sed -i '' "s/CHANGE_ME_postgres_password/$POSTGRES_PASSWORD/g" .env
            sed -i '' "s/CHANGE_ME_minio_password/$MINIO_PASSWORD/" .env
            sed -i '' "s/CHANGE_ME_generate_with_openssl_rand_hex_32/$FIELD_ENC_KEY/" .env
            sed -i '' "s/CHANGE_ME_backup_encryption_key/$BACKUP_KEY/" .env
            sed -i '' "s/CHANGE_ME_admin_password/$(openssl rand -hex 16)/" .env
        else
            sed -i "s/CHANGE_ME_generate_with_openssl_rand_hex_64/$SECRET_KEY/" .env
            sed -i "s/CHANGE_ME_postgres_password/$POSTGRES_PASSWORD/g" .env
            sed -i "s/CHANGE_ME_minio_password/$MINIO_PASSWORD/" .env
            sed -i "s/CHANGE_ME_generate_with_openssl_rand_hex_32/$FIELD_ENC_KEY/" .env
            sed -i "s/CHANGE_ME_backup_encryption_key/$BACKUP_KEY/" .env
            sed -i "s/CHANGE_ME_admin_password/$(openssl rand -hex 16)/" .env
        fi

        echo "Generated .env with random secrets."
        echo ""
        echo "IMPORTANT: Edit .env to set:"
        echo "  - FIRST_ADMIN_EMAIL (admin login email)"
        echo "  - FIRST_ADMIN_PASSWORD (admin login password)"
        echo "  - DOMAIN (your server domain)"
        echo ""
    else
        echo ".env already exists, skipping generation."
    fi

    # Create necessary directories
    mkdir -p backups nginx/certs

    # Build and start
    echo "Building containers..."
    docker compose build

    echo "Starting services..."
    docker compose up -d

    echo ""
    echo "=== Setup Complete ==="
    echo "LexNebulis is starting up at http://localhost"
    echo ""
    echo "Default admin credentials are in your .env file."
    echo "Please change the admin password after first login."
}

cmd_start() {
    echo "Starting LexNebulis..."
    docker compose up -d
    echo "LexNebulis is running at http://localhost"
}

cmd_stop() {
    echo "Stopping LexNebulis..."
    docker compose down
    echo "LexNebulis stopped."
}

cmd_restart() {
    echo "Restarting LexNebulis..."
    docker compose restart
    echo "LexNebulis restarted."
}

cmd_status() {
    docker compose ps
}

cmd_logs() {
    docker compose logs -f "${@}"
}

cmd_backup() {
    source .env 2>/dev/null || true
    bash scripts/backup.sh
}

cmd_restore() {
    if [ $# -lt 1 ]; then
        echo "Usage: ./lexnebulis.sh restore <backup_file>"
        exit 1
    fi
    source .env 2>/dev/null || true
    bash scripts/restore.sh "$1"
}

cmd_update() {
    echo "Updating LexNebulis..."
    git pull
    docker compose build
    docker compose up -d
    echo "Update complete."
}

cmd_dev() {
    echo "Starting LexNebulis in development mode..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
}

cmd_shell() {
    docker compose exec backend /bin/bash
}

cmd_migrate() {
    docker compose exec backend alembic upgrade head
}

# Main dispatch
case "${1:-help}" in
    setup)    cmd_setup ;;
    start)    cmd_start ;;
    stop)     cmd_stop ;;
    restart)  cmd_restart ;;
    status)   cmd_status ;;
    logs)     shift; cmd_logs "$@" ;;
    backup)   cmd_backup ;;
    restore)  shift; cmd_restore "$@" ;;
    update)   cmd_update ;;
    dev)      cmd_dev ;;
    shell)    cmd_shell ;;
    migrate)  cmd_migrate ;;
    help|*)   show_help ;;
esac
