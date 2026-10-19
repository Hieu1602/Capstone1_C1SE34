"""
device_config.py – SQLAlchemy ORM Model cho Cấu hình Chi tiết Thiết bị (DeviceConfig).
Người làm: DuongVanHieu
Nghiệp vụ: Lưu trữ các tham số hiệu chuẩn y tế chuyên sâu (ngưỡng nhịp tim, SpO2, gia tốc ngã),
và thông số vận hành Camera (luồng RTSP, chế độ ngủ riêng tư, bảo vệ AI).
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
    from app.models.user import User


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

    # Ngưỡng huyết áp tâm thu cao / thấp (cảnh báo tăng / tụt huyết áp, mmHg)
    bp_systolic_high: Mapped[int] = mapped_column(Integer, default=140, nullable=False)
    bp_systolic_low: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    # Ngưỡng huyết áp tâm trương cao / thấp (mmHg)
    bp_diastolic_high: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    bp_diastolic_low: Mapped[int] = mapped_column(Integer, default=60, nullable=False)

    # Ngưỡng va đập gia tốc kế MPU6050 (đơn vị: g)
    fall_impact_threshold: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)

    # ---- 3. Cấu hình Edge AI Hub ----
    # Thời gian bất động nghi ngờ sau cú ngã để kích hoạt báo động khẩn cấp (giây)
    immobility_seconds: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    # Topic MQTT chuyên biệt của thiết bị (care/hub-001/...)
    mqtt_topic: Mapped[str | None] = mapped_column(String(150), nullable=True)

    # ---- 4. Phân quyền & Quản lý thiết lập (Chủ nhà hoặc Bác sĩ tự set up) ----
    # Cờ đánh dấu đã tùy chỉnh ngưỡng riêng cho cụ hay vẫn dùng chuẩn mặc định y tế
    is_custom_thresholds: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # ID người thực hiện thiết lập (Chủ nhà hoặc Bác sĩ)
    configured_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Vai trò người thực hiện: 'OWNER', 'DOCTOR', 'SYSTEM'
    configured_by_role: Mapped[str | None] = mapped_column(String(20), default="SYSTEM", nullable=True)

    # ---- 5. Cấu hình mở rộng dạng JSONB linh hoạt ----
    extra_settings: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True, default=dict)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    device: Mapped["Device"] = relationship("Device", back_populates="config")
    configured_by: Mapped["User | None"] = relationship("User", foreign_keys=[configured_by_user_id])

