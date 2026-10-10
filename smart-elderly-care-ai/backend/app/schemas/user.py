"""
user.py – Pydantic Schemas cho User endpoints.
"""

import uuid
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class UserBase(BaseModel):
    full_name: str
    phone: str
    role: str = "caregiver"

    @model_validator(mode="after")
    def validate_identifier(self):
        normalized_phone = self.phone.strip() if self.phone else ""
        if not normalized_phone:
            raise ValueError("Số điện thoại không được để trống.")
        self.phone = normalized_phone
        return self


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    fcm_token: Optional[str] = None
    preferred_language: Optional[Literal["vi", "en"]] = None
    font_size_mode: Optional[Literal["system", "custom"]] = None
    custom_font_scale: Optional[int] = None
    vibration_enabled: Optional[bool] = None
    location_enabled: Optional[bool] = None
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    location_address: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_new_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def check_passwords_match(self) -> "PasswordChange":
        if self.new_password != self.confirm_new_password:
            raise ValueError("Mật khẩu mới và xác nhận mật khẩu mới không khớp.")
        return self


class UserOut(UserBase):
    id: uuid.UUID
    is_active: bool
    preferred_language: Literal["vi", "en"] = "vi"
    font_size_mode: Literal["system", "custom"] = "system"
    custom_font_scale: int = 2
    vibration_enabled: bool = True
    location_enabled: bool = True
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    location_address: Optional[str] = None

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
