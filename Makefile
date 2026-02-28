.PHONY: setup start stop restart status logs backup restore update dev shell migrate test lint

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
	cd backend && python -m pytest tests/ -v
	cd frontend && npm test

lint:
	cd backend && python -m ruff check app/
	cd frontend && npm run lint

build:
	docker compose build
