"""
user_terminal.py – SQLAlchemy ORM Models cho Quản lý đầu cuối (Terminals) và Lịch sử đăng nhập (Login History).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class UserTerminal(Base):
    """
    Quản lý đầu cuối (Client Terminals/Devices) của tài khoản người dùng:
    Smartphone, Máy tính bảng, Trình duyệt Web đã đăng nhập vào hệ thống SECA.
    """
    __tablename__ = "user_terminals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_name: Mapped[str] = mapped_column(String(255), nullable=False)
    device_type: Mapped[str] = mapped_column(String(50), nullable=False, default="mobile")  # mobile, tablet, desktop, web
    os: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    browser: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ip_address: Mapped[str] = mapped_column(String(50), nullable=False, default="127.0.0.1")
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, default="Đà Nẵng, Việt Nam")
    last_active_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="terminals")


class UserLoginHistory(Base):
    """
    Lịch sử đăng nhập tài khoản (Login History):
    Ghi nhận chi tiết thời gian, thiết bị, IP, vị trí và trạng thái đăng nhập.
    """
    __tablename__ = "user_login_histories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ip_address: Mapped[str] = mapped_column(String(50), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, default="Đà Nẵng, Việt Nam")
    login_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    login_method: Mapped[str] = mapped_column(String(50), nullable=False, default="Mật khẩu")  # Mật khẩu, SMS OTP, Biometric
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="success")  # success, failed
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="login_histories")

