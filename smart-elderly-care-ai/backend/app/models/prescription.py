"""
prescription.py – SQLAlchemy ORM Model for Patient Prescriptions.
Provides PostgreSQL persistence for doctor medical prescriptions and daily reminder schedules.
"""

from __future__ import annotations

from datetime import datetime
import json
from typing import TYPE_CHECKING, List, Optional
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.elderly_profile import ElderlyProfile
    from app.models.user import User


class Prescription(Base):
    """
    Bảng lưu trữ thông tin đơn thuốc điều trị của người cao tuổi.
    Được kê bởi Bác sĩ hoặc nạp từ phác đồ điều trị, đồng bộ với lịch nhắc nhở hàng ngày.
    """
    __tablename__ = "prescriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("elderly_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    doctor_name: Mapped[str | None] = mapped_column(
        String(150), nullable=True
    )

    diagnosis: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Đơn thuốc điều trị"
    )
    general_notes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    medication_name: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    dosage: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    quantity: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    frequency: Mapped[str] = mapped_column(
        String(100), nullable=False, default="Hàng ngày"
    )
    schedule_times_json: Mapped[str] = mapped_column(
        Text, nullable=False, default='["08:00"]'
    )
    instructions: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ACTIVE", index=True
    )
    enable_speaker_reminder: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    patient: Mapped[ElderlyProfile] = relationship(
        "ElderlyProfile", lazy="selectin"
    )
    doctor: Mapped[Optional[User]] = relationship(
        "User", lazy="selectin"
    )

    @property
    def schedule_times(self) -> List[str]:
        if not self.schedule_times_json:
            return ["08:00"]
        try:
            val = json.loads(self.schedule_times_json)
            return val if isinstance(val, list) else [str(val)]
        except Exception:
            return ["08:00"]

    @schedule_times.setter
    def schedule_times(self, times: List[str]) -> None:
        self.schedule_times_json = json.dumps(times or ["08:00"])
