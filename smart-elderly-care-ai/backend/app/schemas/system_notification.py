"""
system_notification.py – Pydantic Schemas cho Quản lý thông báo toàn hệ thống.
"""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


NotificationType = Literal["info", "system_maintenance", "emergency", "health_tip", "feature_update"]
TargetAudience = Literal["all", "caregivers", "doctors", "elderly"]
NotificationStatus = Literal["draft", "scheduled", "published", "revoked"]


class SystemNotificationBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Tiêu đề thông báo")
    body: str = Field(..., min_length=1, description="Nội dung thông báo")
    type: NotificationType = Field(default="info", description="Phân loại thông báo")
    target_audience: TargetAudience = Field(default="all", description="Đối tượng nhận thông báo")
    scheduled_at: Optional[datetime] = Field(default=None, description="Thời gian dự kiến phát hành")
    expires_at: Optional[datetime] = Field(default=None, description="Thời gian hết hạn thông báo (tự động đóng/ẩn)")


class SystemNotificationCreate(SystemNotificationBase):
    status: Optional[Literal["draft", "scheduled", "published"]] = Field(
        default="draft", description="Trạng thái khởi tạo: draft (nháp), scheduled (lên lịch), published (phát hành ngay)"
    )


class SystemNotificationUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    body: Optional[str] = Field(default=None, min_length=1)
    type: Optional[NotificationType] = None
    target_audience: Optional[TargetAudience] = None
    status: Optional[NotificationStatus] = None
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class SystemNotificationSchedule(BaseModel):
    scheduled_at: datetime = Field(..., description="Thời gian lên lịch phát hành")


class SystemNotificationRevoke(BaseModel):
    revoke_reason: Optional[str] = Field(default="Thu hồi bởi Quản trị viên hệ thống", description="Lý do thu hồi thông báo")


class SystemNotificationOut(BaseModel):
    id: UUID
    title: str
    body: str
    type: str
    target_audience: str
    status: str
    scheduled_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    revoke_reason: Optional[str] = None
    delivered_count: int = 0
    read_count: int = 0
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

