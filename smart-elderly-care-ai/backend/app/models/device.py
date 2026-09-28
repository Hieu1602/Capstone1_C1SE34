"""
device.py – SQLAlchemy ORM Model Master cho Thiết bị IoT (Device).
Quản lý các loại thiết bị:
- CAMERA: Camera AI an ninh (SECA_001, SECA_002, Ranger 2C...)
- SMARTBAND: Vòng đeo tay y tế BLE đo nhịp tim, SpO2, gia tốc kế ngã
- EDGE_HUB: Trung tâm xử lý AI NPU Edge Hub (Orange Pi 5)
Vị trí: backend/app/models/device.py
"""

from __future__ import annotations

from typing import TYPE_CHECKING
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.house import House
    from app.models.device_group import DeviceGroup
    from app.models.elderly_profile import ElderlyProfile
    from app.models.device_config import DeviceConfig
    from app.models.vital_sign import VitalSign
    from app.models.incident import Incident


class DeviceType(str):
    CAMERA = "CAMERA"
    SMARTBAND = "SMARTBAND"
    EDGE_HUB = "EDGE_HUB"


class Device(Base):
    """
    Bảng Master lưu trữ toàn bộ thiết bị phần cứng trong hệ thống chăm sóc người cao tuổi.
    """
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Mã định danh thiết bị duy nhất trên toàn hệ thống (ví dụ: SECA_001, BLE_BAND_01, HUB_001)
    device_id: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    sub_title: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Phân loại thiết bị: CAMERA, SMARTBAND, EDGE_HUB
    device_type: Mapped[str] = mapped_column(
        String(30), default=DeviceType.CAMERA, nullable=False, index=True
    )

    # Vị trí phòng dạng văn bản (để tương thích ngược hoặc ghi chú nhanh)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Trạng thái kết nối mạng thực tế
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Mô tả trạng thái hiển thị trên app (ví dụ: "Đang ghi hình", "Pin 84% • Đang đeo", "Trực tuyến (24/7)")
    status_text: Mapped[str | None] = mapped_column(String(150), nullable=True)
    # Phần trăm pin (0 - 100%, NULL với Camera/Hub cắm điện trực tiếp)
    battery_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    # Thông số mạng & phần cứng
    mac_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    firmware_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_heartbeat: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    # ---- Foreign Keys ----
    # 1. Người sở hữu thiết bị
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 2. Căn nhà nơi thiết bị được lắp đặt (Nullable ban đầu cho backward compat, mặc định gán theo house chính của user)
    house_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("houses.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # 3. Phân vùng nhóm / khu vực phòng (Phòng khách, Phòng ngủ... Khi xóa nhóm -> group_id = NULL)
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("device_groups.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # 4. Người cao tuổi đang được thiết bị này giám sát (đặc biệt là Vòng đeo tay BLE Smartband)
    elderly_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("elderly_profiles.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ---- Relationships ----
    owner: Mapped["User"] = relationship("User", back_populates="devices")
    house: Mapped["House | None"] = relationship("House", back_populates="devices")
    group: Mapped["DeviceGroup | None"] = relationship("DeviceGroup", back_populates="devices")
    elderly: Mapped["ElderlyProfile | None"] = relationship("ElderlyProfile", back_populates="devices")

    # Cấu hình chuyên sâu 1 - 1
    config: Mapped["DeviceConfig | None"] = relationship(
        "DeviceConfig", back_populates="device", uselist=False, cascade="all, delete-orphan", lazy="selectin"
    )

    # Chuỗi thời gian vitals & danh sách sự cố
    vital_signs: Mapped[list["VitalSign"]] = relationship(
        "VitalSign", back_populates="device", lazy="dynamic"
    )
    incidents: Mapped[list["Incident"]] = relationship(
        "Incident", back_populates="device", lazy="dynamic"
    )
