"""
elderly_profile.py – SQLAlchemy ORM Model cho Hồ sơ Người cao tuổi (Elderly Profile).
Dùng để gán thiết bị theo dõi (đặc biệt là Vòng đeo tay BLE Smartband) trực tiếp với người cao tuổi.
Vị trí: backend/app/models/elderly_profile.py
"""

from __future__ import annotations

from typing import TYPE_CHECKING
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.house import House
    from app.models.device import Device


class ElderlyProfile(Base):
    """
    Bảng lưu trữ thông tin người cao tuổi được chăm sóc trong căn nhà.
    """
    __tablename__ = "elderly_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    house_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("houses.id", ondelete="CASCADE"), nullable=False, index=True
    )

    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)  # ví dụ: 1948
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)   # MALE, FEMALE, OTHER
    
    # Tiền sử bệnh lý (tăng huyết áp, tim mạch, tai biến, loãng xương, rối loạn tiền đình...)
    medical_history: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Số điện thoại liên lạc người thân khẩn cấp
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ---- Relationships ----
    house: Mapped["House"] = relationship("House", back_populates="elderly_profiles")
    devices: Mapped[list["Device"]] = relationship(
        "Device", back_populates="elderly", lazy="selectin"
    )

