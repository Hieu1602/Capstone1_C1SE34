"""Remove profile location tracking fields.

Revision ID: 007_remove_user_location_tracking
Revises: 006_user_location_tracking
"""

from alembic import op
import sqlalchemy as sa


revision = "007_remove_user_location_tracking"
down_revision = "006_user_location_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("users", "location_address")
    op.drop_column("users", "location_longitude")
    op.drop_column("users", "location_latitude")
    op.drop_column("users", "location_enabled")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("location_enabled", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column("users", sa.Column("location_latitude", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("location_longitude", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("location_address", sa.String(length=500), nullable=True))
