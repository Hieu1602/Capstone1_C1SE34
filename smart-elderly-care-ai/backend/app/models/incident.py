"""
incident.py – ORM Model cho sự kiện cảnh báo khẩn cấp.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
import uuid
from datetime import datetime

if TYPE_CHECKING:
    from app.models.device import Device

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False, index=True
    )

    # ---- Alert Info ----
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)   # FALL_DETECTED, LOW_SPO2…
    alert_level: Mapped[str] = mapped_column(String(20), nullable=False)  # LOW/MEDIUM/HIGH/CRITICAL
    message: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    sources: Mapped[str | None] = mapped_column(String(255), nullable=True)  # JSON list

    # ---- Evidence ----
    video_clip_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # ---- Status ----
    is_acknowledged: Mapped[bool] = mapped_column(default=False)
    acknowledged_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Relationships
    device: Mapped["Device"] = relationship("Device", back_populates="incidents")  # noqa: F821
