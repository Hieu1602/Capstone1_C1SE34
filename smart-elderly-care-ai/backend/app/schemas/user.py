"""
user.py – Pydantic Schemas cho User endpoints.
"""

import uuid
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class UserBase(BaseModel):
    full_name: str
    phone: str
    role: str = "user"
    avatar_url: Optional[str] = None

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
    fcm_token: Optional[str] = None
    preferred_language: Optional[Literal["vi", "en"]] = None
    language: Optional[Literal["vi", "en"]] = None
    font_size_mode: Optional[Literal["system", "custom"]] = None
    custom_font_scale: Optional[int] = Field(default=None, ge=0, le=4)
    vibration_enabled: Optional[bool] = None
    location_enabled: Optional[bool] = None
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    location_address: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_language_fields(cls, data):
        if isinstance(data, dict):
            if "language" in data and "preferred_language" not in data:
                data["preferred_language"] = data["language"]
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
    preferred_language: Literal["vi", "en"] = "vi"
    language: Optional[Literal["vi", "en"]] = None
    font_size_mode: Literal["system", "custom"] = "system"
    custom_font_scale: int = Field(default=2, ge=0, le=4)
    vibration_enabled: bool = True
    location_enabled: bool = True
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    location_address: Optional[str] = None

    @model_validator(mode="after")
    def set_language_alias(self) -> "UserOut":
        self.language = self.preferred_language
        return self

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
