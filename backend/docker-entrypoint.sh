#!/bin/sh
set -eu

alembic upgrade head

exec granian \
    --interface asgi \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "${BACKEND_WORKERS:-2}" \
    app.main:app

