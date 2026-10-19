"""
device_group.py – Pydantic v2 Schemas cho Phân vùng Nhóm thiết bị (DeviceGroup).
Hỗ trợ tạo nhóm với thiết bị kèm theo, chỉnh sửa tên và danh sách thiết bị thuộc nhóm.
Vị trí: backend/app/schemas/device_group.py
"""

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class DeviceGroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Tên nhóm khu vực (vd: Phòng khách, Phòng ngủ)")
    description: Optional[str] = Field(default=None, max_length=255)
    icon: str = Field(default="folder", max_length=50)
    color: str = Field(default="#7C3AED", max_length=20)
    sort_order: int = Field(default=0)

    @field_validator("name")
    @classmethod
    def validate_name_not_empty(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Tên nhóm không được để trống.")
        return trimmed


class DeviceGroupCreate(DeviceGroupBase):
    # Danh sách ID thiết bị ban đầu được gán vào nhóm
    device_ids: Optional[List[UUID]] = Field(default_factory=list, description="Danh sách thiết bị gán vào nhóm khi tạo")


class DeviceGroupUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    icon: Optional[str] = Field(default=None, max_length=50)
    color: Optional[str] = Field(default=None, max_length=20)
    sort_order: Optional[int] = None
    # Nếu truyền device_ids, hệ thống sẽ đồng bộ lại các thiết bị thuộc nhóm này
    device_ids: Optional[List[UUID]] = Field(default=None, description="Danh sách ID thiết bị mới thuộc nhóm")

    @field_validator("name")
    @classmethod
    def validate_update_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Tên nhóm không được để trống.")
            return trimmed
        return v


class DeviceGroupOut(DeviceGroupBase):
    id: UUID
    house_id: UUID
    device_count: int = 0
    online_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BatchAssignDevices(BaseModel):
    device_ids: List[UUID] = Field(..., min_length=1, description="Danh sách ID thiết bị cần gán vào nhóm")

