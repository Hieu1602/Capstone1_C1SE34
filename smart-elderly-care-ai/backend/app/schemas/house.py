"""
house.py – Pydantic v2 Schemas cho Căn nhà (House) và Chế độ an ninh (House Mode).
Vị trí: backend/app/schemas/house.py
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class HouseBase(BaseModel):
    name: str = Field(default="Nhà của tôi", max_length=150, description="Tên định danh căn nhà")
    address: Optional[str] = Field(default=None, max_length=300, description="Địa chỉ lắp đặt")
    current_mode: str = Field(default="HOME", description="Chế độ an ninh: HOME, AWAY, DISARM, ALARM, PRIVACY")


class HouseCreate(HouseBase):
    pass


class HouseUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=150)
    address: Optional[str] = Field(default=None, max_length=300)
    current_mode: Optional[str] = None


class HouseModeUpdate(BaseModel):
    mode: str = Field(..., description="Chế độ nhà cần chuyển: HOME, AWAY, DISARM, ALARM, PRIVACY")


class HouseOut(HouseBase):
    id: UUID
    owner_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HouseMemberCreate(BaseModel):
    phone_number: str = Field(..., description="Số điện thoại thành viên")
    role_in_house: Optional[str] = Field(default="Người chăm sóc", description="Vai trò hiển thị trong nhà")
    role: Optional[str] = Field(default="CAREGIVER", description="Mã vai trò hệ thống: OWNER, CAREGIVER, DOCTOR")
    full_name: Optional[str] = Field(default=None, description="Họ và tên nếu chưa có tài khoản")
    permissions: Optional[str] = Field(default="Theo dõi & Nhận cảnh báo", description="Quyền hạn")


class HouseMemberOut(BaseModel):
    id: UUID | str
    user_id: Optional[UUID | str] = None
    full_name: str
    phone_number: Optional[str] = None
    role: str
    role_in_house: str
    permissions: str
    is_owner: bool = False
    avatar_url: Optional[str] = None
    joined_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
