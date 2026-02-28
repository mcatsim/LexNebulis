.PHONY: setup start stop restart status logs backup restore update dev shell migrate test lint \
	test-backend test-frontend security-scan docker-build docker-scan

setup:
	./legalforge.sh setup

start:
	./legalforge.sh start

stop:
	./legalforge.sh stop

restart:
	./legalforge.sh restart

status:
	./legalforge.sh status

logs:
	./legalforge.sh logs

backup:
	./legalforge.sh backup

restore:
	./legalforge.sh restore $(FILE)

update:
	./legalforge.sh update

dev:
	./legalforge.sh dev

shell:
	./legalforge.sh shell

migrate:
	./legalforge.sh migrate

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
	docker build -t legalforge-backend:scan ./backend
	docker build -t legalforge-frontend:scan ./frontend
	@echo "--- Scanning backend image ---"
	trivy image --severity CRITICAL,HIGH legalforge-backend:scan
	@echo "--- Scanning frontend image ---"
	trivy image --severity CRITICAL,HIGH legalforge-frontend:scan

build:
	docker compose build
