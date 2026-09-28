"""Create the Sprint database schema.

Revision ID: 001_create_sprint_schema
Revises:
Create Date: 2026-09-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "001_create_sprint_schema"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA = "sprint"


def upgrade() -> None:
    op.execute(sa.text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"'))

    op.create_table(
        "Users",
        sa.Column("UserID", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("PasswordHash", sa.String(255), nullable=False),
        sa.Column("FullName", sa.String(100), nullable=False),
        sa.Column("Phone", sa.String(20), nullable=False),
        sa.Column("Role", sa.String(20), nullable=False),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
        sa.CheckConstraint('"Role" IN (\'Caregiver\', \'Doctor\', \'Admin\')', name="ck_users_role"),
        schema=SCHEMA,
    )

    op.create_table(
        "ElderlyProfiles",
        sa.Column("ElderlyID", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("FullName", sa.String(100), nullable=False),
        sa.Column("DateOfBirth", sa.Date(), nullable=True),
        sa.Column("Gender", sa.String(10), nullable=True),
        sa.Column("ResidentialAddress", sa.Text(), nullable=False),
        sa.Column("HubDeviceID", sa.String(50), nullable=False, unique=True),
        sa.Column("MedicalNotes", sa.Text(), nullable=True),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
        sa.CheckConstraint('"Gender" IS NULL OR "Gender" IN (\'Male\', \'Female\', \'Other\')', name="ck_elderly_profiles_gender"),
        schema=SCHEMA,
    )

    op.create_table(
        "CaregiverElderly",
        sa.Column("MappingID", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("UserID", sa.Integer(), nullable=False),
        sa.Column("ElderlyID", sa.Integer(), nullable=False),
        sa.Column("Relationship", sa.String(50), nullable=False),
        sa.Column("IsPrimaryContact", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.ForeignKeyConstraint(["UserID"], [f'{SCHEMA}.Users.UserID'], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ElderlyID"], [f'{SCHEMA}.ElderlyProfiles.ElderlyID'], ondelete="CASCADE"),
        sa.UniqueConstraint("UserID", "ElderlyID", name="uq_caregiver_elderly_pair"),
        schema=SCHEMA,
    )

    op.create_table(
        "VitalsData",
        sa.Column("RecordedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ElderlyID", sa.Integer(), nullable=False),
        sa.Column("HeartRate", sa.SmallInteger(), nullable=True),
        sa.Column("SpO2", sa.Numeric(4, 1), nullable=True),
        sa.Column("BodyTemperature", sa.Numeric(4, 1), nullable=True),
        sa.Column("IsWearingBand", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.ForeignKeyConstraint(["ElderlyID"], [f'{SCHEMA}.ElderlyProfiles.ElderlyID']),
        sa.PrimaryKeyConstraint("RecordedAt", "ElderlyID", name="pk_vitals_data"),
        sa.CheckConstraint('"SpO2" IS NULL OR ("SpO2" >= 0 AND "SpO2" <= 100)', name="ck_vitals_data_spo2"),
        schema=SCHEMA,
    )
    op.execute(
        'SELECT create_hypertable(\'sprint."VitalsData"\', \'RecordedAt\', if_not_exists => TRUE)'
    )

    op.create_table(
        "Incidents",
        sa.Column("IncidentID", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("ElderlyID", sa.Integer(), nullable=False),
        sa.Column("IncidentType", sa.String(30), nullable=False),
        sa.Column("SeverityLevel", sa.String(20), nullable=False),
        sa.Column("IncidentTime", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
        sa.Column("SensorFusionDetails", postgresql.JSONB(), nullable=True),
        sa.Column("IsSOSDialed", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("Status", sa.String(20), server_default="Triggered", nullable=False),
        sa.ForeignKeyConstraint(["ElderlyID"], [f'{SCHEMA}.ElderlyProfiles.ElderlyID']),
        sa.CheckConstraint('"IncidentType" IN (\'Fall\', \'Immobility\', \'HighFever\', \'RespiratoryDistress\', \'SOS\')', name="ck_incidents_type"),
        sa.CheckConstraint('"SeverityLevel" IN (\'RedAlert\', \'YellowWarning\')', name="ck_incidents_severity"),
        sa.CheckConstraint('"Status" IN (\'Triggered\', \'Acknowledged\', \'Resolved\', \'FalseAlarm\')', name="ck_incidents_status"),
        schema=SCHEMA,
    )

    op.create_table(
        "IncidentMedia",
        sa.Column("MediaID", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("IncidentID", sa.Integer(), nullable=False),
        sa.Column("MediaType", sa.String(20), nullable=False),
        sa.Column("MediaURL", sa.String(500), nullable=False),
        sa.Column("CreatedAt", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
        sa.ForeignKeyConstraint(["IncidentID"], [f'{SCHEMA}.Incidents.IncidentID'], ondelete="CASCADE"),
        sa.CheckConstraint('"MediaType" IN (\'VideoClip5s\', \'SnapshotImage\')', name="ck_incident_media_type"),
        schema=SCHEMA,
    )

    op.create_table(
        "VoiceReminders",
        sa.Column("ReminderID", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("ElderlyID", sa.Integer(), nullable=False),
        sa.Column("ReminderTime", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
        sa.Column("TriggerReason", sa.String(100), nullable=False),
        sa.Column("WasAcknowledged", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.ForeignKeyConstraint(["ElderlyID"], [f'{SCHEMA}.ElderlyProfiles.ElderlyID']),
        schema=SCHEMA,
    )

    op.create_table(
        "EmergencyContacts",
        sa.Column("ContactID", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("ElderlyID", sa.Integer(), nullable=False),
        sa.Column("ContactName", sa.String(100), nullable=False),
        sa.Column("PhoneNumber", sa.String(20), nullable=False),
        sa.Column("PriorityOrder", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["ElderlyID"], [f'{SCHEMA}.ElderlyProfiles.ElderlyID']),
        sa.CheckConstraint('"PriorityOrder" > 0', name="ck_emergency_contacts_priority"),
        schema=SCHEMA,
    )

    op.create_index("ix_caregiver_elderly_user", "CaregiverElderly", ["UserID"], schema=SCHEMA)
    op.create_index("ix_caregiver_elderly_elderly", "CaregiverElderly", ["ElderlyID"], schema=SCHEMA)
    op.create_index("ix_vitals_data_elderly_recorded", "VitalsData", ["ElderlyID", "RecordedAt"], schema=SCHEMA)
    op.create_index("ix_incidents_elderly_time", "Incidents", ["ElderlyID", "IncidentTime"], schema=SCHEMA)
    op.create_index("ix_incident_media_incident", "IncidentMedia", ["IncidentID"], schema=SCHEMA)
    op.create_index("ix_voice_reminders_elderly_time", "VoiceReminders", ["ElderlyID", "ReminderTime"], schema=SCHEMA)
    op.create_index("ix_emergency_contacts_elderly_priority", "EmergencyContacts", ["ElderlyID", "PriorityOrder"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_index("ix_emergency_contacts_elderly_priority", table_name="EmergencyContacts", schema=SCHEMA)
    op.drop_index("ix_voice_reminders_elderly_time", table_name="VoiceReminders", schema=SCHEMA)
    op.drop_index("ix_incident_media_incident", table_name="IncidentMedia", schema=SCHEMA)
    op.drop_index("ix_incidents_elderly_time", table_name="Incidents", schema=SCHEMA)
    op.drop_index("ix_vitals_data_elderly_recorded", table_name="VitalsData", schema=SCHEMA)
    op.drop_index("ix_caregiver_elderly_elderly", table_name="CaregiverElderly", schema=SCHEMA)
    op.drop_index("ix_caregiver_elderly_user", table_name="CaregiverElderly", schema=SCHEMA)

    for table_name in (
        "EmergencyContacts",
        "VoiceReminders",
        "IncidentMedia",
        "Incidents",
        "VitalsData",
        "CaregiverElderly",
        "ElderlyProfiles",
        "Users",
    ):
        op.drop_table(table_name, schema=SCHEMA)
    op.execute(sa.text(f'DROP SCHEMA IF EXISTS "{SCHEMA}"'))
