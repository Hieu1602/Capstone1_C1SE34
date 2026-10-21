"""
user.py – Pydantic Schemas cho User endpoints.
"""

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class UserBase(BaseModel):
    full_name: str
    phone: str
    role: str = "user"
    avatar_url: Optional[str] = None
    cchn_number: Optional[str] = None
    specialty: Optional[str] = None
    workplace: Optional[str] = None

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
    avatar_url: Optional[str] = None
    cchn_number: Optional[str] = None
    specialty: Optional[str] = None
    workplace: Optional[str] = None
    fcm_token: Optional[str] = None
    preferred_language: Optional[Literal["vi", "en"]] = None
    language: Optional[str] = "vi"
    font_size_mode: Optional[Literal["system", "custom"]] = None
    custom_font_scale: Optional[int] = Field(default=None, ge=0, le=4)
    vibration_enabled: Optional[bool] = None
    notifications_enabled: Optional[bool] = None
    alert_sound_enabled: Optional[bool] = None
    critical_alert_enabled: Optional[bool] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_language_fields(cls, data):
        if isinstance(data, dict):
            if "language" in data and "preferred_language" not in data:
                data["preferred_language"] = data["language"]
            if "phone_number" in data and "phone" not in data:
                data["phone"] = data["phone_number"]
            if "full_name" in data and data["full_name"] is not None:
                cleaned_name = str(data["full_name"]).strip()
                if not cleaned_name:
                    raise ValueError("Tên không được để trống.")
                data["full_name"] = cleaned_name
        return data


class LanguagePreferenceUpdate(BaseModel):
    preferred_language: Literal["vi", "en"]

    @model_validator(mode="before")
    @classmethod
    def normalize_language_payload(cls, data):
        if isinstance(data, dict):
            language = data.get("preferred_language", data.get("language"))
            if isinstance(language, str):
                data = {**data, "preferred_language": language.strip().lower()}
        return data


class FontSizePreferenceUpdate(BaseModel):
    font_size_mode: Literal["system", "custom"]
    custom_font_scale: int = Field(ge=0, le=4)


class NotificationPreferenceUpdate(BaseModel):
    notifications_enabled: Optional[bool] = None
    alert_sound_enabled: Optional[bool] = None
    critical_alert_enabled: Optional[bool] = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(
        min_length=8,
        max_length=16,
    )
    confirm_new_password: str = Field(min_length=8, max_length=16)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, value: str) -> str:
        if not (
            any(character.islower() for character in value)
            and any(character.isupper() for character in value)
            and any(character.isdigit() for character in value)
            and any(not character.isalnum() for character in value)
        ):
            raise ValueError(
                "Mật khẩu mới cần có chữ hoa, chữ thường, số và ký tự đặc biệt."
            )
        return value

    @model_validator(mode="after")
    def check_passwords_match(self) -> "PasswordChange":
        if self.new_password != self.confirm_new_password:
            raise ValueError("Mật khẩu mới và xác nhận mật khẩu mới không khớp.")
        return self


class UserOut(UserBase):
    id: uuid.UUID
    is_active: bool
    preferred_language: Optional[str] = "vi"
    language: Optional[str] = "vi"
    font_size_mode: Optional[str] = "system"
    custom_font_scale: int = Field(default=2, ge=0, le=4)
    vibration_enabled: bool = True
    notifications_enabled: bool = True
    alert_sound_enabled: bool = True
    critical_alert_enabled: bool = True
    location_enabled: bool = True
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    location_address: Optional[str] = None
    cchn_number: Optional[str] = None
    specialty: Optional[str] = None
    workplace: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    assigned_house: Optional[str] = None
    household_id: Optional[uuid.UUID] = None
    role_title: Optional[str] = None

    @model_validator(mode="after")
    def set_language_alias(self) -> "UserOut":
        self.language = self.preferred_language
        return self

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserTerminalOut(BaseModel):
    id: uuid.UUID
    device_name: str
    device_type: str = "mobile"
    os: Optional[str] = None
    browser: Optional[str] = None
    ip_address: str
    location: Optional[str] = "Đà Nẵng, Việt Nam"
    last_active_at: Optional[datetime] = None
    is_current: bool = False
    is_active: bool = True
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserLoginHistoryOut(BaseModel):
    id: uuid.UUID
    device_name: str
    ip_address: str
    location: Optional[str] = "Đà Nẵng, Việt Nam"
    login_time: datetime
    login_method: str = "Mật khẩu"
    status: str = "success"
    user_agent: Optional[str] = None
    is_current: bool = False

    model_config = {"from_attributes": True}
