from __future__ import annotations

from typing import TYPE_CHECKING
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.device import Device


class VitalSign(Base):
    """
    TimescaleDB hypertable – Phân vùng theo cột 'time'.
    Hypertable được tạo qua Alembic migration:
        SELECT create_hypertable('vital_signs', 'time');
    """

    __tablename__ = "vital_signs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False, index=True
    )

    # ---- Vital Signs ----
    heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)      # bpm
    spo2: Mapped[int | None] = mapped_column(Integer, nullable=True)            # %
    skin_temp_max: Mapped[float | None] = mapped_column(Float, nullable=True)   # °C
    person_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fall_detected: Mapped[bool | None] = mapped_column(nullable=True)

    # Relationship
    device: Mapped["Device"] = relationship("Device", back_populates="vital_signs")  # noqa: F821
