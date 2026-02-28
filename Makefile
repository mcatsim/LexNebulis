.PHONY: setup start stop restart status logs backup restore update dev shell migrate test lint \
	test-backend test-frontend security-scan docker-build docker-scan

setup:
	./lexnebulis.sh setup

start:
	./lexnebulis.sh start

stop:
	./lexnebulis.sh stop

restart:
	./lexnebulis.sh restart

status:
	./lexnebulis.sh status

logs:
	./lexnebulis.sh logs

backup:
	./lexnebulis.sh backup

restore:
	./lexnebulis.sh restore $(FILE)

update:
	./lexnebulis.sh update

dev:
	./lexnebulis.sh dev

shell:
	./lexnebulis.sh shell

migrate:
	./lexnebulis.sh migrate

test:
	@echo "==> Running all tests..."
	$(MAKE) test-backend
	$(MAKE) test-frontend

test-backend:
	@echo "==> Running backend tests with coverage..."
	cd backend && python -m pytest tests/ -v --cov=app --cov-report=term-missing --cov-fail-under=80

test-frontend:
	@echo "==> Running frontend tests with coverage..."
	cd frontend && npx vitest run --coverage

lint:
	@echo "==> Running all linters..."
	@echo "--- Backend lint (ruff) ---"
	cd backend && python -m ruff check app/
	@echo "--- Backend format check (ruff) ---"
	cd backend && python -m ruff format --check app/
	@echo "--- Frontend lint (eslint) ---"
	cd frontend && npm run lint
	@echo "--- Frontend type check (tsc) ---"
	cd frontend && npx tsc --noEmit

security-scan:
	@echo "==> Running security scans..."
	@echo "--- Bandit (Python SAST) ---"
	cd backend && python -m bandit -r app/ --severity-level medium --confidence-level medium || true
	@echo "--- pip-audit (Python dependency vulnerabilities) ---"
	cd backend && pip-audit --desc || true
	@echo "--- npm audit (JS dependency vulnerabilities) ---"
	cd frontend && npm audit --audit-level=high || true

docker-build:
	@echo "==> Building all Docker images..."
	docker compose build

docker-scan:
	@echo "==> Building and scanning Docker images with Trivy..."
	docker build -t lexnebulis-backend:scan ./backend
	docker build -t lexnebulis-frontend:scan ./frontend
	@echo "--- Scanning backend image ---"
	trivy image --severity CRITICAL,HIGH lexnebulis-backend:scan
	@echo "--- Scanning frontend image ---"
	trivy image --severity CRITICAL,HIGH lexnebulis-frontend:scan

build:
	docker compose build
