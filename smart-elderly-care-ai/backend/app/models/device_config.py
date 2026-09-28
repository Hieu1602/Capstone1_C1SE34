"""
device_config.py – SQLAlchemy ORM Model cho Cấu hình Chi tiết Thiết bị (DeviceConfig).
Tách biệt cấu hình chuyên sâu của từng loại thiết bị:
- Camera AI: stream_url (RTSP/WebRTC), resolution (2K/FHD/SD), is_sleep, is_ai_protect, two_way_audio.
- Vòng đeo tay y tế: hr_threshold_high, hr_threshold_low, spo2_threshold_low, fall_impact_threshold.
- Edge AI Hub: immobility_seconds, mqtt_topic, ai_model_version.
Vị trí: backend/app/models/device_config.py
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.device import Device


class DeviceConfig(Base):
    """
    Cấu hình chi tiết tham số hoạt động của thiết bị (Quan hệ 1 - 1 với devices).
    """
    __tablename__ = "device_configs"

    # device_id vừa là Primary Key vừa là Foreign Key (1 - 1)
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # ---- 1. Cấu hình Camera AI ----
    # URL luồng RTSP / HLS / WebRTC của camera (vd: rtsp://admin:123456@192.168.1.4:554/live)
    stream_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Độ phân giải ghi hình: 2K, FHD, SD
    resolution: Mapped[str] = mapped_column(String(20), default="2K", nullable=False)
    # Chế độ ngủ bảo vệ quyền riêng tư (Privacy/Sleep Mode)
    is_sleep: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Bật/tắt AI YOLOv8-Pose nhận diện té ngã tự động
    is_ai_protect: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Hỗ trợ đàm thoại 2 chiều qua loa & micro camera
    has_two_way_audio: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ---- 2. Cấu hình Vòng đeo tay y tế (Smartband) ----
    # Ngưỡng nhịp tim cảnh báo cao (default: 120 bpm)
    hr_threshold_high: Mapped[int] = mapped_column(Integer, default=120, nullable=False)
    # Ngưỡng nhịp tim cảnh báo thấp (default: 50 bpm)
    hr_threshold_low: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    # Ngưỡng nồng độ oxy trong máu SpO2 cảnh báo nguy hiểm (default: 90%)
    spo2_threshold_low: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    # Ngưỡng va đập gia tốc kế MPU6050 (đơn vị: g)
    fall_impact_threshold: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)

    # ---- 3. Cấu hình Edge AI Hub ----
    # Thời gian bất động nghi ngờ sau cú ngã để kích hoạt báo động khẩn cấp (giây)
    immobility_seconds: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    # Topic MQTT chuyên biệt của thiết bị (care/hub-001/...)
    mqtt_topic: Mapped[str | None] = mapped_column(String(150), nullable=True)

    # ---- 4. Cấu hình mở rộng dạng JSONB linh hoạt ----
    extra_settings: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True, default=dict)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationship
    device: Mapped["Device"] = relationship("Device", back_populates="config")

