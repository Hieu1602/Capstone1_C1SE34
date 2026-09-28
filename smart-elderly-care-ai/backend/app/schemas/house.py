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

