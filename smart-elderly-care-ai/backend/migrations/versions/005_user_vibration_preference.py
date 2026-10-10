"""Add vibration setting to user profiles.

Revision ID: 005_user_vibration_preference
Revises: 004_user_font_preferences
"""

from alembic import op
import sqlalchemy as sa


revision = "005_user_vibration_preference"
down_revision = "004_user_font_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("vibration_enabled", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("users", "vibration_enabled")
