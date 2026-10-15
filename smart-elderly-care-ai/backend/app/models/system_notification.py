"""
system_notification.py – ORM Model cho quản lý thông báo toàn hệ thống (System Notifications / Announcements).
Dành cho Cổng Quản trị Web Admin điều phối thông báo đến ứng dụng di động.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class SystemNotification(Base):
    __tablename__ = "system_notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Tiêu đề và nội dung thông báo
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    # Phân loại thông báo: info, system_maintenance, emergency, health_tip, feature_update
    type: Mapped[str] = mapped_column(String(50), default="info", nullable=False)

    # Đối tượng nhận: all, caregivers, doctors, elderly
    target_audience: Mapped[str] = mapped_column(String(50), default="all", nullable=False)

    # Trạng thái: draft (nháp), scheduled (đã lên lịch), published (đã phát hành), revoked (đã thu hồi)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False, index=True)

    # Mốc thời gian điều phối
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoke_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Thống kê tiếp cận
    delivered_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    read_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Người tạo
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Audit timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationship tới User (tùy chọn)
    author = relationship("User", foreign_keys=[created_by], lazy="selectin")

