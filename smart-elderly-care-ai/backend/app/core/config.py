"""
config.py
Pydantic Settings – Đọc cấu hình từ environment variables / .env file.
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import AliasChoices, Field, field_validator
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Tự động nạp file .env từ các thư mục cha hoặc thư mục hiện tại
_THIS_FILE = Path(__file__).resolve()
_SEARCH_PATHS = [
    *(_parent / ".env" for _parent in _THIS_FILE.parents),
    Path("../.env"),
    Path(".env"),
]
for _p in _SEARCH_PATHS:
    if _p.is_file():
        load_dotenv(dotenv_path=_p, override=True)
        break


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "../../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- App ----
    APP_NAME: str = "Smart Elderly Care AI"
    DEBUG: bool = False

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v):
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes", "debug", "dev")
        return bool(v)

    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_RANDOM_256BIT"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    OTP_MODE: str = "mock"
    OTP_DEV_CODE: str = "123456"

    # ---- Database ----
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/elderly_care"
    REDIS_URL: str = "redis://localhost:6379/0"

    # ---- CORS / Host ----
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8081"]
    ALLOWED_HOSTS: List[str] = ["*"]

    # ---- MQTT (EMQX) ----
    MQTT_BROKER_HOST: str = "localhost"
    MQTT_BROKER_PORT: int = 1883
    MQTT_USERNAME: str = "backend"
    MQTT_PASSWORD: str = "CHANGE_ME"
    MQTT_CLIENT_ID: str = "backend-fastapi-001"
    MQTT_TOPIC_TELEMETRY: str = "care/+/telemetry"
    MQTT_TOPIC_ALERT: str = "care/+/alert"

    # ---- Cloud Object Storage (AWS S3 / MinIO) ----
    MINIO_ENDPOINT: str = Field(
        default="localhost:9000",
        validation_alias=AliasChoices("AWS_S3_ENDPOINT", "MINIO_ENDPOINT", "S3_ENDPOINT"),
    )
    MINIO_ACCESS_KEY: str = Field(
        default="minioadmin",
        validation_alias=AliasChoices("AWS_ACCESS_KEY_ID", "MINIO_ACCESS_KEY", "S3_ACCESS_KEY"),
    )
    MINIO_SECRET_KEY: str = Field(
        default="CHANGE_ME",
        validation_alias=AliasChoices("AWS_SECRET_ACCESS_KEY", "MINIO_SECRET_KEY", "S3_SECRET_KEY"),
    )
    MINIO_BUCKET_INCIDENTS: str = Field(
        default="incidents",
        validation_alias=AliasChoices(
            "AWS_S3_BUCKET_INCIDENTS", "MINIO_BUCKET_INCIDENTS", "AWS_S3_BUCKET", "S3_BUCKET_INCIDENTS"
        ),
    )
    MINIO_SECURE: bool = Field(
        default=False,
        validation_alias=AliasChoices("AWS_S3_SECURE", "MINIO_SECURE", "S3_SECURE"),
    )
    MINIO_REGION: str = Field(
        default="",
        validation_alias=AliasChoices("AWS_REGION", "MINIO_REGION", "AWS_DEFAULT_REGION", "S3_REGION"),
    )

    @property
    def AWS_ACCESS_KEY_ID(self) -> str:
        return self.MINIO_ACCESS_KEY

    @property
    def AWS_SECRET_ACCESS_KEY(self) -> str:
        return self.MINIO_SECRET_KEY

    @property
    def AWS_S3_ENDPOINT(self) -> str:
        return self.MINIO_ENDPOINT

    @property
    def AWS_S3_BUCKET_INCIDENTS(self) -> str:
        return self.MINIO_BUCKET_INCIDENTS

    @property
    def AWS_S3_SECURE(self) -> bool:
        return self.MINIO_SECURE

    @property
    def AWS_REGION(self) -> str:
        return self.MINIO_REGION

    # ---- Firebase FCM ----
    FCM_SERVICE_ACCOUNT_PATH: str = "config/firebase-service-account.json"

    # ---- Twilio Verify ----
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_VERIFY_SERVICE_SID: str = ""

    # ---- eSMS Gateway ----
    ESMS_API_KEY: str = ""
    ESMS_SECRET_KEY: str = ""
    ESMS_BRANDNAME: str = "Baotrixemay"
    ESMS_SMS_TYPE: str = "2"
    ESMS_SANDBOX: str = "0"
    ESMS_OTP_REGISTER_TEMPLATE_ID: str = ""
    ESMS_OTP_RESET_TEMPLATE_ID: str = ""

    # ---- OTP Rate Limit ----
    OTP_RATE_LIMIT_SECONDS: int = 60  # Thời gian tối thiểu giữa 2 lần gửi OTP (giây)
    OTP_MAX_ATTEMPTS: int = 5  # Số lần nhập sai OTP tối đa trước khi khoá tạm

    # ---- Chatbot AI / LLM ----
    ENABLE_EXTERNAL_LLM: bool = True
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    LLM_MODEL: str = "gemini-3.1-flash-lite"

    # ---- TimescaleDB ----
    TIMESCALE_CHUNK_INTERVAL: str = "1 day"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
