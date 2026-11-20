"""Create prescriptions table.

Revision ID: 009_create_prescriptions_table
Revises: 008_camera_recordings
Create Date: 2026-11-20
"""
from alembic import op
import sqlalchemy as sa

revision = "009_create_prescriptions_table"
down_revision = "008_camera_recordings"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "prescriptions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("patient_id", sa.Uuid(), sa.ForeignKey("elderly_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doctor_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("doctor_name", sa.String(150), nullable=True),
        sa.Column("diagnosis", sa.String(255), nullable=False, server_default="Đơn thuốc điều trị"),
        sa.Column("general_notes", sa.Text(), nullable=True),
        sa.Column("medication_name", sa.String(255), nullable=False),
        sa.Column("dosage", sa.String(100), nullable=False),
        sa.Column("quantity", sa.String(50), nullable=True),
        sa.Column("frequency", sa.String(100), nullable=False, server_default="Hàng ngày"),
        sa.Column("schedule_times_json", sa.Text(), nullable=False, server_default='["08:00"]'),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("enable_speaker_reminder", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_prescriptions_patient_id", "prescriptions", ["patient_id"])
    op.create_index("ix_prescriptions_doctor_id", "prescriptions", ["doctor_id"])
    op.create_index("ix_prescriptions_status", "prescriptions", ["status"])
    op.create_index("ix_prescriptions_dates", "prescriptions", ["start_date", "end_date"])


def downgrade():
    op.drop_table("prescriptions")
