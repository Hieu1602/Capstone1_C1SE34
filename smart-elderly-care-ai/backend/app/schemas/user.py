"""
user.py – Pydantic Schemas cho User endpoints.
"""

import uuid
from typing import Optional

from pydantic import BaseModel, model_validator


class UserBase(BaseModel):
    full_name: str
    phone: str
    role: str = "user"

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


class UserOut(UserBase):
    id: uuid.UUID
    is_active: bool

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
