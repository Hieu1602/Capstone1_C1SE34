"""Private S3 object metadata; URLs are signed only after camera authorization."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Float, ForeignKey, Index, BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CameraRecording(Base):
    __tablename__ = "camera_recordings"
    __table_args__ = (Index("ix_camera_recordings_timeline", "device_id", "started_at", "id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True)
    device_id: Mapped[UUID] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    object_key: Mapped[str] = mapped_column(String(255), unique=True)
    kind: Mapped[str] = mapped_column(String(20))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration: Mapped[float] = mapped_column(Float)
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    # Evidence can arrive before the MQTT incident, so it deliberately has no FK.
    incident_id: Mapped[UUID | None] = mapped_column(index=True)
