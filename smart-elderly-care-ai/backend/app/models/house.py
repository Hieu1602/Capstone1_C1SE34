"""
house.py – SQLAlchemy ORM Model cho Căn nhà (House) và Thành viên gia đình (HouseMember).
Hỗ trợ quản lý chế độ nhà (HOME, AWAY, DISARM, ALARM, PRIVACY) và phân quyền người chăm sóc.
Vị trí: backend/app/models/house.py
"""

from __future__ import annotations

from typing import TYPE_CHECKING
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.device import Device
    from app.models.device_group import DeviceGroup
    from app.models.elderly_profile import ElderlyProfile


class House(Base):
    """
    Bảng đại diện cho một căn nhà/hộ gia đình nơi triển khai hệ thống IoT chăm sóc người cao tuổi.
    Một căn nhà có thể bao gồm nhiều nhóm khu vực (phòng), nhiều thiết bị và nhiều thành viên.
    """
    __tablename__ = "houses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False, default="Nhà của tôi")
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    
    # Chế độ bảo vệ an ninh hiện tại của ngôi nhà: HOME, AWAY, DISARM, ALARM, PRIVACY
    current_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="HOME"
    )

    # Chủ sở hữu / người quản trị chính của căn nhà
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ---- Relationships ----
    owner: Mapped["User"] = relationship("User", back_populates="owned_houses")
    members: Mapped[list["HouseMember"]] = relationship(
        "HouseMember", back_populates="house", cascade="all, delete-orphan"
    )
    device_groups: Mapped[list["DeviceGroup"]] = relationship(
        "DeviceGroup", back_populates="house", cascade="all, delete-orphan", lazy="selectin"
    )
    devices: Mapped[list["Device"]] = relationship(
        "Device", back_populates="house", cascade="all, delete-orphan", lazy="selectin"
    )
    elderly_profiles: Mapped[list["ElderlyProfile"]] = relationship(
        "ElderlyProfile", back_populates="house", cascade="all, delete-orphan"
    )


class HouseMember(Base):
    """
    Bảng liên kết thành viên gia đình, người chăm sóc (Caregiver), hoặc Bác sĩ với căn nhà.
    """
    __tablename__ = "house_members"
    __table_args__ = (
        UniqueConstraint("house_id", "user_id", name="uq_house_member"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    house_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("houses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Vai trò trong gia đình: OWNER, CAREGIVER, DOCTOR, RELATIVE
    role_in_house: Mapped[str] = mapped_column(String(50), default="CAREGIVER", nullable=False)
    # Quyền hạn thao tác: ADMIN, OPERATOR, VIEWER
    permissions: Mapped[str] = mapped_column(String(50), default="OPERATOR", nullable=False)

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    house: Mapped["House"] = relationship("House", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="house_memberships")

