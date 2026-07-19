.PHONY: db-up db-down compose-up compose-down compose-logs install migrate revision seed backend frontend test lint

db-up:
	docker compose -f infrastructure/compose.yaml up -d postgres redis

db-down:
	docker compose -f infrastructure/compose.yaml stop postgres redis

compose-up:
	docker compose -f infrastructure/compose.yaml up -d --build

compose-down:
	docker compose -f infrastructure/compose.yaml down

compose-logs:
	docker compose -f infrastructure/compose.yaml logs -f

install:
	cd backend && uv sync
	cd frontend && npm install

migrate:
	cd backend && uv run alembic upgrade head

# usage: make revision m="add something"
revision:
	cd backend && uv run alembic revision --autogenerate -m "$(m)"

seed:
	cd backend && uv run python -m app.seed

backend:
	cd backend && uv run granian --interface asgi --port 8000 --reload app.main:app

frontend:
	cd frontend && npm run dev

test:
	cd backend && uv run pytest tests -q

lint:
	cd backend && uv run ruff check app tests
	cd frontend && npm run build
