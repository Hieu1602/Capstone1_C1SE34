"""
user.py – SQLAlchemy ORM Model cho User (Caregiver / Bác sĩ)
"""
# pyright: reportMissingImports=false

from __future__ import annotations

from typing import TYPE_CHECKING
import uuid
from datetime import datetime

if TYPE_CHECKING:
    from app.models.device import Device
    from app.models.house import House, HouseMember
    from app.models.user_terminal import UserTerminal, UserLoginHistory

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class UserRole(str):
    USER      = "member"
    MEMBER    = "member"
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
    phone: Mapped[str | None] = mapped_column(
        String(20), unique=True, index=True, nullable=True
    )
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="member"
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
    notifications_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    alert_sound_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    critical_alert_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    cchn_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    specialty: Mapped[str | None] = mapped_column(String(255), nullable=True)
    workplace: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    fcm_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships (dùng lazy="select" an toàn, tránh tự động trigger queries khi bảng chưa có)
    devices: Mapped[list["Device"]] = relationship(  # noqa: F821
        "Device", back_populates="owner", lazy="select"
    )
    owned_houses: Mapped[list["House"]] = relationship(  # noqa: F821
        "House", back_populates="owner", cascade="all, delete-orphan", lazy="select"
    )
    house_memberships: Mapped[list["HouseMember"]] = relationship(  # noqa: F821
        "HouseMember", back_populates="user", cascade="all, delete-orphan", lazy="select"
    )
    terminals: Mapped[list["UserTerminal"]] = relationship(  # noqa: F821
        "UserTerminal", back_populates="user", cascade="all, delete-orphan", lazy="select"
    )
    login_histories: Mapped[list["UserLoginHistory"]] = relationship(  # noqa: F821
        "UserLoginHistory", back_populates="user", cascade="all, delete-orphan", lazy="select"
    )
