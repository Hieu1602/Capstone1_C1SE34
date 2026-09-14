"""
config.py
Pydantic Settings – Đọc cấu hình từ environment variables / .env file.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- App ----
    APP_NAME: str = "Smart Elderly Care AI"
    DEBUG: bool = False
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_RANDOM_256BIT"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

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

    # ---- MinIO / S3 ----
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "CHANGE_ME"
    MINIO_BUCKET_INCIDENTS: str = "incidents"
    MINIO_SECURE: bool = False

    # ---- Firebase FCM ----
    FCM_SERVICE_ACCOUNT_PATH: str = "config/firebase-service-account.json"

    # ---- TimescaleDB ----
    TIMESCALE_CHUNK_INTERVAL: str = "1 day"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
