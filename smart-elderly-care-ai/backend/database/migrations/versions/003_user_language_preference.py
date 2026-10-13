"""Persist each user's preferred interface language.

Revision ID: 003_user_language_preference
Revises: 002_device_model_columns
"""

from alembic import op
import sqlalchemy as sa


revision = "003_user_language_preference"
down_revision = "002_device_model_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("preferred_language", sa.String(length=5), nullable=False, server_default="vi"),
    )


def downgrade() -> None:
    op.drop_column("users", "preferred_language")
