"""
appointment.py – SQLAlchemy ORM Models for Appointments & Reminders (UC.0).
Provides persistence for doctor visits, follow-up recurrence, and reminder jobs.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.house import House
    from app.models.user import User


class Appointment(Base):
    """
    Bảng lưu trữ thông tin lịch khám và tái khám y tế của người cao tuổi.
    """
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    house_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("houses.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    visit_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="HOME_VISIT"
    )
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=30
    )
    location: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Tại nhà (Khám tại gia)"
    )
    clinical_notes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="UPCOMING", index=True
    )
    cancellation_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    recurrence_pattern: Mapped[str] = mapped_column(
        String(20), nullable=False, default="NONE"
    )
    recurrence_end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    parent_recurring_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    enable_speaker_reminder: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    doctor: Mapped[Optional[User]] = relationship("User", foreign_keys=[doctor_id], lazy="selectin")
    creator: Mapped[Optional[User]] = relationship("User", foreign_keys=[created_by], lazy="selectin")
    house: Mapped[Optional[House]] = relationship("House", foreign_keys=[house_id], lazy="selectin")
    reminders: Mapped[List[AppointmentReminder]] = relationship(
        "AppointmentReminder",
        back_populates="appointment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class AppointmentReminder(Base):
    """
    Bảng lưu các mốc hẹn thông báo nhắc nhở tự động (24h và 2h trước giờ khám).
    """
    __tablename__ = "appointment_reminders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reminder_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    scheduled_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="PENDING", index=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationship
    appointment: Mapped[Appointment] = relationship(
        "Appointment", back_populates="reminders", lazy="selectin"
    )
