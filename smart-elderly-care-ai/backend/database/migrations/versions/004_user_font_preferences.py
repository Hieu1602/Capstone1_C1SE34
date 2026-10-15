"""Add font-size preference columns to user profiles.

Revision ID: 004_user_font_preferences
Revises: 003_user_language_preference
"""

from alembic import op
import sqlalchemy as sa


revision = "004_user_font_preferences"
down_revision = "003_user_language_preference"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("font_size_mode", sa.String(length=20), nullable=False, server_default="system"),
    )
    op.add_column(
        "users",
        sa.Column("custom_font_scale", sa.Integer(), nullable=False, server_default="2"),
    )


def downgrade() -> None:
    op.drop_column("users", "custom_font_scale")
    op.drop_column("users", "font_size_mode")
