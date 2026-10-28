"""Add private camera recording metadata without changing existing tables."""
from alembic import op
import sqlalchemy as sa

revision = "008_camera_recordings"
down_revision = "503241ecffea"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("camera_recordings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("device_id", sa.Uuid(), sa.ForeignKey("devices.id"), nullable=False),
        sa.Column("object_key", sa.String(255), nullable=False, unique=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration", sa.Float(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("incident_id", sa.Uuid(), nullable=True))
    op.create_index("ix_camera_recordings_timeline", "camera_recordings", ["device_id", "started_at", "id"])
    op.create_index("ix_camera_recordings_incident_id", "camera_recordings", ["incident_id"])


def downgrade():
    op.drop_table("camera_recordings")
