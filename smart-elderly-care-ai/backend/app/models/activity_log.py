"""
activity_log.py – Nhật ký thao tác phục vụ truy vết (audit trail):
- AppointmentEvent: ai tạo / dời / xác nhận / hủy / hoàn thành / xóa lịch khám, lúc mấy giờ, đổi gì.
- NotificationRead: người dùng đã đọc thông báo nào, lúc mấy giờ (đồng bộ Web <-> App).
"""

from __future__ import annotations

from datetime import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class AppointmentEvent(Base):
    """Một thao tác trên lịch khám. Không ràng buộc FK tới appointments để lịch sử còn lại kể cả khi lịch bị xóa."""

    __tablename__ = "appointment_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appointment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    # CREATED | REQUESTED | RESCHEDULED | UPDATED | CONFIRMED | COMPLETED | CANCELLED | DELETED
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    actor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    actor_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # JSON {"field": [giá trị cũ, giá trị mới]}
    changes_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class NotificationRead(Base):
    """Thông báo đã đọc. notification_key dùng chung mã giữa Web & App: inc_<id>, apt_<id>, pat_<id>, sys_<id>."""

    __tablename__ = "notification_reads"
    __table_args__ = (UniqueConstraint("user_id", "notification_key", name="uq_notification_reads_user_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    notification_key: Mapped[str] = mapped_column(String(100), nullable=False)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
