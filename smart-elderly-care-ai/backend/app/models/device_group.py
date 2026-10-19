"""
device_group.py – SQLAlchemy ORM Model cho Phân vùng Nhóm / Khu vực phòng (DeviceGroup).
Đáp ứng quy tắc nghiệp vụ:
- Tên nhóm là duy nhất trong cùng một nhà (Unique Constraint per house).
- Không được để trống tên nhóm.
- Chứa các thiết bị thuộc khu vực (Phòng khách, Phòng ngủ, Nhà tắm & Cửa...).
Vị trí: backend/app/models/device_group.py
"""

from __future__ import annotations

from typing import TYPE_CHECKING
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.house import House
    from app.models.device import Device


class DeviceGroup(Base):
    """
    Bảng đại diện cho một nhóm khu vực / phòng trong ngôi nhà (vd: Phòng khách, Phòng ngủ, Ban công...).
    Mỗi nhóm có thể chứa nhiều thiết bị IoT (Camera, Vòng đeo tay, v.v.).
    """
    __tablename__ = "device_groups"
    __table_args__ = (
        # Ràng buộc tên nhóm là duy nhất trong phạm vi mỗi căn nhà
        UniqueConstraint("house_id", "name", name="uq_device_group_house_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    house_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("houses.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Tên nhóm (duy nhất trong nhà, không rỗng): ví dụ "Phòng khách", "Phòng ngủ"
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Biểu tượng và màu sắc đại diện cho nhóm (đồng bộ với UI mobile)
    icon: Mapped[str] = mapped_column(String(50), default="folder", nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#7C3AED", nullable=False)
    
    # Thứ tự sắp xếp hiển thị trên giao diện
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ---- Relationships ----
    house: Mapped["House"] = relationship("House", back_populates="device_groups")
    devices: Mapped[list["Device"]] = relationship(
        "Device", back_populates="group", lazy="selectin"
    )

