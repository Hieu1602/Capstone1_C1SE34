"""
user.py – SQLAlchemy ORM Model cho User (Caregiver / Bác sĩ)
"""

from __future__ import annotations

from typing import TYPE_CHECKING
import uuid
from datetime import datetime

if TYPE_CHECKING:
    from app.models.device import Device

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class UserRole(str):
    CAREGIVER = "caregiver"
    DOCTOR    = "doctor"
    ADMIN     = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="caregiver"
    )
    preferred_language: Mapped[str] = mapped_column(
        String(5), nullable=False, default="vi", server_default="vi"
    )
    font_size_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="system", server_default="system"
    )
    custom_font_scale: Mapped[int] = mapped_column(
        Integer, nullable=False, default=2, server_default="2"
    )
    vibration_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    location_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    location_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    fcm_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    devices: Mapped[list["Device"]] = relationship(  # noqa: F821
        "Device", back_populates="owner", lazy="selectin"
    )
