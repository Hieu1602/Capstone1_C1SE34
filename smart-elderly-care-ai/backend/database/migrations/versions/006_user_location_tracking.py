"""Add geolocation tracking fields to user profiles.

Revision ID: 006_user_location_tracking
Revises: 005_user_vibration_preference
"""

from alembic import op
import sqlalchemy as sa


revision = "006_user_location_tracking"
down_revision = "005_user_vibration_preference"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("location_enabled", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column(
        "users",
        sa.Column("location_latitude", sa.Float(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("location_longitude", sa.Float(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("location_address", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "location_address")
    op.drop_column("users", "location_longitude")
    op.drop_column("users", "location_latitude")
    op.drop_column("users", "location_enabled")
