.PHONY: db-up db-down install migrate revision seed backend frontend test lint

db-up:
	docker compose up -d db

db-down:
	docker compose down

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
