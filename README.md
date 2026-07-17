# Job Search CRM

Personal job search tracker: vacancies, applications, CV versions, companies, contacts, interviews, follow-up tasks.

**Stack**: FastAPI (served by [Granian](https://github.com/emmett-framework/granian)) + SQLAlchemy 2 + PostgreSQL + Alembic (backend), React + TypeScript + Vite + TanStack Query + Tailwind v4 (frontend).

## Quick start

Requirements: Docker, [uv](https://docs.astral.sh/uv/), Node.js 20+.

```bash
# 1. Start PostgreSQL (pg_trgm extension is installed automatically)
make db-up

# 2. Install dependencies
make install

# 3. Configure env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 4. Apply migrations and seed demo data
make migrate
make seed

# 5. Run (two terminals)
make backend    # http://localhost:8000  (docs: /docs)
make frontend   # http://localhost:5173
```

Demo login: `demo@example.com` / `demo1234`.

## Project layout

```
backend/
  app/
    core/          # config, database (sync SQLAlchemy), security (argon2 + JWT)
    common/        # enums, model mixins, normalization helpers, tags/attachments models
    <feature>/     # models.py / schemas.py / router.py / service.py per feature:
                   # auth, users, companies, vacancies, applications, cv_versions,
                   # contacts, interviews, tasks, notes, analytics
    models.py      # registry importing every model (Alembic / mapper configuration)
    seed.py        # demo data
  alembic/         # migrations (autogenerate against app/models.py)
  uploads/         # CV files in dev (swap for S3-compatible storage later)
frontend/
  src/
    app/           # router.tsx, providers.tsx
    shared/        # api client, ui kit (shadcn-style), layout, lib
    features/      # auth, dashboard, vacancies, applications, ... (one folder per screen group)
```

## Tests

```bash
make test   # backend pytest suite (creates jobsearch_test DB automatically)
make lint   # ruff + frontend typecheck/build
```

## Migrations

```bash
make revision m="describe change"   # autogenerate
make migrate                        # upgrade head
```

## Conventions

- All domain tables have UUID PKs, `user_id` owner FK, `created_at`/`updated_at`; most have `deleted_at` (soft delete).
- Enums are stored as varchar and validated at the Pydantic boundary (no ALTER TYPE migrations).
- Notes, tasks, tags, attachments link to entities polymorphically via `entity_type` + `entity_id`.
- Vacancies store `normalized_title` / `normalized_url` for duplicate detection (pg_trgm fuzzy match).
