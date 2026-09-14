"""
user.py – Pydantic Schemas cho User endpoints.
"""

import uuid
from typing import Optional

from pydantic import BaseModel, EmailStr, model_validator


class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    full_name: str
    phone: Optional[str] = None
    role: str = "caregiver"

    @model_validator(mode="after")
    def validate_identifier(self):
        if not self.email and not self.phone:
            raise ValueError("Phải nhập ít nhất một trong hai: email hoặc số điện thoại.")
        return self


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    fcm_token: Optional[str] = None


class UserOut(UserBase):
    id: uuid.UUID
    is_active: bool

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
