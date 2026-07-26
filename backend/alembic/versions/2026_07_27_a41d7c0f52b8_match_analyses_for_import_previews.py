"""match analyses for import previews

Revision ID: a41d7c0f52b8
Revises: c89c6adab935
Create Date: 2026-07-27 11:04:18.520914

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a41d7c0f52b8'
down_revision: str | None = 'c89c6adab935'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # An analysis of a preview has no vacancy until the user commits the import.
    op.alter_column(
        'vacancy_match_analyses', 'vacancy_id', existing_type=sa.UUID(), nullable=True
    )
    op.add_column(
        'vacancy_match_analyses',
        sa.Column('preview_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    # Preview analyses have no vacancy to fall back on, so they cannot survive
    # the column becoming NOT NULL again.
    op.execute('DELETE FROM vacancy_match_analyses WHERE vacancy_id IS NULL')
    op.drop_column('vacancy_match_analyses', 'preview_snapshot')
    op.alter_column(
        'vacancy_match_analyses', 'vacancy_id', existing_type=sa.UUID(), nullable=False
    )
