"""Add doctor CCHN, specialty, and workplace fields to users.

Revision ID: 007_doctor_cchn_fields
Revises: 006_user_location_tracking
"""

from alembic import op
import sqlalchemy as sa


revision = "007_doctor_cchn_fields"
down_revision = "006_user_location_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("cchn_number", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("specialty", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("workplace", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "workplace")
    op.drop_column("users", "specialty")
    op.drop_column("users", "cchn_number")

