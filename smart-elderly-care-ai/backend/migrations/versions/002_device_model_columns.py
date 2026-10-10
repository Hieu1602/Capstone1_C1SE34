"""Add device metadata columns required by the current ORM model.

Revision ID: 002_device_model_columns
Revises: 001_create_sprint_schema
"""

from alembic import op
import sqlalchemy as sa


revision = "002_device_model_columns"
down_revision = "001_create_sprint_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("sub_title", sa.String(length=255), nullable=True))
    op.add_column(
        "devices",
        sa.Column("device_type", sa.String(length=30), nullable=False, server_default="CAMERA"),
    )
    op.add_column("devices", sa.Column("status_text", sa.String(length=150), nullable=True))
    op.add_column("devices", sa.Column("battery_level", sa.SmallInteger(), nullable=True))
    op.add_column("devices", sa.Column("mac_address", sa.String(length=50), nullable=True))
    op.add_column("devices", sa.Column("ip_address", sa.String(length=45), nullable=True))
    op.add_column("devices", sa.Column("house_id", sa.UUID(), nullable=True))
    op.add_column("devices", sa.Column("group_id", sa.UUID(), nullable=True))
    op.add_column("devices", sa.Column("elderly_id", sa.UUID(), nullable=True))
    op.add_column(
        "devices",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_foreign_key(
        "fk_devices_house_id", "devices", "houses", ["house_id"], ["id"], ondelete="CASCADE"
    )
    op.create_foreign_key(
        "fk_devices_group_id", "devices", "device_groups", ["group_id"], ["id"], ondelete="SET NULL"
    )
    op.create_foreign_key(
        "fk_devices_elderly_id", "devices", "elderly_profiles", ["elderly_id"], ["id"], ondelete="SET NULL"
    )


def downgrade() -> None:
    op.drop_constraint("fk_devices_elderly_id", "devices", type_="foreignkey")
    op.drop_constraint("fk_devices_group_id", "devices", type_="foreignkey")
    op.drop_constraint("fk_devices_house_id", "devices", type_="foreignkey")
    op.drop_column("devices", "updated_at")
    op.drop_column("devices", "elderly_id")
    op.drop_column("devices", "group_id")
    op.drop_column("devices", "house_id")
    op.drop_column("devices", "ip_address")
    op.drop_column("devices", "mac_address")
    op.drop_column("devices", "battery_level")
    op.drop_column("devices", "status_text")
    op.drop_column("devices", "device_type")
    op.drop_column("devices", "sub_title")
