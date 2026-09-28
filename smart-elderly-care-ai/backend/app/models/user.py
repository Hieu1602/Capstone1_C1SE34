"""
user.py – SQLAlchemy ORM Model cho User (Caregiver / Bác sĩ / Quản trị viên).
Vị trí: backend/app/models/user.py
"""

from __future__ import annotations

from typing import TYPE_CHECKING
import uuid
from datetime import datetime

if TYPE_CHECKING:
    from app.models.device import Device
    from app.models.house import House, HouseMember

from sqlalchemy import Boolean, DateTime, String
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
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    fcm_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ---- Relationships ----
    devices: Mapped[list["Device"]] = relationship(
        "Device", back_populates="owner", lazy="selectin"
    )
    owned_houses: Mapped[list["House"]] = relationship(
        "House", back_populates="owner", lazy="selectin"
    )
    house_memberships: Mapped[list["HouseMember"]] = relationship(
        "HouseMember", back_populates="user", lazy="selectin"
    )
